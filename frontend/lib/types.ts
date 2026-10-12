export type Role = "brand" | "creator";
export interface User { id: string; name: string; email: string; role: Role }
export interface Milestone { views: number; payout: number }
export interface Campaign {
  id: string; name: string; platform: "Instagram" | "YouTube";
  totalBudget: number; spent: number; remaining: number;
  status: "live" | "budget_exhausted"; milestones: Milestone[];
  brandName?: string; submissionCount?: number; flaggedCount?: number;
}
export interface Submission {
  id: string; campaignId: string; campaignName?: string; platform?: string; creatorName?: string;
  postUrl: string; views: number; paidOut: number; flagged: boolean; flagReason?: string;
}
export interface ViewsResult {
  views: number; paidNow: number; paidOut: number; owedButUnpaid: number; flagged: boolean; budgetRemaining: number;
}
