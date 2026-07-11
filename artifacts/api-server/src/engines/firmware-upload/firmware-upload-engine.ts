import { BaseEngine } from "../base-engine";
import type { EngineId, InternalMessage } from "../../internal-api/types";
import { logger } from "../../lib/logger";

export type UploadMethod = "ota" | "usb";

export interface UploadJob {
  jobId: string;
  deviceId: string;
  firmwareVersion: string;
  method: UploadMethod;
  status: "preparing" | "uploading" | "verifying" | "applying" | "done" | "failed" | "rolled_back";
  progress: number;
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string;
  previousVersion?: string;
}

export class FirmwareUploadEngine extends BaseEngine {
  readonly id: EngineId = "firmware_upload_engine";
  readonly name = "Firmware Upload Engine";
  readonly version = "1.0.0";
  readonly capabilities = [
    "firmware_package_handling",
    "ota_upload",
    "usb_flashing",
    "firmware_verification",
    "upload_progress_tracking",
    "rollback_support",
  ];
  readonly subscribedActions = [
    "UPLOAD_FIRMWARE_PACKAGE",
    "OTA_UPDATE",
    "USB_FLASH",
    "ROLLBACK_TO_VERSION",
    "GET_UPLOAD_STATUS",
    "CANCEL_UPLOAD",
    "USB_FLASH_COMPLETE",
  ];

  private jobs: Map<string, UploadJob> = new Map();
  private rollbackVersions: Map<string, string> = new Map();

  protected onStart(): void {}
  protected onStop(): void {}

  protected handleMessage(message: InternalMessage): void {
    logger.debug({ action: message.action }, "[FirmwareUploadEngine] received");

    switch (message.action) {
      case "UPLOAD_FIRMWARE_PACKAGE":
        this.handleUploadPackage(message);
        break;
      case "OTA_UPDATE":
        this.handleOTAUpdate(message);
        break;
      case "USB_FLASH":
        this.handleUSBFlash(message);
        break;
      case "ROLLBACK_TO_VERSION":
        this.handleRollback(message);
        break;
      case "GET_UPLOAD_STATUS":
        this.handleGetStatus(message);
        break;
      case "CANCEL_UPLOAD":
        this.handleCancel(message);
        break;
      case "USB_FLASH_COMPLETE":
        this.handleUSBFlashComplete(message);
        break;
      default:
        logger.warn({ action: message.action }, "[FirmwareUploadEngine] unknown action");
    }
  }

  private handleUploadPackage(message: InternalMessage): void {
    const { jobId, deviceId, targetVersion } = message.payload as {
      jobId: string;
      deviceId: string;
      targetVersion: string;
    };

    const job: UploadJob = {
      jobId,
      deviceId,
      firmwareVersion: targetVersion,
      method: "ota",
      status: "preparing",
      progress: 0,
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);
    logger.info({ jobId, deviceId }, "[FirmwareUploadEngine] OTA job started");

    this.simulateOTAProgress(job);
  }

  private handleOTAUpdate(message: InternalMessage): void {
    const { deviceId, version, currentVersion } = message.payload as {
      deviceId: string;
      version: string;
      currentVersion?: string;
    };

    const jobId = `ota-${Date.now()}`;
    if (currentVersion) this.rollbackVersions.set(deviceId, currentVersion);

    const job: UploadJob = {
      jobId,
      deviceId,
      firmwareVersion: version,
      method: "ota",
      status: "preparing",
      progress: 0,
      startedAt: new Date().toISOString(),
      previousVersion: currentVersion,
    };
    this.jobs.set(jobId, job);
    this.simulateOTAProgress(job);
  }

  private handleUSBFlash(message: InternalMessage): void {
    const { deviceId, version, portPath } = message.payload as {
      deviceId: string;
      version: string;
      portPath: string;
    };

    const jobId = `usb-${Date.now()}`;
    const job: UploadJob = {
      jobId,
      deviceId,
      firmwareVersion: version,
      method: "usb",
      status: "preparing",
      progress: 0,
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);

    this.send("usb_engine", "FLASH_FIRMWARE", { portPath, firmwarePath: `fw_${version}.bin`, deviceId }, "high");
    logger.info({ jobId, portPath }, "[FirmwareUploadEngine] USB flash delegated");
  }

  private handleUSBFlashComplete(message: InternalMessage): void {
    const { deviceId, success } = message.payload as { deviceId: string; success: boolean };
    const job = [...this.jobs.values()].find(
      (j) => j.deviceId === deviceId && j.method === "usb",
    );
    if (!job) return;

    job.status = success ? "done" : "failed";
    job.progress = success ? 100 : job.progress;
    job.finishedAt = new Date().toISOString();

    this.emit("firmware_engine", "UPLOAD_COMPLETE", { jobId: job.jobId, success }, "high");
    logger.info({ jobId: job.jobId, success }, "[FirmwareUploadEngine] USB flash finished");
  }

  private handleRollback(message: InternalMessage): void {
    const { deviceId, version } = message.payload as { deviceId: string; version: string };
    const jobId = `rollback-${Date.now()}`;
    const job: UploadJob = {
      jobId,
      deviceId,
      firmwareVersion: version,
      method: "ota",
      status: "preparing",
      progress: 0,
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, job);

    this.simulateOTAProgress(job, true);
    logger.info({ deviceId, version }, "[FirmwareUploadEngine] rollback started");
  }

  private handleGetStatus(message: InternalMessage): void {
    const { jobId } = message.payload as { jobId?: string };
    if (jobId) {
      const job = this.jobs.get(jobId);
      this.emit(message.source as EngineId, "UPLOAD_STATUS", job ? { job } : { error: "not_found", jobId }, "normal");
    } else {
      this.emit(message.source as EngineId, "UPLOAD_STATUS", { jobs: [...this.jobs.values()] }, "normal");
    }
  }

  private handleCancel(message: InternalMessage): void {
    const { jobId } = message.payload as { jobId: string };
    const job = this.jobs.get(jobId);
    if (job && job.status !== "done") {
      job.status = "failed";
      job.errorMessage = "cancelled_by_user";
      job.finishedAt = new Date().toISOString();
    }
  }

  private simulateOTAProgress(job: UploadJob, isRollback = false): void {
    const steps: UploadJob["status"][] = ["preparing", "uploading", "verifying", "applying", "done"];
    const progressMap = [0, 25, 60, 85, 100];
    let step = 0;

    const advance = () => {
      if (step >= steps.length) return;
      job.status = steps[step];
      job.progress = progressMap[step];

      this.broadcast("UPLOAD_PROGRESS", {
        jobId: job.jobId,
        deviceId: job.deviceId,
        status: job.status,
        progress: job.progress,
        method: job.method,
        isRollback,
      }, "normal");

      if (job.status === "done") {
        job.finishedAt = new Date().toISOString();
        this.emit("firmware_engine", "UPLOAD_COMPLETE", { jobId: job.jobId, success: true }, "high");

        if (isRollback) {
          this.broadcast("ROLLBACK_COMPLETE", { deviceId: job.deviceId, version: job.firmwareVersion }, "high");
        }
        logger.info({ jobId: job.jobId }, "[FirmwareUploadEngine] OTA complete");
      } else {
        step++;
        setTimeout(advance, 1_000);
      }
    };

    setTimeout(advance, 500);
  }

  getJob(jobId: string): UploadJob | undefined { return this.jobs.get(jobId); }
  getAllJobs(): UploadJob[] { return [...this.jobs.values()]; }
}

export const firmwareUploadEngine = new FirmwareUploadEngine();
