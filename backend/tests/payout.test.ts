import { decidePayout, detectSpike, milestonePayout, validateLadder } from "../src/services/payout";

const ladder = [
  { views: 100000, payout: 5000 },
  { views: 10000, payout: 500 },
  { views: 50000, payout: 2000 },
];

describe("milestonePayout (highest milestone crossed)", () => {
  it("pays nothing below the first milestone", () => {
    expect(milestonePayout(ladder, 0)).toBe(0);
    expect(milestonePayout(ladder, 9999)).toBe(0);
  });
  it("pays the milestone amount when the threshold is hit exactly", () => {
    expect(milestonePayout(ladder, 10000)).toBe(500);
    expect(milestonePayout(ladder, 50000)).toBe(2000);
    expect(milestonePayout(ladder, 100000)).toBe(5000);
  });
  it("pays the highest milestone, not the sum, when views are in between or beyond", () => {
    expect(milestonePayout(ladder, 49999)).toBe(500);
    expect(milestonePayout(ladder, 75000)).toBe(2000);
    expect(milestonePayout(ladder, 5_000_000)).toBe(5000);
  });
  it("works with an unsorted ladder", () => {
    expect(milestonePayout(ladder, 60000)).toBe(2000);
  });
});

describe("decidePayout (incremental + budget cap)", () => {
  it("pays only the difference to what was already paid", () => {
    expect(decidePayout(2000, 500, 10000)).toEqual({ owed: 1500, granted: 1500 });
  });
  it("pays nothing when already fully paid (idempotent repeat)", () => {
    expect(decidePayout(2000, 2000, 10000)).toEqual({ owed: 0, granted: 0 });
  });
  it("never pays more than the remaining budget (partial payout)", () => {
    expect(decidePayout(5000, 0, 1200)).toEqual({ owed: 5000, granted: 1200 });
  });
  it("pays nothing when the budget is exhausted", () => {
    expect(decidePayout(500, 0, 0)).toEqual({ owed: 500, granted: 0 });
  });
  it("never goes negative if remaining budget is somehow negative", () => {
    expect(decidePayout(500, 0, -50).granted).toBe(0);
  });
  it("never pays negative if target is below what was already paid", () => {
    expect(decidePayout(500, 2000, 9999)).toEqual({ owed: 0, granted: 0 });
  });
});

describe("validateLadder", () => {
  it("accepts a valid ladder", () => expect(validateLadder(ladder)).toEqual([]));
  it("rejects an empty ladder", () => expect(validateLadder([])).not.toEqual([]));
  it("rejects duplicate thresholds", () => expect(validateLadder([{ views: 10, payout: 1 }, { views: 10, payout: 2 }]).length).toBeGreaterThan(0));
  it("rejects a higher milestone that pays less", () => expect(validateLadder([{ views: 10, payout: 100 }, { views: 20, payout: 50 }]).length).toBeGreaterThan(0));
  it("rejects zero or fractional values", () => {
    expect(validateLadder([{ views: 0, payout: 5 }]).length).toBeGreaterThan(0);
    expect(validateLadder([{ views: 10, payout: 1.5 }]).length).toBeGreaterThan(0);
  });
});

describe("detectSpike", () => {
  it("flags a 5x+ jump on a post that already had views", () => expect(detectSpike(2000, 12000)).not.toBeNull());
  it("does not flag normal growth", () => expect(detectSpike(2000, 4000)).toBeNull());
  it("does not flag the first views of a new post", () => expect(detectSpike(0, 90000)).toBeNull());
});
