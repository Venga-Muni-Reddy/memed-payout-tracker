import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../src/app";
import { connectDb } from "../src/db";

/**
 * Vercel serverless entry point. vercel.json rewrites every path to this file,
 * and the same Express app used locally handles the request.
 */
const app = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await connectDb();
  } catch (err) {
    console.error("Database connection failed:", err);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Database unavailable. Please try again shortly." }));
    return;
  }
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
