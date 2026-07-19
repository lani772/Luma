#!/usr/bin/env tsx
/**
 * Apply engine-layer schema to PostgreSQL directly (no TTY required).
 * Uses prefixed table names (engine_*) to avoid conflicts with the
 * Go cloud backend's own tables (devices, firmware, etc.).
 *
 * Run: cd /path/to/workspace && ./scripts/node_modules/.bin/tsx scripts/migrate.ts
 */
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

const sql = `
-- ─── Engine device registry ────────────────────────────────────────────────
-- Stores the Node.js API engine's device records (string IDs like ESP32_Lamp_01).
-- Separate from the Go cloud backend's "devices" table (UUID primary keys).
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

-- ─── Engine firmware catalog ───────────────────────────────────────────────
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

-- ─── Engine firmware update jobs ───────────────────────────────────────────
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

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL");
  await client.query(sql);
  console.log("✓ Tables created/verified: engine_devices, engine_firmware, engine_firmware_jobs");
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
