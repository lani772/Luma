import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devicesTable = pgTable("engine_devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  mac: text("mac").notNull(),
  ip: text("ip"),
  room: text("room"),
  floor: text("floor"),
  firmware: text("firmware").notNull(),
  status: text("status").notNull().default("offline"),
  mqttTopic: text("mqtt_topic"),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  state: jsonb("state").notNull().default({}),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
