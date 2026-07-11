import { gateway } from "./internal-api/gateway";
import type { InternalMessage } from "./internal-api/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WiFiNetwork {
  ssid: string;
  bssid: string;
  rssi: number;
  secured: boolean;
  channel: number;
  frequency: number;
  linkSpeed: number;
}

export interface HotspotState {
  active: boolean;
  ssid: string;
  password: string;
  band: "2.4GHz" | "5GHz";
  channel: number;
  connectedDevices: ConnectedDevice[];
}

export interface ConnectedDevice {
  mac: string;
  ip: string;
  hostname: string;
  connectedAt: number;
}

export type ProvisioningStep =
  | "idle"
  | "bt_pairing"
  | "credential_transfer"
  | "esp32_connecting"
  | "discovering"
  | "complete"
  | "failed";

export interface ProvisioningState {
  step: ProvisioningStep;
  progress: number;
  deviceId?: string;
  deviceMac?: string;
  error?: string;
  startedAt?: number;
}

export interface NetworkStats {
  ssid: string;
  rssi: number;
  channel: number;
  frequency: number;
  linkSpeed: number;
  latency: number;
  internetAvailable: boolean;
  localNetAvailable: boolean;
  esp32Connected: boolean;
  esp32Latency: number;
  signalQuality: "excellent" | "good" | "fair" | "poor" | "none";
}

export interface RegisteredDevice {
  id: string;
  mac: string;
  hostname: string;
  ip: string;
  type: string;
  firmwareVersion: string;
  lastSeen: number;
  discoveryMethod: "mdns" | "udp_broadcast" | "heartbeat";
  status: "online" | "offline" | "unreachable";
  deviceHello?: {
    deviceId: string;
    mac: string;
    firmwareVersion: string;
    deviceType: string;
  };
}

export interface RecoveryState {
  active: boolean;
  attempt: number;
  maxAttempts: number;
  nextRetryIn: number;
  phase: "idle" | "checking_network" | "searching_device" | "rediscovering_ip" | "restoring" | "failed";
}

export interface WiFiEventPayload {
  HotspotEnabled: { ssid: string; channel: number };
  HotspotDisabled: Record<string, never>;
  WiFiConnected: { ssid: string; ip: string; rssi: number };
  WiFiDisconnected: { reason: string };
  DeviceDiscovered: { device: RegisteredDevice };
  DeviceConnected: { deviceId: string; ip: string; method: string };
  DeviceDisconnected: { deviceId: string; reason: string };
  IPAddressUpdated: { deviceId: string; oldIp: string; newIp: string };
  ConnectionRecovered: { deviceId: string; recoveryTime: number };
  NetworkLost: { reason: string };
}

export type WiFiEvent = keyof WiFiEventPayload;
type WiFiHandler<E extends WiFiEvent> = (data: WiFiEventPayload[E]) => void;
type AnyWiFiHandler = (data: unknown) => void;

// ─── Engine ──────────────────────────────────────────────────────────────────

export class MobileWiFiEngine {
  private token = "";
  private handlers = new Map<string, AnyWiFiHandler[]>();

  // State
  private _networks: WiFiNetwork[] = MOCK_NETWORKS;
  private _hotspot: HotspotState = {
    active: false,
    ssid: "LUMA-Hotspot",
    password: "luma2025!",
    band: "2.4GHz",
    channel: 6,
    connectedDevices: [],
  };
  private _provisioning: ProvisioningState = { step: "idle", progress: 0 };
  private _networkStats: NetworkStats = DEFAULT_STATS;
  private _devices: Map<string, RegisteredDevice> = new Map();
  private _recovery: RecoveryState = { active: false, attempt: 0, maxAttempts: 5, nextRetryIn: 0, phase: "idle" };
  private _connected = false;
  private _currentSSID = "";
  private _localIP = "";

