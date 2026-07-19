import app from "./app";
import { logger } from "./lib/logger";
import { startAllEngines } from "./engines";
import { connectMongo, runMigrations } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  // 1. Ensure engine_* tables exist (idempotent, safe on every boot)
  await runMigrations();

  // 2. Connect MongoDB for optional dual-write (graceful no-op if unset)
  connectMongo().catch((err: unknown) =>
    logger.warn({ err }, "MongoDB connection attempt failed"),
  );

  // 3. Boot all engines (device, firmware, wifi, mqtt, usb, firmware-upload)
  startAllEngines();

  // 4. Start HTTP server
  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err?: Error) => {
      if (err) { reject(err); return; }
      logger.info({ port }, "Server listening");
      resolve();
    });
  });
}

start().catch((err: unknown) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
