import { MongoClient, type Db } from "mongodb";
import { logger } from "./logger";

let client: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function connectMongo(): Promise<Db | null> {
  const url = process.env.MONGODB_URL;
  if (!url) {
    logger.warn("[MongoDB] MONGODB_URL not set — dual-write disabled, PostgreSQL only");
    return null;
  }
  if (mongoDb) return mongoDb;

  try {
    client = new MongoClient(url);
    await client.connect();
    mongoDb = client.db(process.env.MONGODB_DB_NAME ?? "luma");
    logger.info("[MongoDB] connected");
    return mongoDb;
  } catch (err) {
    logger.error({ err }, "[MongoDB] connection failed — continuing without MongoDB");
    return null;
  }
}

export function getMongo(): Db | null {
  return mongoDb;
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    mongoDb = null;
    logger.info("[MongoDB] disconnected");
  }
}
