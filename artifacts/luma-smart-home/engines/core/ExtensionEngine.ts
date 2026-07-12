// Extension Engine — lifecycle manager for pluggable engine modules
// Spec: docs/mobile-core-engine/ExtensionEngine.md
// Governs installation, versioning, enable/disable, and sandboxing of engines.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine, EngineManifestEntry } from "./types";
import type { EventEngine } from "./EventEngine";
import type { DatabaseEngine } from "./DatabaseEngine";

export interface ExtensionRecord {
  id: string;              // CoreEngineId
  name: string;
  version: string;
  enabled: boolean;
  installedAt: number;
  lastEnabledAt: number | null;
  lastDisabledAt: number | null;
  errorCount: number;
  lastError: string | null;
}

export type ExtensionStateHandler = (extensions: ExtensionRecord[]) => void;

export class ExtensionEngine implements IEngine {
  readonly id: CoreEngineId = "extension_engine";
  readonly name = "Extension Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["extension-lifecycle", "enable-disable", "versioning", "sandboxing"];
  readonly dependencies: CoreEngineId[] = ["event_engine", "database_engine"];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  private _registry: Map<string, ExtensionRecord> = new Map();
  private _listeners: Set<ExtensionStateHandler> = new Set();
  private _manifest: EngineManifestEntry[] = [];

  constructor(private events: EventEngine, private db: DatabaseEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    await this._loadState();
    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    await this._persistState();
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
      case "EXTENSION_ENABLE":
        void this.enable(message.payload.extensionId as CoreEngineId);
        break;
      case "EXTENSION_DISABLE":
        void this.disable(message.payload.extensionId as CoreEngineId);
        break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Register the static extension manifest (called by CoreEngine at boot). */
  loadManifest(manifest: EngineManifestEntry[]): void {
    this._manifest = manifest;
    for (const entry of manifest) {
      if (!this._registry.has(entry.id)) {
        this._registry.set(entry.id, {
          id: entry.id,
          name: entry.name,
          version: entry.version,
          enabled: true, // default: all enabled
          installedAt: Date.now(),
          lastEnabledAt: null,
          lastDisabledAt: null,
          errorCount: 0,
          lastError: null,
        });
      }
    }
    void this._persistState();
  }

  /** Check if a specific engine is enabled. */
  isEnabled(engineId: CoreEngineId): boolean {
    return this._registry.get(engineId)?.enabled ?? true;
  }

  /** Enable an optional engine. */
  async enable(engineId: CoreEngineId): Promise<void> {
    const rec = this._registry.get(engineId);
    if (!rec) return;
    const updated = { ...rec, enabled: true, lastEnabledAt: Date.now() };
    this._registry.set(engineId, updated);
    await this._persistState();
    this.events.emit("extension_engine", "EXTENSION_ENABLED", { extensionId: engineId });
    this._notifyListeners();
    this._messagesSent++;
  }

  /** Disable an optional engine. Cannot disable required engines. */
  async disable(engineId: CoreEngineId): Promise<boolean> {
    const entry = this._manifest.find(m => m.id === engineId);
    if (entry && !entry.optional) return false; // required engine cannot be disabled

    const rec = this._registry.get(engineId);
    if (!rec) return false;
    const updated = { ...rec, enabled: false, lastDisabledAt: Date.now() };
    this._registry.set(engineId, updated);
    await this._persistState();
    this.events.emit("extension_engine", "EXTENSION_DISABLED", { extensionId: engineId });
    this._notifyListeners();
    this._messagesSent++;
    return true;
  }

  /** Record an error for an extension (called by CoreEngine on start failure). */
  recordError(engineId: CoreEngineId, error: string): void {
    const rec = this._registry.get(engineId);
    if (!rec) return;
    this._registry.set(engineId, { ...rec, errorCount: rec.errorCount + 1, lastError: error });
  }

  getExtensions(): ExtensionRecord[] {
    return [...this._registry.values()];
  }

  subscribe(handler: ExtensionStateHandler): () => void {
    this._listeners.add(handler);
    handler(this.getExtensions());
    return () => { this._listeners.delete(handler); };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _notifyListeners(): void {
    const exts = this.getExtensions();
    this._listeners.forEach(h => { try { h(exts); } catch {} });
  }

  private async _loadState(): Promise<void> {
    try {
      const stored = await this.db.table<ExtensionRecord & { id: string }>("extension_state").getAll();
      stored.forEach(e => this._registry.set(e.id, e));
    } catch {}
  }

  private async _persistState(): Promise<void> {
    try {
      const table = this.db.table<ExtensionRecord & { id: string }>("extension_state");
      for (const ext of this._registry.values()) await table.upsert(ext);
    } catch {}
  }
}
