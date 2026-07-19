import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const firmwareTable = pgTable("engine_firmware", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  version: text("version").notNull(),
  checksum: text("checksum").notNull(),
  size: integer("size").notNull(),
  releaseDate: text("release_date").notNull(),
  stable: boolean("stable").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const firmwareJobsTable = pgTable("engine_firmware_jobs", {
  jobId: text("job_id").primaryKey(),
  deviceId: text("device_id").notNull(),
  targetVersion: text("target_version").notNull(),
  status: text("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFirmwareSchema = createInsertSchema(firmwareTable).omit({ createdAt: true });
export type InsertFirmware = z.infer<typeof insertFirmwareSchema>;
export type FirmwareRecord = typeof firmwareTable.$inferSelect;

export const insertFirmwareJobSchema = createInsertSchema(firmwareJobsTable).omit({
  startedAt: true,
  updatedAt: true,
});
export type InsertFirmwareJob = z.infer<typeof insertFirmwareJobSchema>;
export type FirmwareJob = typeof firmwareJobsTable.$inferSelect;
