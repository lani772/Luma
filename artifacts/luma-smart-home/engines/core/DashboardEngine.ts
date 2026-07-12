// Dashboard Engine — aggregates live data from all engines for the home screen
// Spec: docs/mobile-core-engine/DashboardEngine.md
// Replaces ad-hoc per-screen aggregation with a single tested computation layer.

import type { CoreEngineId, CoreMessage, EngineHealthInfo, IEngine } from "./types";
import type { EventEngine } from "./EventEngine";
import type { DeviceManagementEngine, DeviceState } from "./DeviceManagementEngine";
import type { DiscoveryEngine } from "./DiscoveryEngine";

export interface EnergyInsight {
  icon: string;
  title: string;
  tag: string;
  color: string;
  text: string;
}

export interface ConnectionHealth {
  channel: "cloud" | "local" | "offline";
  transport: "native" | "simulated";
  latencyMs: number | null;
  reconnectCount: number;
  lastConnectedAt: string | null;
}

export interface ActivityEntry {
  id: number;
  deviceId: string | null;
  deviceName: string | null;
  user: string;
  action: string;
  time: number;
  icon: string;
}

export interface DashboardSnapshot {
  // Device status
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  unreachableDevices: number;
  // Energy
  totalPowerW: number;
  energyTodayKwh: number;
  costToday: number;
  energyMonthKwh: number;
  costMonth: number;
  projectedAnnualSavings: number;
  // Insights
  insights: EnergyInsight[];
  // Connection
  connectionHealth: ConnectionHealth;
  // Activity
  recentActivity: ActivityEntry[];
  // Boot
  bootDurationMs: number | null;
  generatedAt: string;
}

export type SnapshotHandler = (snapshot: DashboardSnapshot) => void;

const REFRESH_INTERVAL_MS = 10_000;

export class DashboardEngine implements IEngine {
  readonly id: CoreEngineId = "dashboard_engine";
  readonly name = "Dashboard Engine";
  readonly version = "1.0.0";
  readonly capabilities = ["dashboard-aggregation", "energy-insights", "connection-health", "activity-feed"];
  readonly dependencies: CoreEngineId[] = ["event_engine", "device_management_engine", "discovery_engine"];
  readonly optional = true;

  private _status: import("./types").EngineStatus = "idle";
  private _startedAt: Date | null = null;
  private _errorCount = 0;
  private _lastError: string | null = null;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;
  private _messagesSent = 0;
  private _messagesReceived = 0;

  private _snapshot: DashboardSnapshot | null = null;
  private _listeners: Set<SnapshotHandler> = new Set();
  private _activity: ActivityEntry[] = [];
  private _activityIdSeq = 0;
  private _connectionHealth: ConnectionHealth = {
    channel: "offline", transport: "simulated", latencyMs: null, reconnectCount: 0, lastConnectedAt: null,
  };
  private _bootDurationMs: number | null = null;
  private _paused = false;
  private _unsub: (() => void)[] = [];

  constructor(
    private events: EventEngine,
    private devices: DeviceManagementEngine,
    private discovery: DiscoveryEngine,
  ) {}

  get status() { return this._status; }

  async start(): Promise<void> {
    if (this._status === "running") return;
    this._status = "booting";

    // Listen for events that should refresh the snapshot
    this._unsub.push(
      this.events.subscribeAction("DEVICE_STATE_CHANGED", () => { if (!this._paused) this._refresh(); }),
      this.events.subscribeAction("DEVICE_DISCOVERED", () => { if (!this._paused) this._refresh(); }),
      this.events.subscribeAction("MQTT_CHANNEL_CHANGED", (msg) => {
        const { channel, transport, latencyMs } = msg.payload as Partial<ConnectionHealth>;
        this._connectionHealth = { ...this._connectionHealth, channel: channel ?? "offline", transport: transport ?? "simulated", latencyMs: latencyMs ?? null, lastConnectedAt: new Date().toISOString() };
        if (!this._paused) this._refresh();
      }),
      this.events.subscribeAction("CORE_READY", (msg) => {
        this._bootDurationMs = (msg.payload.bootDurationMs as number) ?? null;
      }),
      this.events.subscribeAction("DEVICE_COMMAND", (msg) => {
        this._addActivity({
          deviceId: msg.payload.deviceId as string ?? null,
          deviceName: null,
          user: "You",
          action: String(msg.payload.command ?? "command"),
          icon: "zap",
        });
      }),
    );

    this._refreshTimer = setInterval(() => {
      if (!this._paused) this._refresh();
    }, REFRESH_INTERVAL_MS);

    this._heartbeatTimer = setInterval(() => { this._lastHeartbeat = new Date(); }, 5_000);
    this._startedAt = new Date();
    this._status = "running";
    this._refresh();
  }

