import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Campaign } from "../models/Campaign";
import { Submission } from "../models/Submission";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../utils/errors";
import { validateLadder } from "../services/payout";
import { campaignView, submissionView } from "../utils/serialize";

export const campaignsRouter = Router();

const createSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(120),
  platform: z.enum(["Instagram", "YouTube"]),
  totalBudget: z.number().int("Budget must be a whole number").positive("Budget must be greater than 0"),
  milestones: z
    .array(z.object({ views: z.number().int().positive(), payout: z.number().int().positive() }))
    .min(1, "Add at least one milestone"),
});

const postUrlSchema = z.object({ postUrl: z.string().trim().url("Enter a valid link") });

/** Brand: create a campaign. */
campaignsRouter.post("/", requireAuth, requireRole("brand"), async (req, res) => {
  const body = createSchema.parse(req.body);
  const ladderErrors = validateLadder(body.milestones);
  if (ladderErrors.length) throw new HttpError(400, ladderErrors[0], ladderErrors);
  if (body.milestones.some((m) => m.payout > body.totalBudget)) {
    throw new HttpError(400, "A milestone payout cannot be bigger than the total budget.");
  }
  const campaign = await Campaign.create({ ...body, brand: req.user!.id });
  res.status(201).json({ campaign: campaignView(campaign) });
});

/** Brand: own campaigns with budget spent vs remaining and submission counts. */
campaignsRouter.get("/mine", requireAuth, requireRole("brand"), async (req, res) => {
  const campaigns = await Campaign.find({ brand: req.user!.id }).sort({ createdAt: -1 });
  const counts = await Submission.aggregate([
    { $match: { campaign: { $in: campaigns.map((c) => c._id) } } },
    { $group: { _id: "$campaign", submissions: { $sum: 1 }, flagged: { $sum: { $cond: ["$flagged", 1, 0] } } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));
  res.json({
    campaigns: campaigns.map((c) => ({
      ...campaignView(c),
      submissionCount: byId.get(String(c._id))?.submissions ?? 0,
      flaggedCount: byId.get(String(c._id))?.flagged ?? 0,
    })),
  });
});

/** Creator: all live campaigns (budget not yet exhausted). */
campaignsRouter.get("/", requireAuth, requireRole("creator"), async (_req, res) => {
  const campaigns = await Campaign.find({ $expr: { $lt: ["$spent", "$totalBudget"] } })
    .sort({ createdAt: -1 })
    .populate("brand", "name");
  res.json({ campaigns: campaigns.map(campaignView) });
});

/** Brand: submissions of one of their campaigns. */
campaignsRouter.get("/:id/submissions", requireAuth, requireRole("brand"), async (req, res) => {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "Campaign not found.");
  const campaign = await Campaign.findOne({ _id: id, brand: req.user!.id });
  if (!campaign) throw new HttpError(404, "Campaign not found.");
  const subs = await Submission.find({ campaign: id }).sort({ createdAt: -1 }).populate("creator", "name").populate("campaign", "name platform");
  res.json({ campaign: campaignView(campaign), submissions: subs.map(submissionView) });
});

/** Creator: submit a post link to a live campaign. */
campaignsRouter.post("/:id/submissions", requireAuth, requireRole("creator"), async (req, res) => {
  const id = String(req.params.id);
  const { postUrl } = postUrlSchema.parse(req.body);
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, "Campaign not found.");
  const campaign = await Campaign.findById(id);
  if (!campaign) throw new HttpError(404, "Campaign not found.");
  if (campaign.spent >= campaign.totalBudget) throw new HttpError(409, "This campaign has run out of budget.");

  const host = new URL(postUrl).hostname.replace(/^www\./, "").replace(/^m\./, "");
  const okHosts = campaign.platform === "Instagram" ? ["instagram.com"] : ["youtube.com", "youtu.be"];
  if (!okHosts.includes(host)) throw new HttpError(400, `This campaign takes ${campaign.platform} links (${okHosts.join(" or ")}).`);

  try {
    const sub = await Submission.create({ campaign: id, creator: req.user!.id, postUrl });
    res.status(201).json({ submission: submissionView(sub) });
  } catch (err: any) {
    if (err?.code === 11000) throw new HttpError(409, "This post is already submitted to this campaign.");
    throw err;
  }
});
