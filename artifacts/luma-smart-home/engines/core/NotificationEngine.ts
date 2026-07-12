// Notification Engine — single source for all in-app alerts
// Spec: docs/mobile-core-engine/NotificationEngine.md
// Extracted from LumaContext's pushNotif/markAllNotifRead/archiveNotif pattern.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { EventEngine } from "./EventEngine";

export interface CoreNotification {
  id: number;
  cat: string;
  icon: string;
  title: string;
  body?: string;
  time: string;
  read: boolean;
  archived: boolean;
  sourceEngine?: CoreEngineId;
  dedupeKey?: string;  // prevents duplicate notifications for same condition
}

export type NotificationHandler = (notifications: CoreNotification[]) => void;

const NOTIF_EVENTS = {
  RAISED:    "NOTIFICATION_RAISED",
  READ:      "NOTIFICATION_READ",
  READ_ALL:  "NOTIFICATION_READ_ALL",
  ARCHIVED:  "NOTIFICATION_ARCHIVED",
} as const;

export class NotificationEngine implements IEngine {
  readonly id: CoreEngineId = "notification_engine";
  readonly name = "Notification Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["notification-feed", "alert-dedup", "read-state", "archive"];
  readonly dependencies: CoreEngineId[] = ["event_engine"];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  private _notifications: CoreNotification[] = [];
  private _nextId = 1;
  private _dedupeCache: Map<string, number> = new Map(); // dedupeKey → notifId
  private _listeners: Set<NotificationHandler> = new Set();
  private _unsubscribe: (() => void) | null = null;

  constructor(private events: EventEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";

    // Subscribe to raise-notification events from any engine
    this._unsubscribe = this.events.subscribeAction(NOTIF_EVENTS.RAISED, (msg) => {
      const { cat, icon, title, body, dedupeKey, sourceEngine } = msg.payload as Partial<CoreNotification> & { sourceEngine?: string };
      if (cat && icon && title) {
        this.push({ cat, icon, title, body, dedupeKey, sourceEngine: sourceEngine as CoreEngineId | undefined });
      }
    });

    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._unsubscribe?.();
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
      case "NOTIFICATION_MARK_READ":
        this.markRead(message.payload.id as number);
        break;
      case "NOTIFICATION_MARK_ALL_READ":
        this.markAllRead();
        break;
      case "NOTIFICATION_ARCHIVE":
        this.archive(message.payload.id as number);
        break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Push a new notification. Deduplication: if dedupeKey already active, skip. */
  push(opts: { cat: string; icon: string; title: string; body?: string; dedupeKey?: string; sourceEngine?: CoreEngineId }): CoreNotification | null {
    if (opts.dedupeKey) {
      const existing = this._dedupeCache.get(opts.dedupeKey);
      if (existing !== undefined) {
        const existingNotif = this._notifications.find(n => n.id === existing);
        if (existingNotif && !existingNotif.archived) return null; // duplicate suppressed
      }
    }

    const now = new Date();
    const notif: CoreNotification = {
      id: this._nextId++,
      cat: opts.cat,
      icon: opts.icon,
      title: opts.title,
      body: opts.body,
      time: this._relativeTime(now),
      read: false,
      archived: false,
      sourceEngine: opts.sourceEngine,
      dedupeKey: opts.dedupeKey,
    };

    if (opts.dedupeKey) this._dedupeCache.set(opts.dedupeKey, notif.id);
    this._notifications = [notif, ...this._notifications];
    this._notify();
    this._messagesSent++;
    return notif;
  }

  /** Get active (non-archived) notifications. */
  getFeed(): CoreNotification[] {
    return this._notifications.filter(n => !n.archived);
  }

  /** Get all notifications including archived. */
  getAll(): CoreNotification[] {
    return [...this._notifications];
  }

  /** Count unread notifications. */
  getUnreadCount(): number {
    return this._notifications.filter(n => !n.read && !n.archived).length;
  }

  markRead(id: number): void {
    this._notifications = this._notifications.map(n => n.id === id ? { ...n, read: true } : n);
    this._notify();
  }

  markAllRead(): void {
    this._notifications = this._notifications.map(n => ({ ...n, read: true }));
    this._notify();
  }

  archive(id: number): void {
    this._notifications = this._notifications.map(n => n.id === id ? { ...n, archived: true } : n);
    // Clear dedupe so the same condition can re-notify later
    const notif = this._notifications.find(n => n.id === id);
    if (notif?.dedupeKey) this._dedupeCache.delete(notif.dedupeKey);
    this._notify();
  }

  /** Subscribe to feed changes. Returns unsubscribe fn. */
  subscribe(handler: NotificationHandler): () => void {
    this._listeners.add(handler);
    handler(this.getFeed()); // immediate snapshot
    return () => { this._listeners.delete(handler); };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _notify(): void {
    const feed = this.getFeed();
    this._listeners.forEach(h => { try { h(feed); } catch {} });
  }

  private _relativeTime(d: Date): string {
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }
}
