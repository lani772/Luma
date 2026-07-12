// MQTTTransport — ITransport adapter wrapping MQTTCommunicationEngine.
//
// Cloud MQTT (priority 1) and Local MQTT (priority 2) are both served by the
// MQTTCommunicationEngine; this adapter surfaces them as two separate transport
// instances so TransportManager can treat them independently in the failover chain.

import type { ITransport, TransportPriority, TransportStatus, TransportConnectionState } from "./ITransport";
import type { MQTTCommunicationEngine, MQTTChannel } from "../MQTTCommunicationEngine";

export class MQTTTransport implements ITransport {
  readonly name: string;
  readonly priority: TransportPriority;

  private _state: TransportConnectionState = "disconnected";
  private _latencyMs: number | null = null;
  private _lastConnectedAt: string | null = null;
  private _errorMessage: string | null = null;
  private _targetChannel: MQTTChannel;

  constructor(
    private mqtt: MQTTCommunicationEngine,
    /**
     * "cloud" maps to priority 1; "local" maps to priority 2.
     * Pass the channel this instance is responsible for.
     */
    channel: "cloud" | "local",
  ) {
    this._targetChannel = channel;
    if (channel === "cloud") {
      this.name = "Cloud MQTT";
      this.priority = 1;
    } else {
      this.name = "Local MQTT";
      this.priority = 2;
    }
  }

  async connect(): Promise<boolean> {
    this._state = "connecting";
    try {
      // Delegate to the MQTT engine — it manages connection internally.
      // We check whether the engine's current channel matches our target.
      const status = this.mqtt.getMQTTStatus();
      const connected = status.connected && status.channel === this._targetChannel;
      if (connected) {
        this._state = "connected";
        this._latencyMs = status.latencyMs;
        this._lastConnectedAt = status.lastConnectedAt;
        this._errorMessage = null;
      } else {
        this._state = "disconnected";
      }
      return connected;
    } catch (err) {
      this._state = "error";
      this._errorMessage = String(err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // MQTTCommunicationEngine manages the connection pool; we do not close it
    // on behalf of a single channel — just mark ourselves as disconnected.
    this._state = "disconnected";
  }

  async send(topic: string, payload: unknown): Promise<boolean> {
    try {
      const status = this.mqtt.getMQTTStatus();
      if (!status.connected || status.channel !== this._targetChannel) return false;
      return await this.mqtt.publish(topic, payload);
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this._state === "connected";
  }

  getStatus(): TransportStatus {
    const live = this.mqtt.getMQTTStatus();
    // Sync our internal state with the engine's live state
    const liveConnected = live.connected && live.channel === this._targetChannel;
    if (liveConnected && this._state !== "connected") {
      this._state = "connected";
      this._latencyMs = live.latencyMs;
      this._lastConnectedAt = live.lastConnectedAt;
    } else if (!liveConnected && this._state === "connected") {
      this._state = "disconnected";
    }

    return {
      name: this.name,
      priority: this.priority,
      state: this._state,
      latencyMs: liveConnected ? live.latencyMs : this._latencyMs,
      lastConnectedAt: live.lastConnectedAt ?? this._lastConnectedAt,
      errorMessage: this._errorMessage,
    };
  }
}