  // Internals
  private monitorInterval?: ReturnType<typeof setInterval>;
  private discoveryTimeout?: ReturnType<typeof setTimeout>;
  private recoveryTimeout?: ReturnType<typeof setTimeout>;
  private _eventLog: { time: number; event: string; detail: string }[] = [];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "wifi_engine",
        name: "WiFi & Hotspot Engine",
        version: "2.0.0",
        capabilities: [
          "wifi_scanning",
          "esp32_discovery",
          "hotspot_management",
          "secure_provisioning",
          "ip_detection",
          "network_switching",
          "network_monitoring",
          "auto_recovery",
        ],
        subscribedActions: [
          "NETWORK_SCAN_RESULT", "WIFI_CONNECTED", "WIFI_DISCONNECTED",
          "DEVICE_FOUND", "NETWORK_CHANGED", "HOTSPOT_CREATED", "HOTSPOT_STOPPED",
          "LOCAL_IP", "NETWORK_STATUS", "DISCOVERY_COMPLETE",
        ],
      },
      (msg) => this._handleGatewayMessage(msg),
    );
    this._startNetworkMonitor();
    this._simulateInitialConnection();
  }

  stop(): void {
    clearInterval(this.monitorInterval);
    clearTimeout(this.discoveryTimeout);
    clearTimeout(this.recoveryTimeout);
    gateway.unregisterEngine("wifi_engine", this.token);
  }

  // ── Commands (§1.4) ────────────────────────────────────────────────────────

  /** StartDiscovery: begin scanning for ESP32 devices on local network */
  startDiscovery(): void {
    this._logEvent("StartDiscovery", "Scanning local network for ESP32 devices");
    clearTimeout(this.discoveryTimeout);
    this.discoveryTimeout = setTimeout(() => this._runDiscovery(), 400);
  }

  /** StopDiscovery: halt active discovery scan */
  stopDiscovery(): void {
    clearTimeout(this.discoveryTimeout);
    this._logEvent("StopDiscovery", "Discovery halted");
  }

  /** ScanNetwork: scan the local subnet for known/new devices */
  scanNetwork(): void {
    this._logEvent("ScanNetwork", "Subnet scan initiated");
    this.startDiscovery();
  }

  /** RefreshDeviceList: re-verify and update device registry */
  refreshDeviceList(): void {
    this._logEvent("RefreshDeviceList", "Re-verifying device registry");
    for (const dev of this._devices.values()) {
      const online = Math.random() > 0.1;
      dev.status = online ? "online" : "unreachable";
      dev.lastSeen = online ? Date.now() : dev.lastSeen;
    }
    gateway.broadcastMessage("wifi_engine", "DEVICE_REGISTRY_UPDATED", { count: this._devices.size });
  }

  /** GetLocalIPAddress: retrieve current local IP of a device */
  getLocalIPAddress(deviceId?: string): string {
    if (deviceId) {
      return this._devices.get(deviceId)?.ip ?? "";
    }
    return this._localIP;
  }

  /** ConnectDevice: establish communication session */
  connectDevice(deviceId: string): void {
    const dev = this._devices.get(deviceId);
    if (!dev) return;
    dev.status = "online";
    dev.lastSeen = Date.now();
    this._emit("DeviceConnected", { deviceId, ip: dev.ip, method: dev.discoveryMethod });
    this._logEvent("DeviceConnected", `${deviceId} at ${dev.ip}`);
    gateway.broadcastMessage("wifi_engine", "DEVICE_CONNECTED", { deviceId, ip: dev.ip });
  }

  /** DisconnectDevice: close communication session */
  disconnectDevice(deviceId: string): void {
    const dev = this._devices.get(deviceId);
    if (!dev) return;
    dev.status = "offline";
    this._emit("DeviceDisconnected", { deviceId, reason: "manual" });
    this._logEvent("DeviceDisconnected", `${deviceId} disconnected`);
  }

  // ── Hotspot Manager (§1.3.1) ───────────────────────────────────────────────

  toggleHotspot(): void {
    if (this._hotspot.active) {
      this._stopHotspot();
    } else {
      this._startHotspot();
    }
  }

  private _startHotspot(): void {
    this._hotspot.active = true;
    this._logEvent("HotspotEnabled", `SSID: ${this._hotspot.ssid} ch:${this._hotspot.channel}`);
    this._emit("HotspotEnabled", { ssid: this._hotspot.ssid, channel: this._hotspot.channel });
    gateway.broadcastMessage("wifi_engine", "HOTSPOT_AVAILABLE", {
      ssid: this._hotspot.ssid,
      channel: this._hotspot.channel,
    });
    // Simulate ESP32 reconnecting after hotspot starts
    setTimeout(() => this._simulateESP32Reconnect(), 2500);
  }

  private _stopHotspot(): void {
    this._hotspot.active = false;
    this._hotspot.connectedDevices = [];
    this._logEvent("HotspotDisabled", "Hotspot stopped");
    this._emit("HotspotDisabled", {});
    gateway.broadcastMessage("wifi_engine", "HOTSPOT_UNAVAILABLE", {});
  }

  updateHotspot(ssid: string, password: string): void {
    const old = { ...this._hotspot };
    this._hotspot.ssid = ssid;
    this._hotspot.password = password;
    this._logEvent("HotspotChanged", `SSID updated → ${ssid}`);
    gateway.broadcastMessage("wifi_engine", "HOTSPOT_CHANGED", { old: old.ssid, new: ssid });
    // Auto-update stored credentials on ESP32 if BT available
    this._reprovisionIfBTAvailable();
  }

  // ── Secure WiFi Provisioning (§1.3.2) ─────────────────────────────────────

  /** ProvisionWiFi: securely send WiFi/hotspot credentials to ESP32 over Bluetooth */
  provisionDevice(deviceMac?: string): void {
    if (this._provisioning.step !== "idle" && this._provisioning.step !== "failed") return;
    this._provisioning = { step: "bt_pairing", progress: 0, deviceMac, startedAt: Date.now() };
    this._logEvent("ProvisionStart", "Beginning secure WiFi provisioning via Bluetooth");
    this._runProvisioningSteps();
  }

  cancelProvisioning(): void {
    this._provisioning = { step: "idle", progress: 0 };
  }

  private _runProvisioningSteps(): void {
    const steps: Array<{ step: ProvisioningStep; label: string; duration: number; progress: number }> = [
      { step: "bt_pairing",          label: "Pairing via Bluetooth",           duration: 1800, progress: 20 },
      { step: "credential_transfer", label: "Transferring hotspot credentials", duration: 1500, progress: 50 },
      { step: "esp32_connecting",    label: "ESP32 connecting to hotspot",      duration: 2200, progress: 75 },
      { step: "discovering",         label: "Discovering device on network",    duration: 1200, progress: 90 },
      { step: "complete",            label: "Device provisioned successfully",  duration: 0,    progress: 100 },
    ];

    let delay = 0;
    steps.forEach(({ step, label, duration, progress }) => {
      setTimeout(() => {
        if (this._provisioning.step === "idle") return;
        this._provisioning = { ...this._provisioning, step, progress };
        this._logEvent("ProvisionStep", label);
        gateway.broadcastMessage("wifi_engine", "PROVISION_STEP", { step, progress, label });
        if (step === "complete") {
          const deviceId = `ESP32-${this._provisioning.deviceMac?.slice(-5) ?? Math.random().toString(36).slice(2,7).toUpperCase()}`;
          const ip = `192.168.43.${Math.floor(Math.random() * 200) + 10}`;
          this._registerDevice({
            id: deviceId,
            mac: this._provisioning.deviceMac ?? "AA:BB:CC:DD:EE:FF",
            hostname: `luma-${deviceId.toLowerCase()}`,
            ip,
            type: "ESP32",
            firmwareVersion: "v2.4.1",
            lastSeen: Date.now(),
            discoveryMethod: "mdns",
            status: "online",
          });
          this._emit("DeviceConnected", { deviceId, ip, method: "provisioning" });
        }
      }, delay);
      delay += duration;
    });
  }

  private _reprovisionIfBTAvailable(): void {
    const alreadyProvisioned = [...this._devices.values()].filter(d => d.status === "online");
    if (alreadyProvisioned.length > 0) {
      this._logEvent("AutoReprovision", "Updating ESP32 credentials via Bluetooth");
      gateway.broadcastMessage("wifi_engine", "CREDENTIALS_UPDATED", {
        devices: alreadyProvisioned.map(d => d.id),
      });
    }
  }

  // ── Auto Connection Manager (§1.3.3) ──────────────────────────────────────

  connectWiFi(ssid: string, password: string): void {
    this._logEvent("ConnectWiFi", `Connecting to SSID: ${ssid}`);
    setTimeout(() => {
      this._connected = true;
      this._currentSSID = ssid;
      this._localIP = `192.168.1.${Math.floor(Math.random() * 200) + 10}`;
      this._networkStats = { ...this._networkStats, ssid, rssi: -52, latency: 18, localNetAvailable: true };
      this._emit("WiFiConnected", { ssid, ip: this._localIP, rssi: -52 });
      this._logEvent("WiFiConnected", `Connected to ${ssid} at ${this._localIP}`);
      gateway.broadcastMessage("wifi_engine", "WIFI_CONNECTED", { ssid, ip: this._localIP });
      setTimeout(() => this.startDiscovery(), 500);
    }, 1500);
  }

  disconnectWiFi(): void {
    this._connected = false;
    this._currentSSID = "";
    this._emit("WiFiDisconnected", { reason: "user_initiated" });
    this._emit("NetworkLost", { reason: "WiFi disconnected" });
    this._logEvent("WiFiDisconnected", "Disconnected from WiFi");
  }

  scanNetworks(): void {
    setTimeout(() => {
      this._networks = MOCK_NETWORKS;
      gateway.broadcastMessage("wifi_engine", "NETWORK_SCAN_RESULT", { networks: this._networks });
    }, 1200);
  }

  // ── Device Discovery Engine (§1.3.4) ──────────────────────────────────────

  private _runDiscovery(): void {
    const methods: Array<"mdns" | "udp_broadcast" | "heartbeat"> = ["mdns", "udp_broadcast", "heartbeat"];
    const devices: RegisteredDevice[] = [
      {
        id: "ESP32-L001",
        mac: "A4:CF:12:3D:7E:01",
        hostname: "luma-living-room.local",
        ip: `192.168.${this._hotspot.active ? "43" : "1"}.${Math.floor(Math.random() * 200) + 10}`,
        type: "ESP32",
        firmwareVersion: "v2.4.1",
        lastSeen: Date.now(),
        discoveryMethod: methods[Math.floor(Math.random() * 3)],
        status: "online",
        deviceHello: { deviceId: "L001", mac: "A4:CF:12:3D:7E:01", firmwareVersion: "v2.4.1", deviceType: "SmartLamp" },
      },
      {
        id: "ESP32-L003",
        mac: "A4:CF:12:3D:7E:03",
        hostname: "luma-kitchen.local",
        ip: `192.168.${this._hotspot.active ? "43" : "1"}.${Math.floor(Math.random() * 200) + 50}`,
        type: "ESP32",
        firmwareVersion: "v2.4.0",
        lastSeen: Date.now(),
        discoveryMethod: "udp_broadcast",
        status: "online",
        deviceHello: { deviceId: "L003", mac: "A4:CF:12:3D:7E:03", firmwareVersion: "v2.4.0", deviceType: "SmartLamp" },
      },
    ];

    for (const dev of devices) {
      this._registerDevice(dev);
    }
    this._logEvent("DiscoveryComplete", `Found ${devices.length} devices via mDNS/UDP/heartbeat`);
    gateway.broadcastMessage("wifi_engine", "DISCOVERY_COMPLETE", { devices });
  }

  private _registerDevice(dev: RegisteredDevice): void {
    const existing = this._devices.get(dev.id);
    if (existing && existing.ip !== dev.ip) {
      const oldIp = existing.ip;
      existing.ip = dev.ip;
      existing.lastSeen = Date.now();
      existing.status = "online";
      this._emit("IPAddressUpdated", { deviceId: dev.id, oldIp, newIp: dev.ip });
      this._logEvent("IPAddressUpdated", `${dev.id}: ${oldIp} → ${dev.ip}`);
      gateway.broadcastMessage("wifi_engine", "IP_ADDRESS_CHANGED", { deviceId: dev.id, ip: dev.ip });
    } else {
      this._devices.set(dev.id, dev);
      this._emit("DeviceDiscovered", { device: dev });
      this._logEvent("DeviceDiscovered", `${dev.id} at ${dev.ip} via ${dev.discoveryMethod}`);
      gateway.broadcastMessage("wifi_engine", "DEVICE_FOUND", { device: dev });
    }
  }

  // ── Network Monitor (§1.3.7) ───────────────────────────────────────────────

  private _startNetworkMonitor(): void {
    this.monitorInterval = setInterval(() => this._updateNetworkStats(), 3000);
  }

  private _updateNetworkStats(): void {
    if (!this._connected && !this._hotspot.active) return;
    const rssi = this._networkStats.rssi + (Math.random() * 4 - 2);
    const latency = Math.max(5, this._networkStats.latency + (Math.random() * 10 - 5));
    const esp32Latency = Math.max(3, this._networkStats.esp32Latency + (Math.random() * 8 - 4));

    this._networkStats = {
      ...this._networkStats,
      rssi: Math.max(-90, Math.min(-30, rssi)),
      latency: Math.round(latency),
      esp32Latency: Math.round(esp32Latency),
      signalQuality: rssiToQuality(rssi),
      esp32Connected: this._devices.size > 0,
    };

    // Simulate random internet drop / recovery
    if (Math.random() < 0.01) {
      this._networkStats.internetAvailable = false;
      this._emit("NetworkLost", { reason: "Internet connectivity lost" });
      setTimeout(() => {
        this._networkStats.internetAvailable = true;
        this._emit("ConnectionRecovered", { deviceId: "internet", recoveryTime: 3000 });
      }, 3000 + Math.random() * 5000);
    }

    gateway.broadcastMessage("wifi_engine", "NETWORK_STATS_UPDATED", this._networkStats as unknown as Record<string, unknown>);
  }

  // ── Auto Recovery (§1.3.8 / §1.8) ─────────────────────────────────────────

  triggerRecovery(deviceId: string): void {
    if (this._recovery.active) return;
    this._recovery = { active: true, attempt: 1, maxAttempts: 5, nextRetryIn: 0, phase: "checking_network" };
    this._logEvent("RecoveryStarted", `Attempting auto-recovery for ${deviceId}`);
    this._runRecoverySequence(deviceId);
  }

  private _runRecoverySequence(deviceId: string): void {
    const phases: Array<{ phase: RecoveryState["phase"]; label: string; duration: number }> = [
      { phase: "checking_network",    label: "Checking local network availability", duration: 800 },
      { phase: "searching_device",    label: "Searching for ESP32 on network",       duration: 1500 },
      { phase: "rediscovering_ip",    label: "Rediscovering device IP address",      duration: 1000 },
      { phase: "restoring",          label: "Restoring communication channel",       duration: 800 },
    ];

    let delay = 0;
    phases.forEach(({ phase, label, duration }) => {
      setTimeout(() => {
        this._recovery = { ...this._recovery, phase };
        this._logEvent("RecoveryPhase", label);
        gateway.broadcastMessage("wifi_engine", "RECOVERY_PHASE", { phase, label });
      }, delay);
      delay += duration;
    });

    setTimeout(() => {
      const success = Math.random() > 0.15;
      if (success) {
        this._recovery = { active: false, attempt: 0, maxAttempts: 5, nextRetryIn: 0, phase: "idle" };
        this.startDiscovery();
        this._emit("ConnectionRecovered", { deviceId, recoveryTime: delay });
        this._logEvent("RecoverySuccess", `Connection restored to ${deviceId}`);
        gateway.broadcastMessage("wifi_engine", "CONNECTION_RECOVERED", { deviceId });
      } else if (this._recovery.attempt < this._recovery.maxAttempts) {
        const backoff = Math.min(30, Math.pow(2, this._recovery.attempt));
        this._recovery = {
          ...this._recovery,
          active: true,
          attempt: this._recovery.attempt + 1,
          nextRetryIn: backoff,
          phase: "checking_network",
        };
        this._logEvent("RecoveryRetry", `Retry ${this._recovery.attempt}/${this._recovery.maxAttempts} in ${backoff}s`);
        this.recoveryTimeout = setTimeout(() => this._runRecoverySequence(deviceId), backoff * 1000);
      } else {
        this._recovery = { ...this._recovery, active: false, phase: "failed" };
        this._logEvent("RecoveryFailed", `Auto-recovery failed after ${this._recovery.maxAttempts} attempts`);
        gateway.broadcastMessage("wifi_engine", "RECOVERY_FAILED", { deviceId });
      }
    }, delay);
  }

  // ── Simulated initial connection ────────────────────────────────────────────

  private _simulateInitialConnection(): void {
    setTimeout(() => {
      this._connected = true;
      this._currentSSID = "HomeNetwork-5G";
      this._localIP = "192.168.1.42";
      this._networkStats = {
        ssid: "HomeNetwork-5G",
        rssi: -58,
        channel: 36,
        frequency: 5180,
        linkSpeed: 300,
        latency: 22,
        internetAvailable: true,
        localNetAvailable: true,
        esp32Connected: false,
        esp32Latency: 0,
        signalQuality: "good",
      };
      this._emit("WiFiConnected", { ssid: this._currentSSID, ip: this._localIP, rssi: -58 });
      setTimeout(() => this.startDiscovery(), 800);
    }, 600);
  }

  private _simulateESP32Reconnect(): void {
    const ip = `192.168.43.${Math.floor(Math.random() * 200) + 10}`;
    const dev: RegisteredDevice = {
      id: "ESP32-L001",
      mac: "A4:CF:12:3D:7E:01",
      hostname: "luma-hotspot-device.local",
      ip,
      type: "ESP32",
      firmwareVersion: "v2.4.1",
      lastSeen: Date.now(),
      discoveryMethod: "heartbeat",
      status: "online",
    };
    this._registerDevice(dev);
    const hsDevices = [...this._hotspot.connectedDevices];
    hsDevices.push({ mac: dev.mac, ip, hostname: dev.hostname, connectedAt: Date.now() });
    this._hotspot = { ...this._hotspot, connectedDevices: hsDevices };
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getNetworks(): WiFiNetwork[] { return this._networks; }
  getHotspot(): HotspotState { return this._hotspot; }
  getProvisioning(): ProvisioningState { return this._provisioning; }
  getNetworkStats(): NetworkStats { return this._networkStats; }
  getDevices(): RegisteredDevice[] { return [...this._devices.values()]; }
  getRecovery(): RecoveryState { return this._recovery; }
  isConnected(): boolean { return this._connected; }
  getCurrentSSID(): string { return this._currentSSID; }
  getLocalIP(): string { return this._localIP; }
  getEventLog(): { time: number; event: string; detail: string }[] { return [...this._eventLog].reverse().slice(0, 50); }

  // ── Pub/Sub ────────────────────────────────────────────────────────────────

  on<E extends WiFiEvent>(event: E, handler: WiFiHandler<E>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler as AnyWiFiHandler);
    return () => {
      const arr = this.handlers.get(event);
      if (arr) { const i = arr.indexOf(handler as AnyWiFiHandler); if (i > -1) arr.splice(i, 1); }
    };
  }

  private _emit<E extends WiFiEvent>(event: E, data: WiFiEventPayload[E]): void {
    this.handlers.get(event)?.forEach(h => h(data));
  }

  private _logEvent(event: string, detail: string): void {
    this._eventLog.push({ time: Date.now(), event, detail });
    if (this._eventLog.length > 200) this._eventLog.shift();
  }

  private _handleGatewayMessage(_msg: InternalMessage): void {
    // Gateway message routing — engines communicate via internal bus
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rssiToQuality(rssi: number): NetworkStats["signalQuality"] {
  if (rssi >= -50) return "excellent";
  if (rssi >= -65) return "good";
  if (rssi >= -75) return "fair";
  if (rssi >= -85) return "poor";
  return "none";
}

const MOCK_NETWORKS: WiFiNetwork[] = [
  { ssid: "HomeNetwork-5G",   bssid: "AA:BB:CC:DD:EE:01", rssi: -45, secured: true,  channel: 36, frequency: 5180, linkSpeed: 300 },
  { ssid: "HomeNetwork-2.4G", bssid: "AA:BB:CC:DD:EE:02", rssi: -58, secured: true,  channel: 6,  frequency: 2437, linkSpeed: 150 },
  { ssid: "LUMA-Hotspot",     bssid: "AA:BB:CC:DD:EE:03", rssi: -52, secured: true,  channel: 6,  frequency: 2437, linkSpeed: 54  },
  { ssid: "Neighbor-WiFi",    bssid: "AA:BB:CC:DD:EE:04", rssi: -78, secured: true,  channel: 11, frequency: 2462, linkSpeed: 72  },
  { ssid: "IoT-Net",          bssid: "AA:BB:CC:DD:EE:05", rssi: -71, secured: false, channel: 1,  frequency: 2412, linkSpeed: 54  },
];

const DEFAULT_STATS: NetworkStats = {
  ssid: "",
  rssi: -99,
  channel: 0,
  frequency: 0,
  linkSpeed: 0,
  latency: 0,
  internetAvailable: false,
  localNetAvailable: false,
  esp32Connected: false,
  esp32Latency: 0,
  signalQuality: "none",
};

export const mobileWiFiEngine = new MobileWiFiEngine();
