import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type {
  EngineId,
  InternalMessage,
  MessageHandler,
  QueuedMessage,
} from "./types";
import { logger } from "../lib/logger";

const RETRY_BASE_DELAY_MS = 1_000;
const MAX_QUEUE_SIZE = 500;
const DEAD_LETTER_TTL_MS = 60_000;

export class MessageBus extends EventEmitter {
  private offlineQueue: Map<string, QueuedMessage> = new Map();
  private deadLetterQueue: InternalMessage[] = [];
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.setMaxListeners(50);
    this.startRetryLoop();
  }

  publish(message: InternalMessage): void {
    const destination = message.destination;

    if (destination === "broadcast") {
      this.emit("broadcast", message);
      logger.debug({ action: message.action, source: message.source }, "[Bus] broadcast");
      return;
    }

    const topic = `engine:${destination}`;
    const listenerCount = this.listenerCount(topic);

    if (listenerCount === 0) {
      this.enqueueOffline(message);
      return;
    }

    this.emit(topic, message);
    logger.debug(
      { action: message.action, source: message.source, dest: destination },
      "[Bus] delivered",
    );
  }

  subscribe(engineId: EngineId, handler: MessageHandler): () => void {
    const topic = `engine:${engineId}`;
    const wrapper = (msg: InternalMessage) => {
      void Promise.resolve(handler(msg)).catch((err) => {
        logger.error({ err, engineId, action: msg.action }, "[Bus] handler error");
      });
    };
    this.on(topic, wrapper);
    this.on("broadcast", wrapper);

    this.drainQueueFor(engineId);

    return () => {
      this.off(topic, wrapper);
      this.off("broadcast", wrapper);
    };
  }

  enqueueOffline(message: InternalMessage, maxAttempts = 5): void {
    if (this.offlineQueue.size >= MAX_QUEUE_SIZE) {
      logger.warn("[Bus] offline queue full, dropping message");
      this.deadLetterQueue.push(message);
      return;
    }
    const queued: QueuedMessage = {
      message,
      attempts: 0,
      nextRetryAt: Date.now() + RETRY_BASE_DELAY_MS,
      maxAttempts,
    };
    this.offlineQueue.set(message.id, queued);
    logger.debug({ id: message.id, dest: message.destination }, "[Bus] queued offline");
  }

  retryFailedMessages(): void {
    const now = Date.now();
    for (const [id, queued] of this.offlineQueue) {
      if (queued.nextRetryAt > now) continue;

      const { message } = queued;
      const ttlExpired = message.ttl && Date.now() > new Date(message.timestamp).getTime() + message.ttl;

      if (ttlExpired) {
        this.offlineQueue.delete(id);
        this.deadLetterQueue.push(message);
        logger.warn({ id, action: message.action }, "[Bus] message TTL expired → dead letter");
        continue;
      }

      queued.attempts += 1;
      const topic = `engine:${message.destination}`;

      if (message.destination !== "broadcast" && this.listenerCount(topic) > 0) {
        this.offlineQueue.delete(id);
        this.emit(topic, message);
        logger.debug({ id, action: message.action, attempts: queued.attempts }, "[Bus] retry delivered");
      } else if (queued.attempts >= queued.maxAttempts) {
        this.offlineQueue.delete(id);
        this.deadLetterQueue.push(message);
        logger.warn({ id, action: message.action }, "[Bus] max retries → dead letter");
      } else {
        queued.nextRetryAt = now + RETRY_BASE_DELAY_MS * Math.pow(2, queued.attempts);
      }
    }

    const deadLetterCutoff = Date.now() - DEAD_LETTER_TTL_MS;
    this.deadLetterQueue = this.deadLetterQueue.filter(
      (m) => new Date(m.timestamp).getTime() > deadLetterCutoff,
    );
  }

  drainQueueFor(engineId: EngineId): void {
    const topic = `engine:${engineId}`;
    for (const [id, queued] of this.offlineQueue) {
      if (queued.message.destination === engineId && this.listenerCount(topic) > 0) {
        this.offlineQueue.delete(id);
        this.emit(topic, queued.message);
        logger.debug({ id, engineId }, "[Bus] drained queued message");
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

  private startRetryLoop(): void {
    this.retryTimer = setInterval(() => this.retryFailedMessages(), 2_000);
  }

  destroy(): void {
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.removeAllListeners();
  }
}

export const messageBus = new MessageBus();
