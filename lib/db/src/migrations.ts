/**
 * Idempotent schema bootstrap for the Node.js engine layer.
 * Creates the engine_* tables if they do not already exist.
 * Called automatically at API Server startup — safe to run on every boot.
 */
import { pool } from "./pg";
import { logger } from "./logger";

const MIGRATIONS_SQL = `
-- ─── Engine device registry ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engine_devices (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  mac         TEXT NOT NULL,
  ip          TEXT,
  room        TEXT,
  floor       TEXT,
  firmware    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'offline',
  mqtt_topic  TEXT,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  state       JSONB NOT NULL DEFAULT '{}',
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Engine firmware catalog ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engine_firmware (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  version      TEXT NOT NULL,
  checksum     TEXT NOT NULL,
  size         INTEGER NOT NULL,
  release_date TEXT NOT NULL,
  stable       BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Engine firmware update jobs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engine_firmware_jobs (
  job_id          TEXT PRIMARY KEY,
  device_id       TEXT NOT NULL,
  target_version  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  progress        INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATIONS_SQL);
    logger.info("[DB] engine_* schema bootstrapped (CREATE TABLE IF NOT EXISTS)");
  } finally {
    client.release();
  }
}
