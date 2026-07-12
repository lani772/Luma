// Device Discovery Engine — mDNS/UDP network scan for ESP32 devices
// Spec: docs/mobile-core-engine/DiscoveryEngine.md
// In this environment: simulated scan (no real mDNS native module).
// Real implementation would use the WiFi engine's mDNS capability or a native module.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { EventEngine } from "./EventEngine";
import type { DatabaseEngine } from "./DatabaseEngine";

export interface DiscoveredDevice {
  id: string;
  hostname: string;
  ip: string;
  mac: string;
  firmware: string;
  model: string;
  lastSeen: number;
  reachable: boolean;
  discoveredVia: "mdns" | "udp_broadcast" | "ble" | "manual";
}

export type DiscoveryHandler = (devices: DiscoveredDevice[]) => void;

const SCAN_INTERVAL_MS = 30_000;
const STALE_THRESHOLD_MS = 90_000;

export class DiscoveryEngine implements IEngine {
  readonly id: CoreEngineId = "discovery_engine";
  readonly name = "Device Discovery Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["device-discovery", "mdns-scan", "udp-broadcast", "reachability"];
  readonly dependencies: CoreEngineId[] = ["event_engine", "database_engine"];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _scanTimer: ReturnType<typeof setInterval> | null = null;
  private _staleTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  private _discovered: Map<string, DiscoveredDevice> = new Map();
  private _listeners: Set<DiscoveryHandler> = new Set();
  private _scanning = false;
  private _paused = false;

  constructor(private events: EventEngine, private db: DatabaseEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    await this._loadCache();

    this._scanTimer = setInterval(() => {
      if (!this._paused) void this.scan();
    }, SCAN_INTERVAL_MS);

    this._staleTimer = setInterval(() => {
      this._markStaleDevices();
    }, STALE_THRESHOLD_MS);

    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";

    // Initial scan
    void this.scan();
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    if (this._scanTimer) clearInterval(this._scanTimer);
    if (this._staleTimer) clearInterval(this._staleTimer);
    await this._persistCache();
    this._listeners.clear();
    this._status = "stopped";
  }

  async pause(): Promise<void> { this._paused = true; this._status = "paused"; }
  async resume(): Promise<void> { this._paused = false; this._status = "running"; void this.scan(); }

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
      case "DISCOVERY_SCAN":
        void this.scan();
        break;
      case "DISCOVERY_REGISTER_MANUAL":
        this._registerManual(message.payload as { ip: string; mac?: string; hostname?: string });
        break;
      case "DISCOVERY_FORGET":
        this._forgetDevice(message.payload.deviceId as string);
        break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Run a discovery scan. Resolves once scan is complete. */
  async scan(): Promise<DiscoveredDevice[]> {
    if (this._scanning) return this.getDiscovered();
    this._scanning = true;
    try {
      this.events.emit("discovery_engine", "DISCOVERY_SCAN_STARTED", {});
      // Simulated scan — in production this calls mDNS or UDP broadcast native module
      const simulated = await this._simulateScan();
      const newlyFound: DiscoveredDevice[] = [];
      for (const device of simulated) {
        const isNew = !this._discovered.has(device.id);
        this._discovered.set(device.id, device);
        if (isNew) {
          newlyFound.push(device);
          this.events.emit("discovery_engine", "DEVICE_DISCOVERED", { device });
          this._messagesSent++;
        }
      }
      this.events.emit("discovery_engine", "DISCOVERY_SCAN_COMPLETE", {
        total: this._discovered.size, newlyFound: newlyFound.length,
      });
      this._notifyListeners();
      await this._persistCache();
      return this.getDiscovered();
    } finally {
      this._scanning = false;
    }
  }

  getDiscovered(): DiscoveredDevice[] {
    return [...this._discovered.values()];
  }

  getReachable(): DiscoveredDevice[] {
    return this.getDiscovered().filter(d => d.reachable);
  }

  subscribe(handler: DiscoveryHandler): () => void {
    this._listeners.add(handler);
    handler(this.getDiscovered());
    return () => { this._listeners.delete(handler); };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _simulateScan(): Promise<DiscoveredDevice[]> {
    // Simulated — no real network call in this environment.
    // Returns previously-cached devices as "still reachable".
    await new Promise(r => setTimeout(r, 200));
    const now = Date.now();
    return [...this._discovered.values()].map(d => ({ ...d, lastSeen: now, reachable: true }));
  }

  private _markStaleDevices(): void {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    let changed = false;
    this._discovered.forEach((device, id) => {
      if (device.lastSeen < cutoff && device.reachable) {
        this._discovered.set(id, { ...device, reachable: false });
        this.events.emit("discovery_engine", "DEVICE_UNREACHABLE", { deviceId: id, ip: device.ip });
        changed = true;
      }
    });
    if (changed) this._notifyListeners();
  }

  private _registerManual(opts: { ip: string; mac?: string; hostname?: string }): void {
    const id = opts.mac ?? opts.ip;
    const device: DiscoveredDevice = {
      id, hostname: opts.hostname ?? opts.ip, ip: opts.ip,
      mac: opts.mac ?? "", firmware: "unknown", model: "ESP32",
      lastSeen: Date.now(), reachable: true, discoveredVia: "manual",
    };
    this._discovered.set(id, device);
    this.events.emit("discovery_engine", "DEVICE_DISCOVERED", { device });
    this._notifyListeners();
    this._messagesSent++;
  }

  private _forgetDevice(deviceId: string): void {
    this._discovered.delete(deviceId);
    this._notifyListeners();
  }

  private _notifyListeners(): void {
    const devices = this.getDiscovered();
    this._listeners.forEach(h => { try { h(devices); } catch {} });
  }

  private async _loadCache(): Promise<void> {
    try {
      const stored = await this.db.table<DiscoveredDevice & { id: string }>("discovered_devices").getAll();
      stored.forEach(d => this._discovered.set(d.id, { ...d, reachable: false }));
    } catch {}
  }

  private async _persistCache(): Promise<void> {
    try {
      const table = this.db.table<DiscoveredDevice & { id: string }>("discovered_devices");
      for (const d of this._discovered.values()) await table.upsert(d);
    } catch {}
  }
}
