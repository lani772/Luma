// Firmware Engine — OTA update orchestration, version checking, rollback
// Spec: docs/mobile-core-engine/FirmwareEngine.md
// Generalizes existing firmware-engine.ts + firmware-upload-engine.ts.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { EventEngine } from "./EventEngine";
import type { DatabaseEngine } from "./DatabaseEngine";

export type FirmwareJobStatus =
  | "idle" | "checking" | "available" | "downloading" | "flashing" | "verifying"
  | "success" | "failed" | "rolled_back";

export interface FirmwareVersion {
  version: string;
  releaseDate: string;
  notes: string;
  downloadUrl: string;
  checksum: string;
  size: number;
}

export interface FirmwareJob {
  id: string;
  deviceId: string;
  targetVersion: string;
  currentVersion: string;
  status: FirmwareJobStatus;
  progressPct: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
  rollbackVersion?: string;
}

export type FirmwareJobHandler = (job: FirmwareJob) => void;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000; // 24 hours

export class FirmwareEngine implements IEngine {
  readonly id: CoreEngineId = "firmware_engine";
  readonly name = "Firmware Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["ota-update", "version-check", "rollback", "job-tracking"];
  readonly dependencies: CoreEngineId[] = ["event_engine", "database_engine"];
  readonly optional = true;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _checkTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  private _jobs: Map<string, FirmwareJob> = new Map();   // jobId → job
  private _listeners: Set<FirmwareJobHandler> = new Set();
  private _knownVersions: Map<string, FirmwareVersion[]> = new Map(); // deviceId → available versions

  constructor(private events: EventEngine, private db: DatabaseEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    await this._loadJobs();

    this._checkTimer = setInterval(() => void this.checkAll(), CHECK_INTERVAL_MS);
    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    if (this._checkTimer) clearInterval(this._checkTimer);
    await this._persistJobs();
    this._listeners.clear();
    this._status = "stopped";
  }

  getHealth(): EngineHealthInfo {
    return {
      id: this.id, name: this.name, version: this.version,
      status: this._status,
      startedAt: this._startedAt?.toISOString() ?? null,
      uptimeMs: this._startedAt ? Date.now() - this._startedAt.getTime() : 0,
      lastHeartbeatAt: this._lastHeartbeat?.toISOString() ?? null,
      messagesSent: this._messagesSent,
      messagesReceived: this._messagesReceived,
      errorCount: this._errorCount,
      lastError: this._lastError,
    };
  }

