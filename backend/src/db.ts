import mongoose from "mongoose";
import { config } from "./config";
import { Campaign } from "./models/Campaign";
import { Submission } from "./models/Submission";
import { User } from "./models/User";

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Connects once and reuses the connection. Serverless functions call this on every
 * request, but warm instances keep the cached connection so it only connects on a cold start.
 */
export function connectDb(uri: string = config.mongoUri): Promise<typeof mongoose> {
  if (!uri) throw new Error("MONGODB_URI (or MONGODB_USER, MONGODB_PASSWORD, MONGODB_HOST) is not set.");
  if (!connecting) {
    connecting = mongoose
      .connect(uri, { dbName: config.dbName, serverSelectionTimeoutMS: 15000 })
      .then(async (m) => {
        // Make sure unique indexes exist (email, and campaign + post link).
        await Promise.all([User.init(), Campaign.init(), Submission.init()]);
        return m;
      })
      .catch((err) => {
        connecting = null; // allow a retry on the next request
        throw err;
      });
  }
  return connecting;
}
