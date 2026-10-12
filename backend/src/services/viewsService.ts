import { Types } from "mongoose";
import { Campaign } from "../models/Campaign";
import { Submission } from "../models/Submission";
import { HttpError } from "../utils/errors";
import { decidePayout, detectSpike, milestonePayout } from "./payout";

export interface ViewsUpdateResult {
  submissionId: string;
  views: number;
  previousViews: number;
  paidOut: number;
  paidNow: number;
  owedButUnpaid: number;
  flagged: boolean;
  budgetRemaining: number;
}

const MAX_ATTEMPTS = 10;

/**
 * Applies a new view count to a submission and pays out what is due.
 *
 * Concurrency safety without transactions:
 *  1. Reserve money on the campaign with ONE atomic update that caps `spent` at `totalBudget`.
 *     Two simultaneous updates can never both take the last rupees.
 *  2. Record it on the submission with a compare-and-set on the `paidOut`/`views` we read.
 *     If another request changed the submission first, our CAS fails, we give the reserved
 *     money back to the campaign and retry from fresh data. So a repeated update can never pay twice.
 */
export async function applyViewsUpdate(submissionId: string, requestedViews: number): Promise<ViewsUpdateResult> {
  if (!Types.ObjectId.isValid(submissionId)) throw new HttpError(404, "Submission not found.");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sub = await Submission.findById(submissionId);
    if (!sub) throw new HttpError(404, "Submission not found.");
    const campaign = await Campaign.findById(sub.campaign);
    if (!campaign) throw new HttpError(404, "Campaign not found.");

    // Platform view counts only go up. A lower number is treated as stale and ignored.
    const newViews = Math.max(sub.views, requestedViews);
    const target = milestonePayout(campaign.milestones, newViews);
    const { owed } = decidePayout(target, sub.paidOut, campaign.totalBudget - campaign.spent);

    // Step 1: atomically reserve budget (capped at totalBudget).
    let granted = 0;
    let remainingAfter = campaign.totalBudget - campaign.spent;
    if (owed > 0) {
      const before = await Campaign.findOneAndUpdate(
        { _id: campaign._id, $expr: { $lt: ["$spent", "$totalBudget"] } },
        [{ $set: { spent: { $min: ["$totalBudget", { $add: ["$spent", owed] }] } } }],
        { new: false }
      );
      if (before) {
        const room = before.totalBudget - before.spent;
        granted = Math.min(owed, room);
        remainingAfter = room - granted;
      } else {
        remainingAfter = 0;
      }
    }

    // Step 2: compare-and-set on the submission.
    const spikeReason = detectSpike(sub.views, newViews);
    const update: Record<string, unknown> = { $set: { views: newViews }, $inc: { paidOut: granted } };
    if (spikeReason) update.$set = { views: newViews, flagged: true, flagReason: spikeReason };
    const res = await Submission.updateOne({ _id: sub._id, paidOut: sub.paidOut, views: sub.views }, update);

    if (res.modifiedCount === 0 && res.matchedCount === 0) {
      // Someone else updated this submission first. Undo our reservation and retry.
      if (granted > 0) await Campaign.updateOne({ _id: campaign._id }, { $inc: { spent: -granted } });
      continue;
    }

    return {
      submissionId: sub.id,
      views: newViews,
      previousViews: sub.views,
      paidOut: sub.paidOut + granted,
      paidNow: granted,
      owedButUnpaid: owed - granted,
      flagged: sub.flagged || Boolean(spikeReason),
      budgetRemaining: remainingAfter,
    };
  }
  throw new HttpError(409, "Too many concurrent updates on this submission, please retry.");
}
