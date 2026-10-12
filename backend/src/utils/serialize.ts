import { HydratedDocument } from "mongoose";

/** Shapes a campaign document for the API, adding the derived budget fields. */
export function campaignView(c: any) {
  const remaining = Math.max(0, c.totalBudget - c.spent);
  return {
    id: String(c._id),
    name: c.name,
    platform: c.platform,
    totalBudget: c.totalBudget,
    spent: c.spent,
    remaining,
    status: remaining > 0 ? "live" : "budget_exhausted",
    milestones: [...c.milestones].sort((a: any, b: any) => a.views - b.views).map((m: any) => ({ views: m.views, payout: m.payout })),
    brandName: c.brand?.name,
    createdAt: c.createdAt,
  };
}

export function submissionView(s: any) {
  return {
    id: String(s._id),
    campaignId: String(s.campaign?._id ?? s.campaign),
    campaignName: s.campaign?.name,
    platform: s.campaign?.platform,
    creatorName: s.creator?.name,
    postUrl: s.postUrl,
    views: s.views,
    paidOut: s.paidOut,
    flagged: s.flagged,
    flagReason: s.flagReason,
    createdAt: s.createdAt,
  };
}
export type AnyDoc = HydratedDocument<any>;
