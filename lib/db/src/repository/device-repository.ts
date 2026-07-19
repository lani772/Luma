import { eq } from "drizzle-orm";
import { db as pgDb } from "../pg";
import { devicesTable, type InsertDevice, type Device } from "../schema/devices";
import { getMongo } from "../mongo";
import { logger } from "../logger";

const COLLECTION = "devices";

export class DeviceRepository {
  private get col() {
    return getMongo()?.collection(COLLECTION) ?? null;
  }

  async upsert(device: InsertDevice): Promise<Device> {
    const now = new Date();
    const [result] = await pgDb
      .insert(devicesTable)
      .values({ ...device, lastSeen: device.lastSeen ?? now })
      .onConflictDoUpdate({
        target: devicesTable.id,
        set: {
          name: device.name,
          type: device.type,
          mac: device.mac,
          ip: device.ip,
          room: device.room,
          floor: device.floor,
          firmware: device.firmware,
          status: device.status,
          mqttTopic: device.mqttTopic,
          lastSeen: device.lastSeen ?? now,
          state: device.state,
          config: device.config,
          updatedAt: now,
        },
      })
      .returning();

    // Dual-write to MongoDB (best-effort)
    const col = this.col;
    if (col) {
      const { id, ...rest } = device;
      col
        .updateOne(
          { _id: id as never },
          { $set: { ...rest, updatedAt: now } },
          { upsert: true },
        )
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] device upsert failed"));
    }

    return result!;
  }

  async findById(id: string): Promise<Device | null> {
    const rows = await pgDb
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findAll(): Promise<Device[]> {
    return pgDb.select().from(devicesTable);
  }

  async delete(id: string): Promise<void> {
    await pgDb.delete(devicesTable).where(eq(devicesTable.id, id));
    const col = this.col;
    if (col) {
      col
        .deleteOne({ _id: id as never })
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] device delete failed"));
    }
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const now = new Date();
    await pgDb
      .update(devicesTable)
      .set({ status, lastSeen: now, updatedAt: now })
      .where(eq(devicesTable.id, id));
    const col = this.col;
    if (col) {
      col
        .updateOne({ _id: id as never }, { $set: { status, lastSeen: now, updatedAt: now } })
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] status update failed"));
    }
  }

  async updateState(id: string, state: Record<string, unknown>): Promise<void> {
    const now = new Date();
    await pgDb
      .update(devicesTable)
      .set({ state, lastSeen: now, updatedAt: now })
      .where(eq(devicesTable.id, id));
    const col = this.col;
    if (col) {
      col
        .updateOne({ _id: id as never }, { $set: { state, lastSeen: now, updatedAt: now } })
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] state update failed"));
    }
  }

  async updateConfig(id: string, config: Record<string, unknown>): Promise<void> {
    const now = new Date();
    await pgDb
      .update(devicesTable)
      .set({ config, updatedAt: now })
      .where(eq(devicesTable.id, id));
    const col = this.col;
    if (col) {
      col
        .updateOne({ _id: id as never }, { $set: { config, updatedAt: now } })
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] config update failed"));
    }
  }

  async updateFirmwareVersion(id: string, firmware: string): Promise<void> {
    const now = new Date();
    await pgDb
      .update(devicesTable)
      .set({ firmware, updatedAt: now })
      .where(eq(devicesTable.id, id));
    const col = this.col;
    if (col) {
      col
        .updateOne({ _id: id as never }, { $set: { firmware, updatedAt: now } })
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] firmware version update failed"));
    }
  }
}

export const deviceRepository = new DeviceRepository();
