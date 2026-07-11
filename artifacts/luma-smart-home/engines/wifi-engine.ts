import { gateway } from "./internal-api/gateway";
import type { InternalMessage } from "./internal-api/types";

export interface NetworkScanResult {
  ssid: string;
  rssi: number;
  secured: boolean;
  channel: number;
}

export interface DiscoveredDevice {
  ip: string;
  mac: string;
  hostname: string;
  type: string;
}

export type WiFiEventType =
  | "WiFiConnected"
  | "WiFiDisconnected"
  | "DeviceFound"
  | "NetworkChanged"
  | "HotspotCreated"
  | "HotspotStopped";

type WiFiEventHandler = (data: Record<string, unknown>) => void;

export class MobileWiFiEngine {
  private token: string = "";
  private eventHandlers: Map<WiFiEventType, WiFiEventHandler[]> = new Map();
  private networks: NetworkScanResult[] = [];
  private discoveredDevices: DiscoveredDevice[] = [];

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "wifi_engine",
        name: "WiFi & Hotspot Engine",
        version: "1.0.0",
        capabilities: [
          "wifi_scanning",
          "esp32_discovery",
          "hotspot_management",
          "ip_detection",
          "network_switching",
        ],
        subscribedActions: [
          "NETWORK_SCAN_RESULT",
          "WIFI_CONNECTED",
          "WIFI_DISCONNECTED",
          "DEVICE_FOUND",
          "NETWORK_CHANGED",
          "HOTSPOT_CREATED",
          "HOTSPOT_STOPPED",
          "LOCAL_IP",
          "NETWORK_STATUS",
          "DISCOVERY_COMPLETE",
        ],
      },
      (msg) => this.handleMessage(msg),
    );
  }

  stop(): void {
    gateway.unregisterEngine("wifi_engine", this.token);
  }

  scanNetworks(): void {
    gateway.sendCommand("wifi_engine", "wifi_engine", "SCAN_NETWORKS", {});
  }

  connectWiFi(ssid: string, password: string): void {
    gateway.sendCommand("wifi_engine", "wifi_engine", "CONNECT_WIFI", { ssid, password }, "high");
  }

  createHotspot(ssid?: string, password?: string): void {
    gateway.sendCommand("wifi_engine", "wifi_engine", "CREATE_HOTSPOT", { ssid, password }, "high");
  }

  discoverDevices(): void {
    gateway.sendCommand("wifi_engine", "wifi_engine", "DISCOVER_DEVICES", {});
  }

  getLocalIP(): void {
    gateway.sendCommand("wifi_engine", "wifi_engine", "GET_LOCAL_IP", {});
  }

  on(event: WiFiEventType, handler: WiFiEventHandler): () => void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
    this.eventHandlers.get(event)!.push(handler);
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx > -1) handlers.splice(idx, 1);
      }
    };
  }

  getNetworks(): NetworkScanResult[] { return this.networks; }
  getDiscoveredDevices(): DiscoveredDevice[] { return this.discoveredDevices; }

  private emit(event: WiFiEventType, data: Record<string, unknown>): void {
    this.eventHandlers.get(event)?.forEach((h) => h(data));
  }

  private handleMessage(message: InternalMessage): void {
    const p = message.payload as Record<string, unknown>;
    switch (message.action) {
      case "NETWORK_SCAN_RESULT":
        this.networks = (p["networks"] as NetworkScanResult[]) ?? [];
        this.emit("NetworkChanged", p);
        break;
      case "WIFI_CONNECTED":
        this.emit("WiFiConnected", p);
        break;
      case "WIFI_DISCONNECTED":
        this.emit("WiFiDisconnected", p);
        break;
      case "DEVICE_FOUND":
        this.discoveredDevices.push(p["device"] as DiscoveredDevice);
        this.emit("DeviceFound", p);
        break;
      case "NETWORK_CHANGED":
        this.emit("NetworkChanged", p);
        break;
      case "HOTSPOT_CREATED":
        this.emit("HotspotCreated", p);
        break;
      case "HOTSPOT_STOPPED":
        this.emit("HotspotStopped", p);
        break;
    }
  }
}

export const mobileWiFiEngine = new MobileWiFiEngine();
