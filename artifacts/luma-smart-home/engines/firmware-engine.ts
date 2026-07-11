import { gateway } from "./internal-api/gateway";
import type { EngineId, InternalMessage } from "./internal-api/types";

export interface FirmwareVersion {
  deviceId: string;
  version: string;
  checksum: string;
  releaseDate: string;
  stable: boolean;
}

export interface UpdateJob {
  jobId: string;
  deviceId: string;
  targetVersion: string;
  progress: number;
  status: string;
}

export class MobileFirmwareEngine {
  private token: string = "";
  private jobs: Map<string, UpdateJob> = new Map();
  private onUpdateProgress?: (job: UpdateJob) => void;
  private onUpdateComplete?: (job: UpdateJob) => void;

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "firmware_engine",
        name: "Firmware Engine",
        version: "1.0.0",
        capabilities: ["firmware_management", "version_checking", "ota_coordination"],
        subscribedActions: [
          "FIRMWARE_VERSION_RESULT",
          "FIRMWARE_VALIDATION_RESULT",
          "FIRMWARE_STATUS",
          "FIRMWARE_UPDATED",
          "UPLOAD_PROGRESS",
          "ROLLBACK_COMPLETE",
        ],
      },
      (msg) => this.handleMessage(msg),
    );
  }

  stop(): void {
    gateway.unregisterEngine("firmware_engine", this.token);
  }

  checkFirmwareVersion(deviceId: string, currentVersion: string): void {
    gateway.sendCommand("firmware_engine", "firmware_engine", "CHECK_FIRMWARE_VERSION", {
      deviceId,
      currentVersion,
    });
  }

  requestUpdate(deviceId: string, targetVersion: string): void {
    gateway.sendCommand("firmware_engine", "firmware_engine", "REQUEST_UPDATE", {
      deviceId,
      targetVersion,
    });
  }

  onProgress(cb: (job: UpdateJob) => void): void { this.onUpdateProgress = cb; }
  onComplete(cb: (job: UpdateJob) => void): void { this.onUpdateComplete = cb; }

  getJobs(): UpdateJob[] { return [...this.jobs.values()]; }

  private handleMessage(message: InternalMessage): void {
    switch (message.action) {
      case "UPLOAD_PROGRESS": {
        const p = message.payload as unknown as UpdateJob;
        this.jobs.set(p.jobId, p);
        this.onUpdateProgress?.(p);
        break;
      }
      case "FIRMWARE_UPDATED":
      case "ROLLBACK_COMPLETE": {
        const j = message.payload as unknown as UpdateJob;
        if (j.jobId) {
          const job = this.jobs.get(j.jobId);
          if (job) { job.status = "done"; job.progress = 100; this.onUpdateComplete?.(job); }
        }
        break;
      }
    }
  }
}

export const mobileFirmwareEngine = new MobileFirmwareEngine();
