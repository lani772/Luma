import { randomUUID } from "node:crypto";
import { messageBus } from "./message-bus";
import type {
  EngineId,
  EngineInfo,
  EngineRegistration,
  EngineStatus,
  InternalMessage,
  MessageHandler,
  MessagePriority,
  MessageType,
} from "./types";
import { logger } from "../lib/logger";

export class InternalAPIGateway {
  private engines: Map<EngineId, EngineInfo> = new Map();
  private authTokens: Map<EngineId, string> = new Map();
  private unsubscribers: Map<EngineId, () => void> = new Map();

  registerEngine(registration: EngineRegistration, handler: MessageHandler): string {
    const token = randomUUID();
    this.authTokens.set(registration.id, token);

    const info: EngineInfo = {
      ...registration,
      status: "initializing",
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      messagesSent: 0,
      messagesReceived: 0,
    };
    this.engines.set(registration.id, info);

    const unsub = messageBus.subscribe(registration.id, (msg) => {
      const engine = this.engines.get(registration.id);
      if (engine) engine.messagesReceived += 1;
      return handler(msg);
    });
    this.unsubscribers.set(registration.id, unsub);

    logger.info({ engineId: registration.id }, "[Gateway] engine registered");
    return token;
  }

  unregisterEngine(engineId: EngineId, token: string): boolean {
    if (!this.authenticateEngine(engineId, token)) return false;
    this.engines.get(engineId)!.status = "stopped";
    this.unsubscribers.get(engineId)?.();
    this.unsubscribers.delete(engineId);
    this.authTokens.delete(engineId);
    logger.info({ engineId }, "[Gateway] engine unregistered");
    return true;
  }

  authenticateEngine(engineId: EngineId, token: string): boolean {
    return this.authTokens.get(engineId) === token;
  }

  setEngineStatus(engineId: EngineId, status: EngineStatus): void {
    const engine = this.engines.get(engineId);
    if (engine) {
      engine.status = status;
      engine.lastHeartbeat = new Date().toISOString();
    }
  }

  sendCommand(
    sourceEngineId: EngineId,
    destination: EngineId,
    action: string,
    payload: Record<string, unknown> = {},
    priority: MessagePriority = "normal",
  ): string {
    return this.route(sourceEngineId, destination, "COMMAND", action, payload, priority);
  }

  sendEvent(
    sourceEngineId: EngineId,
    destination: EngineId,
    action: string,
    payload: Record<string, unknown> = {},
    priority: MessagePriority = "normal",
  ): string {
    return this.route(sourceEngineId, destination, "EVENT", action, payload, priority);
  }

  broadcastMessage(
    sourceEngineId: EngineId,
    action: string,
    payload: Record<string, unknown> = {},
    priority: MessagePriority = "normal",
  ): string {
    return this.route(sourceEngineId, "broadcast", "BROADCAST", action, payload, priority);
  }

  publishMessage(message: Omit<InternalMessage, "id" | "timestamp">): string {
    const full = messageBus.makeMessage(message);
    this.trackSent(full.source as EngineId);
    messageBus.publish(full);
    return full.id;
  }

  queueOfflineMessage(
    sourceEngineId: EngineId,
    destination: EngineId,
    action: string,
    payload: Record<string, unknown> = {},
    ttlMs = 30_000,
  ): string {
    const msg = messageBus.makeMessage({
      source: sourceEngineId,
      destination,
      type: "COMMAND",
      action,
      payload,
      priority: "normal",
      ttl: ttlMs,
    });
    messageBus.enqueueOffline(msg);
    return msg.id;
  }

  syncMessages(): InternalMessage[] {
    return messageBus.syncMessages();
  }

  discoverEngine(engineId: EngineId): EngineInfo | null {
    return this.engines.get(engineId) ?? null;
  }

  getEngineStatus(engineId: EngineId): EngineStatus | "unknown" {
    return this.engines.get(engineId)?.status ?? "unknown";
  }

  getAllEngines(): EngineInfo[] {
    return [...this.engines.values()];
  }

  private route(
    source: EngineId,
    destination: EngineId | "broadcast",
    type: MessageType,
    action: string,
    payload: Record<string, unknown>,
    priority: MessagePriority,
  ): string {
    const msg = messageBus.makeMessage({ source, destination, type, action, payload, priority });
    this.trackSent(source);
    messageBus.publish(msg);
    return msg.id;
  }

  private trackSent(engineId: EngineId): void {
    const engine = this.engines.get(engineId);
    if (engine) engine.messagesSent += 1;
  }
}

export const gateway = new InternalAPIGateway();
