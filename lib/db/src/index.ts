// PostgreSQL (Drizzle)
export { pool, db } from "./pg";

// MongoDB (optional dual-write)
export { connectMongo, getMongo, disconnectMongo } from "./mongo";

// Schema bootstrapping
export { runMigrations } from "./migrations";

// Schema types
export * from "./schema";

// Repositories (dual-write: PG primary + MongoDB mirror)
export { deviceRepository, DeviceRepository } from "./repository/device-repository";
export { firmwareRepository, FirmwareRepository } from "./repository/firmware-repository";
