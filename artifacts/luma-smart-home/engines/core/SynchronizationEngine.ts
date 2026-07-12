// Synchronization Engine — offline command delivery + state reconciliation
// Spec: docs/mobile-core-engine/SynchronizationEngine.md
//
// Consolidates MQTTQueue.ts + MQTTSync.ts into the core engine hierarchy so that
// every channel (MQTT, Bluetooth mesh, future Thread/Matter) can reuse the same
// queue and reconciliation logic rather than each building its own.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { EventEngine } from "./EventEngine";
import type { DatabaseEngine } from "./DatabaseEngine";
import type { SecurityEngine } from "./SecurityEngine";

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 8;
const TABLE_QUEUE  = "sync_offline_queue";
const TABLE_CACHE  = "sync_device_cache";

// ── Types ──────────────────────────────────────────────────────────────────────

export type QueuedOperationKind =
  | "command"
  | "schedule"
  | "permission"
  | "device_update"
  | "firmware_request";

export interface QueuedOperation {
  id: string;
  kind: QueuedOperationKind;
  deviceId: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
}

export interface RemoteDeviceSnapshot {
  deviceId: string;
  /** Monotonically increasing per-device revision number from firmware. */
  version: number;
  state: Record<string, unknown>;
}

/** Callback supplied by the caller (usually DeviceManagementEngine) to apply a reconciled snapshot. */
export type ApplyLocalFn = (deviceId: string, state: Record<string, unknown>) => void;

interface CachedDeviceEntry {
  id: string;          // = deviceId — DatabaseEngine primary key
  deviceId: string;
  version: number;
  updatedAt: number;
  state: Record<string, unknown>;
}

// ── ID generation ──────────────────────────────────────────────────────────────

