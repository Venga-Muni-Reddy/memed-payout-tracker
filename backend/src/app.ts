import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { config } from "./config";
import { authRouter } from "./routes/auth";
import { campaignsRouter } from "./routes/campaigns";
import { submissionsRouter } from "./routes/submissions";
import { HttpError } from "./utils/errors";

export function createApp() {
  const app = express();
  const origins = config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((s) => s.trim());
  app.use(cors({ origin: origins }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/submissions", submissionsRouter);

  app.use((_req, _res, next) => next(new HttpError(404, "Route not found.")));

  // Central error handler: validation -> 400, HttpError -> its status, anything else -> 500.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input", details: err.issues });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    if (err instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON body." });
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });
  return app;
}
