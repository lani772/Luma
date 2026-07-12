// LANTransport — ITransport adapter wrapping MobileWiFiEngine.
//
// Priority 3: Direct LAN (HTTP fallback to device IP when no MQTT broker is
// reachable). Uses the WiFi engine's device registry to locate device IPs and
// simulates an HTTP command dispatch.
//
// Also serves as the LAN discovery bridge — if the WiFi engine discovers a
// device, TransportManager can use this adapter to send commands directly
// to the device's local IP without going through a broker.

import type { ITransport, TransportPriority, TransportStatus, TransportConnectionState } from "./ITransport";
import type { MobileWiFiEngine } from "../../wifi-engine";

export class LANTransport implements ITransport {
  readonly name = "Direct LAN (HTTP)";
  readonly priority: TransportPriority = 3;

  private _state: TransportConnectionState = "disconnected";
  private _latencyMs: number | null = null;
  private _lastConnectedAt: string | null = null;
  private _errorMessage: string | null = null;

  constructor(private wifi: MobileWiFiEngine) {}

  async connect(): Promise<boolean> {
    this._state = "connecting";
    try {
      const connected = this.wifi.isConnected();
      if (connected) {
        this._state = "connected";
        this._lastConnectedAt = new Date().toISOString();
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
    // WiFi engine lifecycle is managed externally; just mark as disconnected.
    this._state = "disconnected";
  }

  async send(topic: string, payload: unknown): Promise<boolean> {
    try {
      if (!this.wifi.isConnected()) return false;

      // Extract deviceId from topic convention: luma/device/<deviceId>/command
      const parts = topic.split("/");
      const deviceId = parts[2] ?? "";
      if (!deviceId) return false;

      const deviceIp = this.wifi.getLocalIPAddress(deviceId);
      if (!deviceIp) {
        // Trigger a discovery attempt and return false — caller will retry
        this.wifi.startDiscovery();
        return false;
      }

      // Simulated HTTP dispatch — real implementation would use fetch() to
      // POST to http://<deviceIp>/api/command with a signed payload.
      const _url = `http://${deviceIp}/api/command`;
      console.debug(`[LANTransport] HTTP → ${_url}`, payload);

      const start = Date.now();
      // Simulate HTTP round-trip (50–100 ms)
      await new Promise<void>(r => setTimeout(r, 50 + Math.random() * 50));
      this._latencyMs = Date.now() - start;
      return true;
    } catch (err) {
      this._errorMessage = String(err);
      return false;
    }
  }

  isConnected(): boolean {
    return this._state === "connected" && this.wifi.isConnected();
  }

  getStatus(): TransportStatus {
    const live = this.wifi.isConnected();
    if (live && this._state !== "connected") {
      this._state = "connected";
      this._lastConnectedAt = new Date().toISOString();
    } else if (!live && this._state === "connected") {
      this._state = "disconnected";
    }
    return {
      name: this.name,
      priority: this.priority,
      state: this._state,
      latencyMs: this._latencyMs,
      lastConnectedAt: this._lastConnectedAt,
      errorMessage: this._errorMessage,
    };
  }

  dispose(): void {
    // WiFi engine owns its own lifecycle.
  }
}
