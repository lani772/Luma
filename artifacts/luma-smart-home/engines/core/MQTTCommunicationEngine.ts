// MQTT Communication Engine — transport layer for device commands and status
// Spec: docs/mobile-core-engine/MQTTCommunicationEngine.md
// Generalizes the existing modules/mqtt/ multi-channel stack.
// Priority: Cloud MQTT → Local MQTT → HTTP fallback → Offline queue.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { EventEngine } from "./EventEngine";
import type { DatabaseEngine } from "./DatabaseEngine";

export type MQTTChannel = "cloud" | "local" | "http" | "offline";
export type TransportType = "native" | "simulated";

export interface MQTTConnectionConfig {
  cloudBrokerUrl: string;
  cloudPort: number;
  localBrokerIp: string;
  localPort: number;
  clientId: string;
  username?: string;
  password?: string;
  keepAliveSeconds: number;
  connectTimeoutMs: number;
}

export interface OfflineCommand {
  id: string;
  deviceId: string;
  command: Record<string, unknown>;
  queuedAt: number;
  attempts: number;
}

export interface MQTTStatus {
  channel: MQTTChannel;
  transport: TransportType;
  connected: boolean;
  latencyMs: number | null;
  reconnectCount: number;
  lastConnectedAt: string | null;
  offlineQueueDepth: number;
}

const MAX_OFFLINE_QUEUE = 100;
const RECONNECT_INTERVAL_MS = 5_000;
const DRAIN_INTERVAL_MS = 3_000;

export class MQTTCommunicationEngine implements IEngine {
  readonly id: CoreEngineId = "mqtt_communication_engine";
  readonly name = "MQTT Communication Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["mqtt-transport", "cloud-mqtt", "local-mqtt", "http-fallback", "offline-queue"];
  readonly dependencies: CoreEngineId[] = ["event_engine", "database_engine"];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _reconnectTimer: ReturnType<typeof setInterval> | null = null;
  private _drainTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  private _channel: MQTTChannel = "offline";
  private _transport: TransportType = "simulated";
  private _connected = false;
  private _latencyMs: number | null = null;
  private _reconnectCount = 0;
  private _lastConnectedAt: string | null = null;
  private _offlineQueue: OfflineCommand[] = [];
  private _config: MQTTConnectionConfig | null = null;
  private _paused = false;
  private _unsub: (() => void)[] = [];

  constructor(private events: EventEngine, private db: DatabaseEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    this._config = await this._loadConfig();
    await this._loadOfflineQueue();

    // Listen for command requests from DeviceManagementEngine
    this._unsub.push(
      this.events.subscribeAction("SEND_DEVICE_COMMAND", (msg) => {
        void this._dispatchCommand(msg.payload.deviceId as string, msg.payload.command as Record<string, unknown>);
      }),
    );

    // Detect native module availability
    this._transport = this._detectNativeTransport();
    if (this._transport === "simulated") {
      this.events.emit("mqtt_communication_engine", "MQTT_NATIVE_TRANSPORT_UNAVAILABLE", {
        reason: "No native MQTT module detected. Using simulated transport. To use native transport, build a custom Expo dev client.",
      });
    }

    this._reconnectTimer = setInterval(() => {
      if (!this._paused && !this._connected) void this._attemptConnect();
    }, RECONNECT_INTERVAL_MS);

    this._drainTimer = setInterval(() => {
      if (!this._paused && this._connected) void this._drainOfflineQueue();
    }, DRAIN_INTERVAL_MS);

    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";

    // Attempt initial connection
    void this._attemptConnect();
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    if (this._reconnectTimer) clearInterval(this._reconnectTimer);
    if (this._drainTimer) clearInterval(this._drainTimer);
    this._unsub.forEach(fn => fn());
    await this._persistOfflineQueue();
    this._connected = false;
    this._channel = "offline";
    this._status = "stopped";
  }

