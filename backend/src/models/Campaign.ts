import { Schema, model } from "mongoose";

const milestoneSchema = new Schema(
  {
    views: { type: Number, required: true },
    payout: { type: Number, required: true },
  },
  { _id: false }
);

const campaignSchema = new Schema(
  {
    brand: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    platform: { type: String, enum: ["Instagram", "YouTube"], required: true },
    totalBudget: { type: Number, required: true, min: 1 },
    /** Total paid out so far. Only ever changed with atomic updates (see viewsService). */
    spent: { type: Number, required: true, default: 0, min: 0 },
    milestones: { type: [milestoneSchema], required: true },
  },
  { timestamps: true }
);

export const Campaign = model("Campaign", campaignSchema);
