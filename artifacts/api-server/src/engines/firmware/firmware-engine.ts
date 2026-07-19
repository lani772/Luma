import { BaseEngine } from "../base-engine";
import type { EngineId, InternalMessage } from "../../internal-api/types";
import { logger } from "../../lib/logger";
import { firmwareRepository } from "@workspace/db";

interface FirmwareRecord {
  deviceId: string;
  version: string;
  checksum: string;
  size: number;
  releaseDate: string;
  stable: boolean;
}

interface FirmwareUpdateJob {
  jobId: string;
  deviceId: string;
  targetVersion: string;
  status: "pending" | "uploading" | "validating" | "applying" | "done" | "failed";
  progress: number;
  startedAt: string;
}

export class FirmwareEngine extends BaseEngine {
  readonly id: EngineId = "firmware_engine";
  readonly name = "Firmware Engine";
  readonly version = "1.0.0";
  readonly capabilities = [
    "firmware_management",
    "version_checking",
    "update_requests",
    "firmware_validation",
    "status_reporting",
    "ota_coordination",
  ];
  readonly subscribedActions = [
    "CHECK_FIRMWARE_VERSION",
    "REQUEST_UPDATE",
    "VALIDATE_FIRMWARE",
    "GET_FIRMWARE_STATUS",
    "UPLOAD_COMPLETE",
    "ROLLBACK_FIRMWARE",
  ];

  private firmwareRegistry: Map<string, FirmwareRecord> = new Map();
  private updateJobs: Map<string, FirmwareUpdateJob> = new Map();

  protected onStart(): void {
    this.seedRegistry();
  }

  protected onStop(): void {}

  protected async handleMessage(message: InternalMessage): Promise<void> {
    logger.debug({ action: message.action, source: message.source }, "[FirmwareEngine] received");

    switch (message.action) {
      case "CHECK_FIRMWARE_VERSION":
        this.handleCheckVersion(message);
        break;
      case "REQUEST_UPDATE":
        await this.handleRequestUpdate(message);
        break;
      case "VALIDATE_FIRMWARE":
        this.handleValidate(message);
        break;
      case "GET_FIRMWARE_STATUS":
        this.handleGetStatus(message);
        break;
      case "UPLOAD_COMPLETE":
        this.handleUploadComplete(message);
        break;
      case "ROLLBACK_FIRMWARE":
        this.handleRollback(message);
        break;
      default:
        logger.warn({ action: message.action }, "[FirmwareEngine] unknown action");
    }
  }

  private handleCheckVersion(message: InternalMessage): void {
    const { deviceId, currentVersion } = message.payload as {
      deviceId: string;
      currentVersion: string;
    };

    const latest = this.getLatestFirmware(deviceId);
    const updateAvailable = latest ? latest.version !== currentVersion : false;

    this.emit(
      message.source as EngineId,
      "FIRMWARE_VERSION_RESULT",
      {
        deviceId,
        currentVersion,
        latestVersion: latest?.version ?? currentVersion,
        updateAvailable,
        checksum: latest?.checksum ?? "",
        stable: latest?.stable ?? true,
      },
      "normal",
    );
  }

  private async handleRequestUpdate(message: InternalMessage): Promise<void> {
    const { deviceId, targetVersion, jobId: providedJobId } = message.payload as {
      deviceId: string;
      targetVersion: string;
      jobId?: string;
    };

    // Use the caller-supplied jobId (e.g. from the REST API/DB) so the
    // persisted record and the in-memory engine tracking share one identity.
    const jobId = providedJobId ?? `fw-job-${Date.now()}`;
    const job: FirmwareUpdateJob = {
      jobId,
      deviceId,
      targetVersion,
      status: "pending",
      progress: 0,
      startedAt: new Date().toISOString(),
    };
    this.updateJobs.set(jobId, job);

    // Persist to DB (best-effort; job may already exist from the API route)
    firmwareRepository.upsertJob({
      jobId,
      deviceId,
      targetVersion,
      status: "pending",
      progress: 0,
    }).catch((e: unknown) =>
      logger.warn({ err: e, jobId }, "[FirmwareEngine] persist job failed"),
    );

    this.send(
      "firmware_upload_engine",
      "UPLOAD_FIRMWARE_PACKAGE",
      { jobId, deviceId, targetVersion },
      "high",
    );

    logger.info({ jobId, deviceId, targetVersion }, "[FirmwareEngine] update job created");
  }

  private handleValidate(message: InternalMessage): void {
    const { checksum, deviceId } = message.payload as {
      checksum: string;
      deviceId: string;
    };
    const record = this.firmwareRegistry.get(deviceId);
    const valid = record?.checksum === checksum;

    this.emit(
      message.source as EngineId,
      "FIRMWARE_VALIDATION_RESULT",
      { deviceId, valid, checksum },
      "high",
    );
  }

  private handleGetStatus(message: InternalMessage): void {
    const { jobId } = message.payload as { jobId: string };
    const job = this.updateJobs.get(jobId);

    this.emit(
      message.source as EngineId,
      "FIRMWARE_STATUS",
      job ? { ...job } : { jobId, status: "not_found" },
      "normal",
    );
  }

  private handleUploadComplete(message: InternalMessage): void {
    const { jobId, success } = message.payload as { jobId: string; success: boolean };
    const job = this.updateJobs.get(jobId);

    if (!job) return;

    job.status = success ? "done" : "failed";
    job.progress = success ? 100 : job.progress;

    // Persist final status so REST polling reflects the outcome
    firmwareRepository.updateJobStatus(jobId, job.status, job.progress).catch((e: unknown) =>
      logger.warn({ err: e, jobId }, "[FirmwareEngine] persist job status failed"),
    );

    if (success) {
      this.emit("device_engine", "FIRMWARE_UPDATED", {
        deviceId: job.deviceId,
        newVersion: job.targetVersion,
        jobId,
      }, "high");
      logger.info({ jobId, deviceId: job.deviceId }, "[FirmwareEngine] update completed");
    } else {
      logger.warn({ jobId }, "[FirmwareEngine] upload failed");
    }
  }

  private handleRollback(message: InternalMessage): void {
    const { deviceId, version } = message.payload as { deviceId: string; version: string };
    logger.info({ deviceId, version }, "[FirmwareEngine] rollback requested");

    this.send("firmware_upload_engine", "ROLLBACK_TO_VERSION", { deviceId, version }, "critical");
  }

  private getLatestFirmware(deviceId: string): FirmwareRecord | null {
    return this.firmwareRegistry.get(deviceId) ?? null;
  }

  private seedRegistry(): void {
    const defaults: FirmwareRecord[] = [
      { deviceId: "ESP32_DEFAULT", version: "2.1.0", checksum: "abc123def456", size: 512000, releaseDate: "2025-01-15", stable: true },
      { deviceId: "ESP32_LAMP", version: "1.8.3", checksum: "fed987cba654", size: 480000, releaseDate: "2025-01-10", stable: true },
      { deviceId: "ESP32_SENSOR", version: "1.5.1", checksum: "123abc789xyz", size: 320000, releaseDate: "2025-01-08", stable: true },
    ];
    defaults.forEach((r) => this.firmwareRegistry.set(r.deviceId, r));
  }

  getUpdateJob(jobId: string): FirmwareUpdateJob | undefined {
    return this.updateJobs.get(jobId);
  }

  getAllJobs(): FirmwareUpdateJob[] {
    return [...this.updateJobs.values()];
  }
}

export const firmwareEngine = new FirmwareEngine();
