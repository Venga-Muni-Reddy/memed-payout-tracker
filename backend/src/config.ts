import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  mongoUri: process.env.MONGODB_URI ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  nodeEnv: process.env.NODE_ENV ?? "development",
  dbName: process.env.MONGODB_DB ?? "memed",
};

if (config.nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production.");
}
