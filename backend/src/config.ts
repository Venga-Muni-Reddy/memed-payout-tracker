import dotenv from "dotenv";

dotenv.config({ quiet: true });

function buildMongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const { MONGODB_USER: user, MONGODB_PASSWORD: pass, MONGODB_HOST: host } = process.env;
  if (!user || !pass || !host) return "";
  return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/?retryWrites=true&w=majority`;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  mongoUri: buildMongoUri(),
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  nodeEnv: process.env.NODE_ENV ?? "development",
  dbName: process.env.MONGODB_DB ?? "memed",
};

if (config.nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production.");
}
