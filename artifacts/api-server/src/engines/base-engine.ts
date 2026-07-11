import { gateway } from "../internal-api/gateway";
import type {
  EngineId,
  EngineStatus,
  InternalMessage,
  MessagePriority,
} from "../internal-api/types";
import { logger } from "../lib/logger";

export abstract class BaseEngine {
  abstract readonly id: EngineId;
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly capabilities: string[];
  abstract readonly subscribedActions: string[];

  protected token: string = "";
  protected status: EngineStatus = "initializing";

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: this.id,
        name: this.name,
        version: this.version,
        capabilities: this.capabilities,
        subscribedActions: this.subscribedActions,
      },
      (msg) => this.handleMessage(msg),
    );
    this.setStatus("running");
    this.onStart();
    logger.info({ engineId: this.id }, `[${this.name}] started`);
  }

  stop(): void {
    this.onStop();
    gateway.unregisterEngine(this.id, this.token);
    this.setStatus("stopped");
    logger.info({ engineId: this.id }, `[${this.name}] stopped`);
  }

  protected setStatus(status: EngineStatus): void {
    this.status = status;
    gateway.setEngineStatus(this.id, status);
  }

  protected send(
    destination: EngineId,
    action: string,
    payload: Record<string, unknown> = {},
    priority: MessagePriority = "normal",
  ): string {
    return gateway.sendCommand(this.id, destination, action, payload, priority);
  }

  protected emit(
    destination: EngineId,
    action: string,
    payload: Record<string, unknown> = {},
    priority: MessagePriority = "normal",
  ): string {
    return gateway.sendEvent(this.id, destination, action, payload, priority);
  }

  protected broadcast(
    action: string,
    payload: Record<string, unknown> = {},
    priority: MessagePriority = "normal",
  ): string {
    return gateway.broadcastMessage(this.id, action, payload, priority);
  }

  protected queueOffline(
    destination: EngineId,
    action: string,
    payload: Record<string, unknown> = {},
    ttlMs = 30_000,
  ): string {
    return gateway.queueOfflineMessage(this.id, destination, action, payload, ttlMs);
  }

  protected abstract handleMessage(message: InternalMessage): void | Promise<void>;
  protected abstract onStart(): void;
  protected abstract onStop(): void;
}
