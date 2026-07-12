// Transport Abstraction — common interface every delivery channel must implement.
//
// Design goal (Priority 2): Bluetooth, MQTT, LAN, and any future transport
// (Matter, Thread, Zigbee, USB) plug in by implementing this interface. The
// TransportManager selects the best available channel without any caller needing
// to know which physical medium is in use.

// ── Priority ───────────────────────────────────────────────────────────────────
//
// Lower number = higher priority (tried first).
// These mirror the failover chain from MQTTCommunicationEngine.md:
//   1 = Cloud MQTT (fastest, lowest latency when internet available)
//   2 = Local MQTT (LAN broker, no internet required)
//   3 = Direct LAN (HTTP fallback to device IP)
//   4 = Bluetooth Direct (BLE/Classic, short range)
//   5 = Bluetooth Mesh (multi-hop via P2P engine)
//   6 = Backend Relay (last resort — phone → cloud → device)

export type TransportPriority = 1 | 2 | 3 | 4 | 5 | 6;

export type TransportConnectionState =
  | "connected"
  | "connecting"
  | "disconnected"
  | "unavailable"  // transport physically absent (e.g. no BLE hardware)
  | "error";

export interface TransportStatus {
  /** Human-readable name shown in diagnostics UI. */
  name: string;
  priority: TransportPriority;
  state: TransportConnectionState;
  /** Round-trip latency in ms, null if not yet measured. */
  latencyMs: number | null;
  lastConnectedAt: string | null;
  errorMessage: string | null;
}

// ── Core interface ─────────────────────────────────────────────────────────────

export interface ITransport {
  /** Human-readable name ("Cloud MQTT", "Local MQTT", "Bluetooth Mesh", …). */
  readonly name: string;
  /** Failover priority — lower = preferred. */
  readonly priority: TransportPriority;

  /**
   * Attempt to establish (or re-establish) the connection.
   * Returns true if the transport is now usable, false if connection failed.
   * Must not throw; errors are captured in status.errorMessage instead.
   */
  connect(): Promise<boolean>;

  /**
   * Cleanly close the transport. Must not throw.
   */
  disconnect(): Promise<void>;

  /**
   * Send a message to `topic` with `payload`.
   * Returns true if delivery was accepted by the channel, false otherwise.
   * Must not throw; callers rely on the boolean to decide whether to fall back.
   */
  send(topic: string, payload: unknown): Promise<boolean>;

  /** Synchronous reachability check — no I/O. */
  isConnected(): boolean;

  /** Snapshot of current transport health for diagnostics. */
  getStatus(): TransportStatus;

  /**
   * Optional cleanup for timers, subscriptions, etc.
   * Called by TransportManager.dispose().
   */
  dispose?(): void;
}
