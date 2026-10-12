import mongoose from "mongoose";
import { createApp } from "./app";
import { config } from "./config";

async function resolveMongoUri(): Promise<string> {
  if (config.mongoUri) return config.mongoUri;
  if (config.nodeEnv === "production") throw new Error("MONGODB_URI is required in production.");
  // Dev convenience: no URI given, so start a throwaway in-memory MongoDB.
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  console.log("No MONGODB_URI set - using an in-memory MongoDB (data is lost on restart).");
  return mem.getUri("memed");
}

async function main() {
  await mongoose.connect(await resolveMongoUri(), { dbName: config.dbName, serverSelectionTimeoutMS: 15000 });
  await mongoose.syncIndexes();
  createApp().listen(config.port, () => console.log(`API listening on :${config.port}`));
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
