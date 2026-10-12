import { Schema, model } from "mongoose";

const submissionSchema = new Schema(
  {
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    postUrl: { type: String, required: true, trim: true },
    views: { type: Number, required: true, default: 0, min: 0 },
    /** Total paid to the creator for this post so far. */
    paidOut: { type: Number, required: true, default: 0, min: 0 },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String },
  },
  { timestamps: true }
);

// The same post cannot be submitted twice to the same campaign.
submissionSchema.index({ campaign: 1, postUrl: 1 }, { unique: true });

export const Submission = model("Submission", submissionSchema);
