import { Router } from "express";
import { z } from "zod";
import { Submission } from "../models/Submission";
import { requireAuth, requireRole } from "../middleware/auth";
import { applyViewsUpdate } from "../services/viewsService";
import { submissionView } from "../utils/serialize";

export const submissionsRouter = Router();

const viewsSchema = z.object({
  views: z.number({ error: "views must be a number" }).int("views must be a whole number").min(0, "views cannot be negative"),
});

/**
 * Simulates the platform (Instagram/YouTube) reporting a new view count.
 * The brief says no role check on this endpoint, so it is intentionally public.
 */
submissionsRouter.patch("/:id/views", async (req, res) => {
  const { views } = viewsSchema.parse(req.body);
  const result = await applyViewsUpdate(String(req.params.id), views);
  res.json(result);
});

/** Creator: their own submissions with earnings. */
submissionsRouter.get("/mine", requireAuth, requireRole("creator"), async (req, res) => {
  const subs = await Submission.find({ creator: req.user!.id }).sort({ createdAt: -1 }).populate("campaign", "name platform milestones");
  res.json({ submissions: subs.map(submissionView) });
});

/** Creator: total earnings across all posts. */
submissionsRouter.get("/earnings/total", requireAuth, requireRole("creator"), async (req, res) => {
  const subs = await Submission.find({ creator: req.user!.id });
  res.json({
    totalEarnings: subs.reduce((sum, s) => sum + s.paidOut, 0),
    submissionCount: subs.length,
  });
});


