// Event Engine — unified pub/sub backbone
// Spec: docs/mobile-core-engine/EventEngine.md
// Wraps the existing MobileMessageBus and adds typed event routing,
// ring-buffer history, and a unified action-level subscription API.

import type { CoreEngineId, CoreMessage, CoreMessageHandler, EngineHealthInfo } from "./types";
import { CORE_EVENTS } from "./types";
import type { IEngine } from "./types";

const RING_BUFFER_SIZE = 300;

interface Subscription {
  action: string | "*";
  handler: CoreMessageHandler;
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class EventEngine implements IEngine {
  readonly id: CoreEngineId = "event_engine";
  readonly name = "Event Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["event-bus", "pub-sub", "command-routing", "message-history"];
  readonly dependencies: CoreEngineId[] = [];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Subscriptions by engineId → list of subscriptions
  private engineSubs: Map<CoreEngineId, Subscription[]> = new Map();
  // Action-level subscriptions (any source → action)
  private actionSubs: Map<string, Set<CoreMessageHandler>> = new Map();
  // Ring buffer of recent messages
  private ringBuffer: CoreMessage[] = [];
  // Offline queue: destination → queued messages
  private offlineQueue: Map<CoreEngineId, CoreMessage[]> = new Map();

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    this._startedAt = new Date();
    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._status = "running";
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this.engineSubs.clear();
    this.actionSubs.clear();
    this.offlineQueue.clear();
    this._status = "stopped";
  }

  async pause(): Promise<void> { this._status = "paused"; }
  async resume(): Promise<void> { this._status = "running"; }

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
    this.publish(message);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Publish a message to all subscribers (broadcast or targeted). */
  publish(message: CoreMessage): void {
    this._messagesReceived++;
    this._addToRingBuffer(message);

    if (message.destination === "broadcast") {
      this.engineSubs.forEach((subs) => subs.forEach(s => this._deliver(s, message)));
      this.actionSubs.get("*")?.forEach(h => this._safeCall(h, message));
      this.actionSubs.get(message.action)?.forEach(h => this._safeCall(h, message));
      return;
    }

    // Targeted
    const subs = this.engineSubs.get(message.destination);
    if (!subs || subs.length === 0) {
      this._enqueueOffline(message);
    } else {
      subs.forEach(s => this._deliver(s, message));
    }
    // Also fire action subs
    this.actionSubs.get(message.action)?.forEach(h => this._safeCall(h, message));
    this.actionSubs.get("*")?.forEach(h => this._safeCall(h, message));
  }

  /** Subscribe an engine to receive messages addressed to it. Returns unsubscribe fn. */
  subscribeEngine(engineId: CoreEngineId, handler: CoreMessageHandler, action: string | "*" = "*"): () => void {
    if (!this.engineSubs.has(engineId)) this.engineSubs.set(engineId, []);
    const sub: Subscription = { action, handler };
    this.engineSubs.get(engineId)!.push(sub);
    this._drainOfflineQueue(engineId);
    return () => {
      const arr = this.engineSubs.get(engineId);
      if (arr) {
        const idx = arr.indexOf(sub);
        if (idx !== -1) arr.splice(idx, 1);
      }
    };
  }

  /** Subscribe to a specific action name globally. Returns unsubscribe fn. */
  subscribeAction(action: string, handler: CoreMessageHandler): () => void {
    if (!this.actionSubs.has(action)) this.actionSubs.set(action, new Set());
    this.actionSubs.get(action)!.add(handler);
    return () => { this.actionSubs.get(action)?.delete(handler); };
  }

  /** Emit a broadcast event from any engine. */
  emit(source: CoreEngineId | "system", action: string, payload: Record<string, unknown> = {}, priority: import("./types").MessagePriority = "normal"): void {
    const message = this.makeMessage({ source, destination: "broadcast", type: "EVENT", action, payload, priority });
    this.publish(message);
    this._messagesSent++;
  }

  /** Send a targeted command to another engine. */
  sendCommand(source: CoreEngineId, destination: CoreEngineId, action: string, payload: Record<string, unknown> = {}, correlationId?: string): string {
    const message = this.makeMessage({ source, destination, type: "COMMAND", action, payload, priority: "normal", correlationId });
    this.publish(message);
    this._messagesSent++;
    return message.id;
  }

  /** Get ring-buffer history, optionally filtered by action. */
  getHistory(filterAction?: string): CoreMessage[] {
    if (!filterAction) return [...this.ringBuffer];
    return this.ringBuffer.filter(m => m.action === filterAction);
  }

  /** Build a CoreMessage with id + timestamp filled in. */
  makeMessage(partial: Omit<CoreMessage, "id" | "timestamp">): CoreMessage {
    return { ...partial, id: uuid(), timestamp: new Date().toISOString() };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _deliver(sub: Subscription, message: CoreMessage): void {
    if (sub.action === "*" || sub.action === message.action) {
      this._safeCall(sub.handler, message);
    }
  }

  private _safeCall(handler: CoreMessageHandler, message: CoreMessage): void {
    try {
      const r = handler(message);
      if (r instanceof Promise) r.catch(err => { this._errorCount++; this._lastError = String(err); });
    } catch (err) { this._errorCount++; this._lastError = String(err); }
  }

  private _addToRingBuffer(message: CoreMessage): void {
    this.ringBuffer.push(message);
    if (this.ringBuffer.length > RING_BUFFER_SIZE) this.ringBuffer.shift();
  }

  private _enqueueOffline(message: CoreMessage): void {
    const dest = message.destination as CoreEngineId;
    if (!this.offlineQueue.has(dest)) this.offlineQueue.set(dest, []);
    this.offlineQueue.get(dest)!.push(message);
  }

  private _drainOfflineQueue(engineId: CoreEngineId): void {
    const queued = this.offlineQueue.get(engineId);
    if (!queued || queued.length === 0) return;
    const subs = this.engineSubs.get(engineId);
    if (!subs || subs.length === 0) return;
    this.offlineQueue.delete(engineId);
    queued.forEach(m => subs.forEach(s => this._deliver(s, m)));
  }
}

export const eventEngine = new EventEngine();
