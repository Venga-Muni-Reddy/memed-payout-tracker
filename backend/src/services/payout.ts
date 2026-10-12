/**
 * Pure payout logic. No database access here so it is trivial to unit test.
 *
 * Rules (see README for the open-case decisions):
 *  - A post's payout is the amount of the HIGHEST milestone its views have crossed (not the sum).
 *  - A creator is only ever paid the difference between that amount and what was already paid.
 *  - A campaign never pays out more than its remaining budget (partial payout when it runs short).
 */
export interface Milestone {
  views: number;
  payout: number;
}

/** Returns the ladder sorted by view threshold, ascending. */
export function sortLadder(ladder: Milestone[]): Milestone[] {
  return [...ladder].sort((a, b) => a.views - b.views);
}

/** Validation errors for a milestone ladder. Empty array = valid. */
export function validateLadder(ladder: Milestone[]): string[] {
  const errors: string[] = [];
  if (ladder.length === 0) return ["Add at least one milestone."];
  const sorted = sortLadder(ladder);
  sorted.forEach((m, i) => {
    if (!Number.isInteger(m.views) || m.views <= 0) errors.push(`Milestone ${i + 1}: views must be a positive whole number.`);
    if (!Number.isInteger(m.payout) || m.payout <= 0) errors.push(`Milestone ${i + 1}: payout must be a positive whole number.`);
    if (i > 0 && m.views === sorted[i - 1].views) errors.push(`Duplicate view threshold ${m.views}.`);
    if (i > 0 && m.payout < sorted[i - 1].payout) errors.push("A higher view milestone cannot pay less than a lower one.");
  });
  return errors;
}

/** Payout amount of the highest milestone crossed by `views` (0 if none crossed). */
export function milestonePayout(ladder: Milestone[], views: number): number {
  let best = 0;
  for (const m of sortLadder(ladder)) {
    if (views >= m.views) best = m.payout;
  }
  return best;
}

export interface PayoutDecision {
  /** Amount the milestone ladder says is due now (before the budget cap). */
  owed: number;
  /** Amount actually granted after applying the remaining budget. */
  granted: number;
}

/**
 * @param target      payout of the highest milestone crossed
 * @param alreadyPaid what this submission has been paid so far
 * @param remaining   campaign budget left
 */
export function decidePayout(target: number, alreadyPaid: number, remaining: number): PayoutDecision {
  const owed = Math.max(0, target - alreadyPaid);
  const granted = Math.min(owed, Math.max(0, remaining));
  return { owed, granted };
}

/**
 * Flags a suspicious jump in views: previous views were already meaningful (>= 1,000)
 * and one update added at least 5x that amount.
 */
export function detectSpike(previousViews: number, newViews: number): string | null {
  const increase = newViews - previousViews;
  if (previousViews >= 1000 && increase >= previousViews * 5) {
    return `Views jumped from ${previousViews} to ${newViews} in one update (${(increase / previousViews).toFixed(1)}x increase).`;
  }
  return null;
}