  handleMessage(message: CoreMessage): void {
    this._messagesReceived++;
    switch (message.action) {
      case "FIRMWARE_CHECK":
        void this.checkForUpdates(message.payload.deviceId as string);
        break;
      case "FIRMWARE_UPDATE_START":
        void this.startUpdate(message.payload.deviceId as string, message.payload.targetVersion as string);
        break;
      case "FIRMWARE_ROLLBACK":
        void this.rollback(message.payload.jobId as string);
        break;
      case "FIRMWARE_CANCEL":
        this.cancelJob(message.payload.jobId as string);
        break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Check for updates on all known devices. */
  async checkAll(): Promise<void> {
    this.events.emit("firmware_engine", "FIRMWARE_CHECK_ALL_STARTED", {});
    // Emit for each registered device (in production: fetches from device/cloud)
    this.events.emit("firmware_engine", "FIRMWARE_CHECK_ALL_COMPLETE", { checkedCount: 0 });
  }

  /** Check if updates are available for a specific device. */
  async checkForUpdates(deviceId: string): Promise<FirmwareVersion[]> {
    this._emitJobProgress(deviceId, "checking");
    try {
      // Simulated — in production: HTTP GET to device /api/firmware/info or cloud manifest
      const versions = await this._fetchAvailableVersions(deviceId);
      this._knownVersions.set(deviceId, versions);
      if (versions.length > 0) {
        this.events.emit("firmware_engine", "FIRMWARE_UPDATE_AVAILABLE", {
          deviceId, latestVersion: versions[0].version,
        });
        this._messagesSent++;
      }
      return versions;
    } catch (err) {
      this._errorCount++;
      this._lastError = String(err);
      return [];
    }
  }

  /** Begin a firmware update job for a device. */
  async startUpdate(deviceId: string, targetVersion: string): Promise<FirmwareJob> {
    const jobId = `fw_${deviceId}_${Date.now()}`;
    const job: FirmwareJob = {
      id: jobId, deviceId, targetVersion,
      currentVersion: "unknown", // fetched from device state in full impl
      status: "downloading", progressPct: 0,
      startedAt: Date.now(),
    };
    this._jobs.set(jobId, job);
    this._notifyListeners(job);
    this.events.emit("firmware_engine", "FIRMWARE_JOB_STARTED", { jobId, deviceId, targetVersion });
    this._messagesSent++;

    // Simulate progress (in production: drive actual OTA flow)
    void this._simulateProgress(jobId);
    return job;
  }

  /** Rollback to previous firmware version. */
  async rollback(jobId: string): Promise<boolean> {
    const job = this._jobs.get(jobId);
    if (!job || !job.rollbackVersion) return false;
    const updated = { ...job, status: "rolled_back" as FirmwareJobStatus, completedAt: Date.now() };
    this._jobs.set(jobId, updated);
    this._notifyListeners(updated);
    this.events.emit("firmware_engine", "FIRMWARE_ROLLED_BACK", { jobId, deviceId: job.deviceId });
    this._messagesSent++;
    return true;
  }

  /** Cancel an in-progress job. */
  cancelJob(jobId: string): void {
    const job = this._jobs.get(jobId);
    if (!job) return;
    if (job.status === "success" || job.status === "failed") return;
    const updated = { ...job, status: "failed" as FirmwareJobStatus, error: "Cancelled by user", completedAt: Date.now() };
    this._jobs.set(jobId, updated);
    this._notifyListeners(updated);
  }

  getJobs(): FirmwareJob[] { return [...this._jobs.values()]; }
  getJobsForDevice(deviceId: string): FirmwareJob[] { return this.getJobs().filter(j => j.deviceId === deviceId); }

  subscribe(handler: FirmwareJobHandler): () => void {
    this._listeners.add(handler);
    return () => { this._listeners.delete(handler); };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _emitJobProgress(deviceId: string, status: FirmwareJobStatus): void {
    this.events.emit("firmware_engine", "FIRMWARE_JOB_PROGRESS", { deviceId, status });
  }

  private async _fetchAvailableVersions(_deviceId: string): Promise<FirmwareVersion[]> {
    // Simulated manifest — real impl: fetch from device HTTP endpoint or cloud
    await new Promise(r => setTimeout(r, 300));
    return [];
  }

  private async _simulateProgress(jobId: string): Promise<void> {
    const steps: [FirmwareJobStatus, number, number][] = [
      ["downloading", 30, 1_000],
      ["downloading", 60, 1_000],
      ["downloading", 100, 1_000],
      ["flashing", 30, 500],
      ["flashing", 70, 500],
      ["verifying", 90, 500],
      ["success", 100, 300],
    ];
    for (const [status, pct, delay] of steps) {
      await new Promise(r => setTimeout(r, delay));
      const job = this._jobs.get(jobId);
      if (!job || job.status === "failed") break;
      const updated = { ...job, status, progressPct: pct, ...(status === "success" ? { completedAt: Date.now() } : {}) };
      this._jobs.set(jobId, updated);
      this._notifyListeners(updated);
    }
    await this._persistJobs();
  }

  private _notifyListeners(job: FirmwareJob): void {
    this._listeners.forEach(h => { try { h(job); } catch {} });
  }

  private async _loadJobs(): Promise<void> {
    try {
      const stored = await this.db.table<FirmwareJob & { id: string }>("firmware_jobs").getAll();
      stored.forEach(j => this._jobs.set(j.id, j));
    } catch {}
  }

  private async _persistJobs(): Promise<void> {
    try {
      const table = this.db.table<FirmwareJob & { id: string }>("firmware_jobs");
      for (const job of this._jobs.values()) await table.upsert(job);
    } catch {}
  }
}
