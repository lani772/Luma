/**
 * MQTTConnection — one named channel (cloud broker, local/LAN broker, or a
 * direct ESP32 broker). Each connection owns its own `MQTTServiceInterface`
 * instance, so — matching the native library's per-instance session model —
 * disconnecting one channel never touches another.
 */
import { createMQTTService, ConnectParams, IncomingHandler, MQTTServiceInterface } from "./MQTTService";
import { ReconnectSupervisor } from "./MQTTRecovery";
import { mqttEvents, MQTT_EVENT } from "./MQTTEvents";
import { setSession } from "./MQTTStorage";

export type ChannelId = "cloud" | "local" | "esp32_direct";
export type ChannelStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface ChannelMetrics {
  latencyMs: number | null;
  lastMessageAt: number | null;
  reconnectAttempts: number;
  messagesPerMinute: number;
}

export class MQTTConnection {
  readonly id: ChannelId;
  readonly priority: number;
  private service: MQTTServiceInterface;
  private supervisor: ReconnectSupervisor;
  private params: ConnectParams;
  private _status: ChannelStatus = "idle";
  private _metrics: ChannelMetrics = { latencyMs: null, lastMessageAt: null, reconnectAttempts: 0, messagesPerMinute: 0 };
  private messageTimestamps: number[] = [];
  private onReconnectedCb: (channelId: ChannelId) => void;

  constructor(id: ChannelId, priority: number, params: ConnectParams, onReconnected: (channelId: ChannelId) => void) {
    this.id = id;
    this.priority = priority;
    this.params = params;
    this.onReconnectedCb = onReconnected;
    this.service = createMQTTService();

    this.service.onConnected(() => {
      this._status = "connected";
      void setSession(id, { channelId: id, clientId: params.clientId, brokerUrl: `${params.host}:${params.port}`, lastConnectedAt: Date.now() });
      mqttEvents.emit(MQTT_EVENT.BROKER_CONNECTED, { channelId: id, transport: this.service.transport });
    });
    this.service.onDisconnected(() => {
      this._status = "disconnected";
      mqttEvents.emit(MQTT_EVENT.BROKER_DISCONNECTED, { channelId: id });
      this.supervisor.notifyDropped();
    });
    this.service.onError((err) => {
      this._status = "error";
      mqttEvents.emit(MQTT_EVENT.SECURITY_VIOLATION, { channelId: id, ...err });
    });

    this.supervisor = new ReconnectSupervisor(
      () => this.doConnect(),
      () => this.onReconnectedCb(id),
      `mqtt:${id}`,
    );
  }

  private async doConnect(): Promise<boolean> {
    this._status = "connecting";
    const startedAt = Date.now();
    try {
      await this.service.connect(this.params);
      this._metrics.latencyMs = Date.now() - startedAt;
      return true;
    } catch (err) {
      console.error(`[MQTTConnection:${this.id}] connect failed`, err);
      return false;
    }
  }

  start(): void {
    this.supervisor.start();
  }

  stop(): void {
    this.supervisor.stop();
    this.service.disconnect();
    this._status = "idle";
  }

  async publish(topic: string, payload: Record<string, unknown>): Promise<boolean> {
    if (this._status !== "connected") return false;
    try {
      await this.service.publish(topic, payload);
      this.recordMessage();
      return true;
    } catch (err) {
      console.error(`[MQTTConnection:${this.id}] publish failed on ${topic}`, err);
      return false;
    }
  }

  async subscribe(topic: string, handler: IncomingHandler): Promise<() => void> {
    return this.service.subscribe(topic, (t, p) => {
      this.recordMessage();
      handler(t, p);
    });
  }

  private recordMessage(): void {
    const now = Date.now();
    this._metrics.lastMessageAt = now;
    this.messageTimestamps.push(now);
    const cutoff = now - 60_000;
    this.messageTimestamps = this.messageTimestamps.filter((t) => t > cutoff);
    this._metrics.messagesPerMinute = this.messageTimestamps.length;
    this._metrics.reconnectAttempts = this.supervisor.getAttempt();
  }

  isConnected(): boolean {
    return this._status === "connected";
  }

  getStatus(): ChannelStatus {
    return this._status;
  }

  getTransport(): "native" | "simulated" {
    return this.service.transport;
  }

  getMetrics(): ChannelMetrics {
    return { ...this._metrics, reconnectAttempts: this.supervisor.getAttempt() };
  }
}
