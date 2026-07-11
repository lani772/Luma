import { BaseEngine } from "../base-engine";
import type { EngineId, InternalMessage } from "../../internal-api/types";
import { logger } from "../../lib/logger";

export interface NetworkInfo {
  ssid: string;
  bssid: string;
  rssi: number;
  channel: number;
  secured: boolean;
}

export interface DiscoveredDevice {
  ip: string;
  mac: string;
  hostname: string;
  type: string;
  lastSeen: string;
}

export interface HotspotConfig {
  ssid: string;
  password: string;
  channel: number;
  maxConnections: number;
  active: boolean;
}

export class WiFiEngine extends BaseEngine {
  readonly id: EngineId = "wifi_engine";
  readonly name = "WiFi & Hotspot Engine";
  readonly version = "1.0.0";
  readonly capabilities = [
    "wifi_scanning",
    "esp32_discovery",
    "local_network_communication",
    "hotspot_management",
    "ip_detection",
    "network_switching",
    "offline_local_communication",
  ];
  readonly subscribedActions = [
    "SCAN_NETWORKS",
    "CONNECT_WIFI",
    "CREATE_HOTSPOT",
    "STOP_HOTSPOT",
    "DISCOVER_DEVICES",
    "GET_LOCAL_IP",
    "SWITCH_NETWORK",
    "GET_NETWORK_STATUS",
  ];

  private knownNetworks: NetworkInfo[] = [];
  private discoveredDevices: Map<string, DiscoveredDevice> = new Map();
  private hotspotConfig: HotspotConfig | null = null;
  private currentNetwork: NetworkInfo | null = null;
  private localIP: string = "0.0.0.0";

  protected onStart(): void {
    this.simulateNetworkScan();
  }

  protected onStop(): void {}

  protected handleMessage(message: InternalMessage): void {
    logger.debug({ action: message.action }, "[WiFiEngine] received");

    switch (message.action) {
      case "SCAN_NETWORKS":
        this.handleScanNetworks(message);
        break;
      case "CONNECT_WIFI":
        this.handleConnectWiFi(message);
        break;
      case "CREATE_HOTSPOT":
        this.handleCreateHotspot(message);
        break;
      case "STOP_HOTSPOT":
        this.handleStopHotspot(message);
        break;
      case "DISCOVER_DEVICES":
        this.handleDiscoverDevices(message);
        break;
      case "GET_LOCAL_IP":
        this.handleGetLocalIP(message);
        break;
      case "SWITCH_NETWORK":
        this.handleSwitchNetwork(message);
        break;
      case "GET_NETWORK_STATUS":
        this.handleGetNetworkStatus(message);
        break;
      default:
        logger.warn({ action: message.action }, "[WiFiEngine] unknown action");
    }
  }

  private handleScanNetworks(message: InternalMessage): void {
    this.simulateNetworkScan();
    this.emit(
      message.source as EngineId,
      "NETWORK_SCAN_RESULT",
      { networks: this.knownNetworks },
      "normal",
    );
  }

  private handleConnectWiFi(message: InternalMessage): void {
    const { ssid, password } = message.payload as { ssid: string; password: string };
    const network = this.knownNetworks.find((n) => n.ssid === ssid);

    if (network) {
      this.currentNetwork = network;
      this.localIP = `192.168.1.${Math.floor(Math.random() * 200) + 10}`;
      this.broadcast("WIFI_CONNECTED", { ssid, localIP: this.localIP }, "high");
      logger.info({ ssid, localIP: this.localIP }, "[WiFiEngine] connected");
    } else {
      this.broadcast("WIFI_DISCONNECTED", { ssid, reason: "network_not_found" }, "high");
    }
  }

  private handleCreateHotspot(message: InternalMessage): void {
    const config = message.payload as Partial<HotspotConfig>;
    this.hotspotConfig = {
      ssid: config.ssid ?? "LUMA_Hotspot",
      password: config.password ?? "luma12345",
      channel: config.channel ?? 6,
      maxConnections: config.maxConnections ?? 8,
      active: true,
    };
    logger.info({ ssid: this.hotspotConfig.ssid }, "[WiFiEngine] hotspot created");
    this.broadcast("HOTSPOT_CREATED", { ...this.hotspotConfig }, "high");
  }

  private handleStopHotspot(_message: InternalMessage): void {
    if (this.hotspotConfig) {
      this.hotspotConfig.active = false;
      this.broadcast("HOTSPOT_STOPPED", { ssid: this.hotspotConfig.ssid }, "normal");
    }
  }

  private handleDiscoverDevices(message: InternalMessage): void {
    const devices = [...this.discoveredDevices.values()];
    devices.forEach((d) => this.broadcast("DEVICE_FOUND", { device: d }, "normal"));
    this.emit(
      message.source as EngineId,
      "DISCOVERY_COMPLETE",
      { devices, count: devices.length },
      "normal",
    );
  }

  private handleGetLocalIP(message: InternalMessage): void {
    this.emit(message.source as EngineId, "LOCAL_IP", { ip: this.localIP }, "normal");
  }

  private handleSwitchNetwork(message: InternalMessage): void {
    const { ssid } = message.payload as { ssid: string };
    const prev = this.currentNetwork?.ssid;
    this.handleConnectWiFi(message);
    this.broadcast("NETWORK_CHANGED", { from: prev, to: ssid }, "high");
  }

  private handleGetNetworkStatus(message: InternalMessage): void {
    this.emit(
      message.source as EngineId,
      "NETWORK_STATUS",
      {
        connected: this.currentNetwork !== null,
        network: this.currentNetwork,
        localIP: this.localIP,
        hotspotActive: this.hotspotConfig?.active ?? false,
        discoveredDevices: this.discoveredDevices.size,
      },
      "normal",
    );
  }

  private simulateNetworkScan(): void {
    this.knownNetworks = [
      { ssid: "LUMA_Home_5G", bssid: "AA:BB:CC:DD:EE:FF", rssi: -42, channel: 36, secured: true },
      { ssid: "LUMA_Home_2G", bssid: "AA:BB:CC:DD:EE:EE", rssi: -58, channel: 1, secured: true },
      { ssid: "IoT_Network", bssid: "11:22:33:44:55:66", rssi: -70, channel: 11, secured: false },
    ];
    this.discoveredDevices.set("192.168.1.100", {
      ip: "192.168.1.100",
      mac: "A4:CF:12:23:34:45",
      hostname: "ESP32_Lamp_01",
      type: "esp32",
      lastSeen: new Date().toISOString(),
    });
  }

  getNetworks(): NetworkInfo[] { return this.knownNetworks; }
  getDiscoveredDevices(): DiscoveredDevice[] { return [...this.discoveredDevices.values()]; }
  getLocalIP(): string { return this.localIP; }
  getHotspotConfig(): HotspotConfig | null { return this.hotspotConfig; }
}

export const wifiEngine = new WiFiEngine();