  async pause(): Promise<void> { this._paused = true; this._status = "paused"; }
  async resume(): Promise<void> { this._paused = false; this._status = "running"; void this._attemptConnect(); }

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
      case "MQTT_CONFIGURE":
        void this._applyConfig(message.payload as Partial<MQTTConnectionConfig>);
        break;
      case "MQTT_RECONNECT":
        void this._attemptConnect();
        break;
      case "MQTT_PUBLISH": {
        const { topic, payload } = message.payload as { topic: string; payload: unknown };
        void this._publish(topic, payload);
        break;
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getMQTTStatus(): MQTTStatus {
    return {
      channel: this._channel,
      transport: this._transport,
      connected: this._connected,
      latencyMs: this._latencyMs,
      reconnectCount: this._reconnectCount,
      lastConnectedAt: this._lastConnectedAt,
      offlineQueueDepth: this._offlineQueue.length,
    };
  }

  /** Publish a raw message to a topic. */
  async publish(topic: string, payload: unknown): Promise<boolean> {
    return this._publish(topic, payload);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _attemptConnect(): Promise<void> {
    if (this._connected) return;
    const prevChannel = this._channel;

    // Priority: Cloud → Local → HTTP → Offline
    const channels: MQTTChannel[] = ["cloud", "local", "http"];
    for (const ch of channels) {
      const ok = await this._tryChannel(ch);
      if (ok) {
        this._channel = ch;
        this._connected = true;
        this._lastConnectedAt = new Date().toISOString();
        if (ch !== prevChannel) {
          this.events.emit("mqtt_communication_engine", "MQTT_CHANNEL_CHANGED", {
            channel: ch, transport: this._transport, latencyMs: this._latencyMs,
          });
        }
        return;
      }
    }
    this._channel = "offline";
    this._connected = false;
  }

  private async _tryChannel(channel: MQTTChannel): Promise<boolean> {
    // Simulated — real impl calls native MQTT module or HTTP endpoint
    await new Promise(r => setTimeout(r, 50));
    if (channel === "cloud") {
      // Simulate cloud connectivity as available when we have a config
      const available = !!this._config?.cloudBrokerUrl;
      if (available) {
        this._latencyMs = 20 + Math.floor(Math.random() * 30);
        this._reconnectCount++;
      }
      return available;
    }
    return false;
  }

  private async _dispatchCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    if (!this._connected) {
      this._enqueueOffline(deviceId, command);
      return;
    }
    const topic = `luma/device/${deviceId}/command`;
    const ok = await this._publish(topic, { deviceId, command, ts: Date.now() });
    if (!ok) this._enqueueOffline(deviceId, command);
  }

  private async _publish(topic: string, payload: unknown): Promise<boolean> {
    try {
      // Simulated publish — real impl: native MQTT module publish
      console.debug(`[MQTTEngine] publish → ${topic}`, payload);
      this._messagesSent++;
      return true;
    } catch (err) {
      this._errorCount++;
      this._lastError = String(err);
      return false;
    }
  }

  private _enqueueOffline(deviceId: string, command: Record<string, unknown>): void {
    if (this._offlineQueue.length >= MAX_OFFLINE_QUEUE) {
      this._offlineQueue.shift(); // drop oldest
    }
    this._offlineQueue.push({
      id: `oq_${Date.now()}`, deviceId, command, queuedAt: Date.now(), attempts: 0,
    });
    this.events.emit("mqtt_communication_engine", "MQTT_COMMAND_QUEUED", {
      deviceId, queueDepth: this._offlineQueue.length,
    });
  }

  private async _drainOfflineQueue(): Promise<void> {
    if (this._offlineQueue.length === 0 || !this._connected) return;
    const item = this._offlineQueue[0];
    const ok = await this._dispatchCommand(item.deviceId, item.command).then(() => true).catch(() => false);
    if (ok) {
      this._offlineQueue.shift();
      this.events.emit("mqtt_communication_engine", "MQTT_OFFLINE_COMMAND_SENT", {
        deviceId: item.deviceId, remaining: this._offlineQueue.length,
      });
    } else {
      item.attempts++;
      if (item.attempts > 5) this._offlineQueue.shift();
    }
  }

  private _detectNativeTransport(): TransportType {
    try {
      const { NativeModules } = require("react-native");
      return NativeModules.MqttClient ? "native" : "simulated";
    } catch { return "simulated"; }
  }

  private async _applyConfig(partial: Partial<MQTTConnectionConfig>): Promise<void> {
    this._config = { ...(this._config ?? {} as MQTTConnectionConfig), ...partial };
    await this.db.set("mqtt_config", this._config);
    void this._attemptConnect();
  }

  private async _loadConfig(): Promise<MQTTConnectionConfig | null> {
    return this.db.get<MQTTConnectionConfig | null>("mqtt_config", null);
  }

  private async _loadOfflineQueue(): Promise<void> {
    this._offlineQueue = await this.db.get<OfflineCommand[]>("mqtt_offline_queue", []);
  }

  private async _persistOfflineQueue(): Promise<void> {
    await this.db.set("mqtt_offline_queue", this._offlineQueue);
  }
}