  async stop(): Promise<void> {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._unsub.forEach(fn => fn());
    this._listeners.clear();
    this._status = "stopped";
  }

  async pause(): Promise<void> { this._paused = true; this._status = "paused"; }
  async resume(): Promise<void> { this._paused = false; this._status = "running"; this._refresh(); }

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
    if (message.action === "DASHBOARD_REFRESH") this._refresh();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Get the latest dashboard snapshot synchronously. */
  getDashboardSnapshot(): DashboardSnapshot {
    if (!this._snapshot) this._buildSnapshot();
    return this._snapshot!;
  }

  /** Subscribe to snapshot updates. Returns unsubscribe fn. */
  subscribe(handler: SnapshotHandler): () => void {
    this._listeners.add(handler);
    if (this._snapshot) handler(this._snapshot);
    return () => { this._listeners.delete(handler); };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _refresh(): void {
    this._buildSnapshot();
    this._notifyListeners();
    this._messagesSent++;
  }

  private _buildSnapshot(): void {
    const deviceList = this.devices.getDevices();
    const discovered = this.discovery.getDiscovered();

    const online = deviceList.filter(d => d.online);
    const offline = deviceList.filter(d => !d.online);
    const unreachable = discovered.filter(d => !d.reachable).length;

    const totalPowerW = online.reduce((s, d) => s + (d.power ?? 0), 0);
    const energyTodayKwh = deviceList.reduce((s, d) => s + (d.energyToday ?? 0), 0);
    const costToday = deviceList.reduce((s, d) => s + (d.costToday ?? 0), 0);
    const energyMonthKwh = deviceList.reduce((s, d) => s + (d.energyMonth ?? 0), 0);
    const costMonth = deviceList.reduce((s, d) => s + (d.costMonth ?? 0), 0);

    this._snapshot = {
      totalDevices: deviceList.length,
      onlineDevices: online.length,
      offlineDevices: offline.length,
      unreachableDevices: unreachable,
      totalPowerW,
      energyTodayKwh,
      costToday,
      energyMonthKwh,
      costMonth,
      projectedAnnualSavings: costMonth * 0.083 * 12, // rough estimate
      insights: this._generateInsights(deviceList),
      connectionHealth: { ...this._connectionHealth },
      recentActivity: this._activity.slice(0, 20),
      bootDurationMs: this._bootDurationMs,
      generatedAt: new Date().toISOString(),
    };
  }

  private _generateInsights(devices: DeviceState[]): EnergyInsight[] {
    const insights: EnergyInsight[] = [];
    if (devices.length === 0) return insights;

    // High consumer alert
    const maxConsumer = [...devices].sort((a, b) => (b.energyMonth ?? 0) - (a.energyMonth ?? 0))[0];
    const totalMonth = devices.reduce((s, d) => s + (d.energyMonth ?? 0), 0);
    if (maxConsumer && totalMonth > 0) {
      const pct = Math.round((maxConsumer.energyMonth / totalMonth) * 100);
      if (pct > 25) {
        insights.push({
          icon: "alert-triangle", title: "High Consumer Alert",
          tag: "Action needed", color: "#f59e0b",
          text: `${maxConsumer.name} consumes ${pct}% of total energy. Consider scheduling off-hours.`,
        });
      }
    }

    // Offline devices
    const offlineDevices = devices.filter(d => !d.online);
    if (offlineDevices.length > 0) {
      insights.push({
        icon: "wifi-off", title: "Offline Devices",
        tag: "Investigate", color: "#ef4444",
        text: `${offlineDevices.map(d => d.name).join(", ")} ${offlineDevices.length === 1 ? "is" : "are"} offline.`,
      });
    }

    // Low signal quality
    const lowSignal = devices.filter(d => d.online && (d.signalQuality ?? 100) < 50);
    if (lowSignal.length > 0) {
      insights.push({
        icon: "signal", title: "Weak Signal",
        tag: "Check placement", color: "#06b6d4",
        text: `${lowSignal[0].name} has weak Wi-Fi signal (${lowSignal[0].signalQuality}%). Consider repositioning.`,
      });
    }

    return insights;
  }

  private _addActivity(entry: Omit<ActivityEntry, "id" | "time">): void {
    this._activity.unshift({ ...entry, id: ++this._activityIdSeq, time: Date.now() });
    if (this._activity.length > 100) this._activity.pop();
  }

  private _notifyListeners(): void {
    if (!this._snapshot) return;
    this._listeners.forEach(h => { try { h(this._snapshot!); } catch {} });
  }
}