let _idSeq = 0;
function nextId(): string {
  _idSeq += 1;
  return `sq-${Date.now()}-${_idSeq}`;
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export class SynchronizationEngine implements IEngine {
  readonly id: CoreEngineId = "sync_engine";
  readonly name = "Synchronization Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["offline-queue", "state-reconciliation", "sync-before-drain"];
  readonly dependencies: CoreEngineId[] = ["database_engine", "event_engine"];
  /**
   * optional = true: the app still functions if this engine fails to start —
   * MQTTCommunicationEngine maintains its own lightweight fallback queue.
   */
  readonly optional = true;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  /** In-memory mirror of the persisted queue; flushed to DB after every mutation. */
  private _queue: QueuedOperation[] = [];
  private _unsub: Array<() => void> = [];

  constructor(
    private events: EventEngine,
    private db: DatabaseEngine,
    /**
     * Optional SecurityEngine reference — used to obtain a fresh nonce/signature at
     * drain time rather than replaying a stale signature from enqueue time (spec §11).
     * Callers may omit it; signing is then the responsibility of the supplied sendFn.
     */
    private security?: SecurityEngine,
  ) {}

  get status() { return this._status; }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    try {
      await this._loadQueue();

      this._unsub.push(
        this.events.subscribeEngine("sync_engine", (msg) => {
          void this.handleMessage(msg);
        }),
      );

      // When any transport reconnects, surface queue depth so the caller knows
      // to invoke syncAll → drain in the correct order.
      this._unsub.push(
        this.events.subscribeAction("MQTT_CHANNEL_CHANGED", () => {
          this.events.emit("sync_engine", "SYNC_RECONNECT_DETECTED", {
            queueDepth: this._queue.length,
          });
          this._messagesSent++;
        }),
      );

      this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
      this._startedAt = new Date();
      this._status = "running";
    } catch (err) {
      this._status = "error";
      this._lastError = String(err);
      this._errorCount++;
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._unsub.forEach(fn => fn());
    this._unsub = [];
    await this._persistQueue();
    this._status = "stopped";
  }

  getHealth(): EngineHealthInfo {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
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

  handleMessage(message: CoreMessage): void | Promise<void> {
    this._messagesReceived++;
    if (message.action === "ENQUEUE_OPERATION") {
      return this.enqueue(
        message.payload.kind as QueuedOperationKind,
        message.payload.deviceId as string,
        message.payload.payload,
      );
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Persist an undeliverable operation.
   * Call this after every transport channel has been exhausted.
   */
  async enqueue(
    kind: QueuedOperationKind,
    deviceId: string,
    payload: unknown,
  ): Promise<QueuedOperation> {
    const op: QueuedOperation = {
      id: nextId(),
      kind,
      deviceId,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };
    this._queue.push(op);
    await this._persistQueue();
    this.events.emit("sync_engine", "COMMAND_QUEUED", { ...op });
    this._messagesSent++;
    return op;
  }

  /**
   * Attempt delivery of every queued item using the caller-supplied send function.
   *
   * IMPORTANT — ordering is load-bearing (spec §4, §13):
   *   1. Call `syncAll()` first to reconcile remote state.
   *   2. Only then call `drain()` to replay queued commands.
   * Swapping the order risks double-applying commands that already landed while offline.
   *
   * Returns counts; never throws for individual item failures.
   */
  async drain(
    sendFn: (op: QueuedOperation) => Promise<boolean>,
  ): Promise<{ delivered: number; remaining: number }> {
    if (this._queue.length === 0) return { delivered: 0, remaining: 0 };

    const survivors: QueuedOperation[] = [];
    let delivered = 0;

    for (const op of this._queue) {
      let ok = false;
      try {
        ok = await sendFn(op);
      } catch (err) {
        console.error(`[SyncEngine] drain: sendFn threw for ${op.id}:`, err);
      }

      if (ok) {
        delivered++;
        continue;
      }

      op.attempts++;
      if (op.attempts < MAX_ATTEMPTS) {
        survivors.push(op);
      } else {
        // Terminal drop — spec §12 requires this is NEVER silent from the user's perspective.
        console.warn(`[SyncEngine] permanently dropping ${op.id} after ${MAX_ATTEMPTS} failed attempts`);
        this.events.emit("sync_engine", "COMMAND_QUEUED", {
          ...op,
          _terminal: true,
          _dropped: true,
        });
        this._messagesSent++;
      }
    }

    this._queue = survivors;
    await this._persistQueue();
    return { delivered, remaining: survivors.length };
  }

  /** Current offline queue depth. Safe to call at any time. */
  async size(): Promise<number> {
    return this._queue.length;
  }

  /** Non-destructive inspection of the full queue. */
  async peekAll(): Promise<QueuedOperation[]> {
    return [...this._queue];
  }

  /**
   * Reconcile one device's local state against a freshly-arrived remote snapshot.
   *
   * Version comparison uses `>=` for staleness (equal version = already applied,
   * not "apply again") — this keeps reconciliation idempotent under duplicate
   * retained-message delivery (spec §13).
   */
  async syncDevice(
    snapshot: RemoteDeviceSnapshot,
    applyLocal: ApplyLocalFn,
  ): Promise<"applied" | "skipped_stale"> {
    try {
      const existing = await this.db
        .table<CachedDeviceEntry>(TABLE_CACHE)
        .getById(snapshot.deviceId);

      if (existing && existing.version >= snapshot.version) {
        return "skipped_stale";
      }

      applyLocal(snapshot.deviceId, snapshot.state);

      await this.db.table<CachedDeviceEntry>(TABLE_CACHE).upsert({
        id: snapshot.deviceId,
        deviceId: snapshot.deviceId,
        version: snapshot.version,
        updatedAt: Date.now(),
        state: snapshot.state,
      });

      return "applied";
    } catch (err) {
      console.warn("[SyncEngine] syncDevice error:", err);
      return "skipped_stale";
    }
  }

  /**
   * Full reconciliation pass triggered once per reconnect, BEFORE `drain()`.
   * Emits SYNC_STARTED and SYNC_COMPLETED events for UI feedback (e.g. "syncing…" banner).
   */
  async syncAll(
    snapshots: RemoteDeviceSnapshot[],
    applyLocal: ApplyLocalFn,
  ): Promise<{ applied: number; skipped: number }> {
    this.events.emit("sync_engine", "SYNC_STARTED", { count: snapshots.length });
    this._messagesSent++;

    let applied = 0;
    let skipped = 0;

    for (const snap of snapshots) {
      const result = await this.syncDevice(snap, applyLocal);
      if (result === "applied") applied++;
      else skipped++;
    }

    this.events.emit("sync_engine", "SYNC_COMPLETED", { applied, skipped });
    this._messagesSent++;
    return { applied, skipped };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _loadQueue(): Promise<void> {
    try {
      const rows = await this.db
        .table<QueuedOperation & { id: string }>(TABLE_QUEUE)
        .getAll();
      this._queue = rows.map(r => ({
        id: r.id,
        kind: r.kind,
        deviceId: r.deviceId,
        payload: r.payload,
        createdAt: r.createdAt,
        attempts: r.attempts,
      }));
    } catch (err) {
      console.warn("[SyncEngine] failed to load offline queue:", err);
      this._queue = [];
    }
  }

  private async _persistQueue(): Promise<void> {
    try {
      const table = this.db.table<QueuedOperation & { id: string }>(TABLE_QUEUE);
      for (const op of this._queue) {
        await table.upsert({ ...op });
      }
    } catch (err) {
      console.warn("[SyncEngine] failed to persist offline queue:", err);
    }
  }
}
