// BluetoothTransport — ITransport adapter wrapping MobileP2PEngine.
//
// Bluetooth Direct (priority 4) and Bluetooth Mesh (priority 5) are two modes
// of the same underlying P2P engine. Direct is short-range one-hop BLE;
// Mesh routes through nearby trusted phone peers as relay nodes.
//
// NOTE: Actual BLE radio is not available in Expo Go or this container.
// The underlying MobileP2PEngine simulates discovery and routing. The fallback
// is explicit — the adapter checks the engine's active route type and returns
// false from send() if no peer path is available, allowing TransportManager to
// cascade to the next channel.

import type { ITransport, TransportPriority, TransportStatus, TransportConnectionState } from "./ITransport";
import type { MobileP2PEngine, RouteType } from "../../p2p-engine";

/** Which Bluetooth mode this instance represents in the failover chain. */
export type BluetoothMode = "direct" | "mesh";

const MODE_ROUTES: Record<BluetoothMode, RouteType[]> = {
  direct: ["direct_bluetooth"],
  mesh:   ["bluetooth_mesh"],
};

export class BluetoothTransport implements ITransport {
  readonly name: string;
  readonly priority: TransportPriority;

  private _state: TransportConnectionState = "disconnected";
  private _latencyMs: number | null = null;
  private _lastConnectedAt: string | null = null;
  private _errorMessage: string | null = null;
  private _mode: BluetoothMode;

  constructor(
    private p2p: MobileP2PEngine,
    mode: BluetoothMode,
  ) {
    this._mode = mode;
    if (mode === "direct") {
      this.name = "Bluetooth Direct";
      this.priority = 4;
    } else {
      this.name = "Bluetooth Mesh";
      this.priority = 5;
    }
  }

  async connect(): Promise<boolean> {
    this._state = "connecting";
    try {
      // Trigger passive peer discovery — P2P engine handles the rest.
      this.p2p.discoverPeers("bluetooth");
      // Reflect the current route to determine if this channel is usable.
      const available = this._isRouteAvailable();
      this._state = available ? "connected" : "disconnected";
      if (available) this._lastConnectedAt = new Date().toISOString();
      return available;
    } catch (err) {
      this._state = "error";
      this._errorMessage = String(err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // P2P connections are managed by the engine; mark ourselves unavailable.
    this._state = "disconnected";
  }

  async send(topic: string, payload: unknown): Promise<boolean> {
    try {
      if (!this._isRouteAvailable()) return false;
      // Extract deviceId from topic convention: luma/device/<deviceId>/command
      const parts = topic.split("/");
      const deviceId = parts[2] ?? "unknown";
      const peerId = this._getBestPeerId();
      if (!peerId) return false;
      this.p2p.sendMeshMessage(peerId, deviceId, topic, payload as Record<string, unknown>);
      this._latencyMs = this.priority === 4 ? 45 : 85; // approximate by mode
      return true;
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this._state === "connected" && this._isRouteAvailable();
  }

  getStatus(): TransportStatus {
    const live = this._isRouteAvailable();
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
    // Nothing to clean up — the P2P engine owns the lifecycle.
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _isRouteAvailable(): boolean {
    try {
      const route = this.p2p.selectBestRoute();
      return MODE_ROUTES[this._mode].includes(route.type);
    } catch {
      return false;
    }
  }

  private _getBestPeerId(): string | null {
    try {
      // Get the first trusted online peer that can relay this mode.
      const route = this.p2p.selectBestRoute();
      const relayHop = route.hops.find(h => h.type === "gateway" || h.type === "phone");
      return relayHop?.id ?? null;
    } catch {
      return null;
    }
  }
}
