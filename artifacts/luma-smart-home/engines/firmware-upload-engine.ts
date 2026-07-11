import { gateway } from "./internal-api/gateway";
import type { InternalMessage } from "./internal-api/types";

export interface MobileUploadJob {
  jobId: string;
  deviceId: string;
  version: string;
  method: "ota" | "usb";
  progress: number;
  status: string;
  startedAt: string;
}

type ProgressHandler = (job: MobileUploadJob) => void;
type CompleteHandler = (job: MobileUploadJob, success: boolean) => void;

export class MobileFirmwareUploadEngine {
  private token: string = "";
  private jobs: Map<string, MobileUploadJob> = new Map();
  private onProgress?: ProgressHandler;
  private onComplete?: CompleteHandler;

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "firmware_upload_engine",
        name: "Firmware Upload Engine",
        version: "1.0.0",
        capabilities: [
          "ota_upload",
          "usb_flashing",
          "firmware_verification",
          "upload_progress",
          "rollback_support",
        ],
        subscribedActions: [
          "UPLOAD_PROGRESS",
          "UPLOAD_STATUS",
          "ROLLBACK_COMPLETE",
          "FLASH_PROGRESS",
          "FLASH_COMPLETE",
        ],
      },
      (msg) => this.handleMessage(msg),
    );
  }

  stop(): void {
    gateway.unregisterEngine("firmware_upload_engine", this.token);
  }

  startOTAUpdate(deviceId: string, version: string, currentVersion?: string): void {
    gateway.sendCommand(
      "firmware_upload_engine",
      "firmware_upload_engine",
      "OTA_UPDATE",
      { deviceId, version, currentVersion },
      "high",
    );
  }

  startUSBFlash(deviceId: string, version: string, portPath: string): void {
    gateway.sendCommand(
      "firmware_upload_engine",
      "firmware_upload_engine",
      "USB_FLASH",
      { deviceId, version, portPath },
      "high",
    );
  }

  rollback(deviceId: string, version: string): void {
    gateway.sendCommand(
      "firmware_upload_engine",
      "firmware_engine",
      "ROLLBACK_FIRMWARE",
      { deviceId, version },
      "critical",
    );
  }

  cancelJob(jobId: string): void {
    gateway.sendCommand("firmware_upload_engine", "firmware_upload_engine", "CANCEL_UPLOAD", { jobId });
  }

  onProgressUpdate(cb: ProgressHandler): void { this.onProgress = cb; }
  onJobComplete(cb: CompleteHandler): void { this.onComplete = cb; }
  getJobs(): MobileUploadJob[] { return [...this.jobs.values()]; }

  private handleMessage(message: InternalMessage): void {
    const p = message.payload as Record<string, unknown>;
    switch (message.action) {
      case "UPLOAD_PROGRESS":
      case "FLASH_PROGRESS": {
        const job = this.upsertJob(p);
        this.onProgress?.(job);
        break;
      }
      case "UPLOAD_STATUS":
        if (p["job"]) {
          this.upsertJob(p["job"] as Record<string, unknown>);
        }
        break;
      case "ROLLBACK_COMPLETE":
      case "FLASH_COMPLETE": {
        const jobId = p["jobId"] as string | undefined;
        if (jobId) {
          const job = this.jobs.get(jobId);
          if (job) {
            job.status = "done";
            job.progress = 100;
            this.onComplete?.(job, true);
          }
        }
        break;
      }
    }
  }

  private upsertJob(p: Record<string, unknown>): MobileUploadJob {
    const jobId = (p["jobId"] as string) ?? `job-${Date.now()}`;
    const existing = this.jobs.get(jobId);
    const job: MobileUploadJob = existing ?? {
      jobId,
      deviceId: p["deviceId"] as string ?? "",
      version: p["firmwareVersion"] as string ?? "",
      method: (p["method"] as "ota" | "usb") ?? "ota",
      progress: 0,
      status: "pending",
      startedAt: new Date().toISOString(),
    };
    job.progress = (p["progress"] as number) ?? job.progress;
    job.status = (p["status"] as string) ?? job.status;
    this.jobs.set(jobId, job);
    return job;
  }
}

export const mobileFirmwareUploadEngine = new MobileFirmwareUploadEngine();
