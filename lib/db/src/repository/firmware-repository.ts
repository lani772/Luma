import { eq } from "drizzle-orm";
import { db as pgDb } from "../pg";
import {
  firmwareTable,
  firmwareJobsTable,
  type InsertFirmware,
  type InsertFirmwareJob,
  type FirmwareRecord,
  type FirmwareJob,
} from "../schema/firmware";
import { getMongo } from "../mongo";
import { logger } from "../logger";

export class FirmwareRepository {
  private get firmwareCol() {
    return getMongo()?.collection("firmware") ?? null;
  }
  private get jobsCol() {
    return getMongo()?.collection("firmware_jobs") ?? null;
  }

  // ─── Firmware records ────────────────────────────────────────────────────

  async upsertFirmware(record: InsertFirmware): Promise<FirmwareRecord> {
    const [result] = await pgDb
      .insert(firmwareTable)
      .values(record)
      .onConflictDoUpdate({
        target: firmwareTable.id,
        set: {
          version: record.version,
          checksum: record.checksum,
          size: record.size,
          releaseDate: record.releaseDate,
          stable: record.stable,
        },
      })
      .returning();

    const col = this.firmwareCol;
    if (col) {
      const { id, ...rest } = record;
      col
        .updateOne(
          { _id: id as never },
          { $set: { ...rest, updatedAt: new Date() } },
          { upsert: true },
        )
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] firmware upsert failed"));
    }

    return result!;
  }

  async findFirmwareByDeviceId(deviceId: string): Promise<FirmwareRecord[]> {
    return pgDb.select().from(firmwareTable).where(eq(firmwareTable.deviceId, deviceId));
  }

  async findAllFirmware(): Promise<FirmwareRecord[]> {
    return pgDb.select().from(firmwareTable);
  }

  // ─── Firmware jobs ───────────────────────────────────────────────────────

  async upsertJob(job: InsertFirmwareJob): Promise<FirmwareJob> {
    const [result] = await pgDb
      .insert(firmwareJobsTable)
      .values(job)
      .onConflictDoUpdate({
        target: firmwareJobsTable.jobId,
        set: {
          status: job.status,
          progress: job.progress,
          updatedAt: new Date(),
        },
      })
      .returning();

    const col = this.jobsCol;
    if (col) {
      const { jobId, ...rest } = job;
      col
        .updateOne(
          { _id: jobId as never },
          { $set: { ...rest, updatedAt: new Date() } },
          { upsert: true },
        )
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] firmware job upsert failed"));
    }

    return result!;
  }

  async updateJobStatus(jobId: string, status: string, progress: number): Promise<void> {
    const now = new Date();
    await pgDb
      .update(firmwareJobsTable)
      .set({ status, progress, updatedAt: now })
      .where(eq(firmwareJobsTable.jobId, jobId));

    const col = this.jobsCol;
    if (col) {
      col
        .updateOne({ _id: jobId as never }, { $set: { status, progress, updatedAt: now } })
        .catch((e: unknown) => logger.warn({ err: e }, "[MongoDB] job status update failed"));
    }
  }

  async findAllJobs(): Promise<FirmwareJob[]> {
    return pgDb.select().from(firmwareJobsTable);
  }

  async findJobById(jobId: string): Promise<FirmwareJob | null> {
    const rows = await pgDb
      .select()
      .from(firmwareJobsTable)
      .where(eq(firmwareJobsTable.jobId, jobId))
      .limit(1);
    return rows[0] ?? null;
  }
}

export const firmwareRepository = new FirmwareRepository();
