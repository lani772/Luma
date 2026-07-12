// Device Management Engine — single source of truth for device state
// Spec: docs/mobile-core-engine/DeviceManagementEngine.md
// Unifies engines/device-engine.ts (gateway dispatcher) with LumaContext's Lamp domain model.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { EventEngine } from "./EventEngine";
import type { DatabaseEngine } from "./DatabaseEngine";

export interface DeviceState {
  id: string;
  name: string;
  room: string;
  floor: string;
  mac: string;
  online: boolean;
  lastSeen: number;
  firmware: string;
  // Power
  on: boolean;
  brightness: number;       // 0–100
  colorTemp: number;        // Kelvin
  rgb: string;              // hex
  // Energy
  voltage: number;
  current: number;
  power: number;
  energyToday: number;
  costToday: number;
  energyMonth: number;
  costMonth: number;
  // Health
  rssi: number;
  signalQuality: number;
  ip: string;
  uptime: string;
  cpu: number;
  memory: number;
  restartCount: number;
  // Meta
  lastCommand: string;
  lastUpdate: number;
}

export type DeviceCommand =
  | { type: "TURN_ON" }
  | { type: "TURN_OFF" }
  | { type: "TOGGLE" }
  | { type: "SET_BRIGHTNESS"; value: number }
  | { type: "SET_COLOR"; rgb: string }
  | { type: "SET_COLOR_TEMP"; kelvin: number }
  | { type: "REBOOT" };

export type DeviceChangeHandler = (devices: DeviceState[]) => void;

export class DeviceManagementEngine implements IEngine {
  readonly id: CoreEngineId = "device_management_engine";
  readonly name = "Device Management Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["device-registry", "device-state", "device-command", "scene-control"];
  readonly dependencies: CoreEngineId[] = ["event_engine", "database_engine"];
  readonly optional = false;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  private _devices: Map<string, DeviceState> = new Map();
  private _listeners: Set<DeviceChangeHandler> = new Set();
  private _unsub: (() => void) | null = null;

  constructor(private events: EventEngine, private db: DatabaseEngine) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";
    await this._loadDevices();

    this._unsub = this.events.subscribeEngine("device_management_engine", (msg) => {
      void this.handleMessage(msg);
    });

    // Listen for MQTT status updates from communication engine
    this.events.subscribeAction("MQTT_DEVICE_STATE_RECEIVED", (msg) => {
      const { deviceId, state } = msg.payload as { deviceId: string; state: Partial<DeviceState> };
      if (deviceId) this.applyStatePatch(deviceId, state);
    });

    // Execute automation-fired actions
    this.events.subscribeAction("AUTOMATION_RULE_FIRED", (msg) => {
      const { action } = msg.payload as { action: { type: string; deviceId?: string; command?: string } };
      if (action?.deviceId && action?.command) {
        void this.sendCommand(action.deviceId, { type: action.command as "TURN_ON" });
      }
    });

    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._unsub?.();
    await this._persistDevices();
    this._listeners.clear();
    this._status = "stopped";
  }

  async pause(): Promise<void> { this._status = "paused"; }
  async resume(): Promise<void> { this._status = "running"; }

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
      case "DEVICE_COMMAND":
        void this.sendCommand(
          message.payload.deviceId as string,
          message.payload.command as DeviceCommand,
        );
        break;
      case "DEVICE_REGISTER":
        this.registerDevice(message.payload as unknown as DeviceState);
        break;
      case "DEVICE_REMOVE":
        this.removeDevice(message.payload.deviceId as string);
        break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getDevices(): DeviceState[] {
    return [...this._devices.values()];
  }

  getDevice(id: string): DeviceState | null {
    return this._devices.get(id) ?? null;
  }

  getOnlineDevices(): DeviceState[] {
    return this.getDevices().filter(d => d.online);
  }

  registerDevice(device: DeviceState): void {
    this._devices.set(device.id, device);
    void this._persistDevices();
    this.events.emit("device_management_engine", "DEVICE_REGISTERED", { deviceId: device.id, name: device.name });
    this._notifyListeners();
    this._messagesSent++;
  }

  removeDevice(id: string): void {
    this._devices.delete(id);
    void this._persistDevices();
    this.events.emit("device_management_engine", "DEVICE_REMOVED", { deviceId: id });
    this._notifyListeners();
    this._messagesSent++;
  }

  /** Apply a partial state update (e.g. from MQTT status report). */
  applyStatePatch(deviceId: string, patch: Partial<DeviceState>): void {
    const existing = this._devices.get(deviceId);
    if (!existing) return;
    const updated = { ...existing, ...patch, lastUpdate: Date.now() };
    this._devices.set(deviceId, updated);
    this.events.emit("device_management_engine", "DEVICE_STATE_CHANGED", {
      deviceId, state: updated,
    });
    this._notifyListeners();
    this._messagesSent++;
  }

  /** Dispatch a command to a device via the MQTT Communication Engine. */
  async sendCommand(deviceId: string, command: DeviceCommand): Promise<boolean> {
    const device = this._devices.get(deviceId);
    if (!device) return false;

    // Optimistic state update
    const patch = this._commandToStatePatch(command, device);
    this.applyStatePatch(deviceId, { ...patch, lastCommand: command.type, lastUpdate: Date.now() });

    // Forward to MQTT engine for transport
    this.events.sendCommand("device_management_engine", "mqtt_communication_engine", "SEND_DEVICE_COMMAND", {
      deviceId, command, deviceIp: device.ip,
    });
    this._messagesSent++;
    return true;
  }

  /** Subscribe to device list changes. Returns unsubscribe fn. */
  subscribe(handler: DeviceChangeHandler): () => void {
    this._listeners.add(handler);
    handler(this.getDevices());
    return () => { this._listeners.delete(handler); };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _commandToStatePatch(cmd: DeviceCommand, current: DeviceState): Partial<DeviceState> {
    switch (cmd.type) {
      case "TURN_ON":  return { on: true };
      case "TURN_OFF": return { on: false };
      case "TOGGLE":   return { on: !current.on };
      case "SET_BRIGHTNESS": return { brightness: cmd.value };
      case "SET_COLOR":      return { rgb: cmd.rgb };
      case "SET_COLOR_TEMP": return { colorTemp: cmd.kelvin };
      default: return {};
    }
  }

  private _notifyListeners(): void {
    const devices = this.getDevices();
    this._listeners.forEach(h => { try { h(devices); } catch {} });
  }

  private async _loadDevices(): Promise<void> {
    try {
      const stored = await this.db.table<DeviceState & { id: string }>("device_states").getAll();
      stored.forEach(d => this._devices.set(d.id, d));
    } catch (err) {
      console.warn("[DeviceManagementEngine] failed to load devices:", err);
    }
  }

  private async _persistDevices(): Promise<void> {
    try {
      const table = this.db.table<DeviceState & { id: string }>("device_states");
      for (const device of this._devices.values()) await table.upsert(device);
    } catch (err) {
      console.warn("[DeviceManagementEngine] failed to persist devices:", err);
    }
  }
}
