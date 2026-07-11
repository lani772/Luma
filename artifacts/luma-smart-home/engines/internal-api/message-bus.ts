function randomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type {
  EngineId,
  InternalMessage,
  MessageHandler,
  QueuedMessage,
} from "./types";

type Listeners = Map<string, Set<MessageHandler>>;

const RETRY_BASE_DELAY_MS = 1_000;
const MAX_QUEUE_SIZE = 200;

export class MobileMessageBus {
  private listeners: Listeners = new Map();
  private offlineQueue: Map<string, QueuedMessage> = new Map();
  private deadLetterQueue: InternalMessage[] = [];
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startRetryLoop();
  }

  publish(message: InternalMessage): void {
    if (message.destination === "broadcast") {
      this.listeners.forEach((handlers) => {
        handlers.forEach((h) => this.safeCall(h, message));
      });
      return;
    }

    const key = `engine:${message.destination}`;
    const handlers = this.listeners.get(key);

    if (!handlers || handlers.size === 0) {
      this.enqueueOffline(message);
      return;
    }

    handlers.forEach((h) => this.safeCall(h, message));
  }

  subscribe(engineId: EngineId, handler: MessageHandler): () => void {
    const key = `engine:${engineId}`;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(handler);

    const broadcastKey = "broadcast";
    if (!this.listeners.has(broadcastKey)) this.listeners.set(broadcastKey, new Set());
    this.listeners.get(broadcastKey)!.add(handler);

    this.drainQueueFor(engineId);

    return () => {
      this.listeners.get(key)?.delete(handler);
      this.listeners.get(broadcastKey)?.delete(handler);
    };
  }

  enqueueOffline(message: InternalMessage, maxAttempts = 5): void {
    if (this.offlineQueue.size >= MAX_QUEUE_SIZE) {
      this.deadLetterQueue.push(message);
      return;
    }
    this.offlineQueue.set(message.id, {
      message,
      attempts: 0,
      nextRetryAt: Date.now() + RETRY_BASE_DELAY_MS,
      maxAttempts,
    });
  }

  retryFailedMessages(): void {
    const now = Date.now();
    for (const [id, queued] of this.offlineQueue) {
      if (queued.nextRetryAt > now) continue;

      const { message } = queued;
      const ttlExpired =
        message.ttl &&
        Date.now() > new Date(message.timestamp).getTime() + message.ttl;

      if (ttlExpired) {
        this.offlineQueue.delete(id);
        this.deadLetterQueue.push(message);
        continue;
      }

      queued.attempts += 1;
      const key = `engine:${message.destination}`;
      const handlers = this.listeners.get(key);

      if (message.destination !== "broadcast" && handlers && handlers.size > 0) {
        this.offlineQueue.delete(id);
        handlers.forEach((h) => this.safeCall(h, message));
      } else if (queued.attempts >= queued.maxAttempts) {
        this.offlineQueue.delete(id);
        this.deadLetterQueue.push(message);
      } else {
        queued.nextRetryAt =
          now + RETRY_BASE_DELAY_MS * Math.pow(2, queued.attempts);
      }
    }
  }

  drainQueueFor(engineId: EngineId): void {
    const key = `engine:${engineId}`;
    const handlers = this.listeners.get(key);
    if (!handlers || handlers.size === 0) return;

    for (const [id, queued] of this.offlineQueue) {
      if (queued.message.destination === engineId) {
        this.offlineQueue.delete(id);
        handlers.forEach((h) => this.safeCall(h, queued.message));
      }
    }
  }

  syncMessages(): InternalMessage[] {
    return [...this.offlineQueue.values()].map((q) => q.message);
  }

  getDeadLetters(): InternalMessage[] {
    return [...this.deadLetterQueue];
  }

  makeMessage(
    partial: Omit<InternalMessage, "id" | "timestamp">,
  ): InternalMessage {
    return {
      ...partial,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  private safeCall(handler: MessageHandler, message: InternalMessage): void {
    try {
      const result = handler(message);
      if (result instanceof Promise) {
        result.catch((err) => console.error("[MobileBus] handler error", err));
      }
    } catch (err) {
      console.error("[MobileBus] handler error", err);
    }
  }

  private startRetryLoop(): void {
    this.retryTimer = setInterval(() => this.retryFailedMessages(), 2_000);
  }

  destroy(): void {
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.listeners.clear();
  }
}

export const messageBus = new MobileMessageBus();
