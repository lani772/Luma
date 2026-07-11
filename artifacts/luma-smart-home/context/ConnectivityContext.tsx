import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { mobileWiFiEngine } from "@/engines/wifi-engine";
import { mobileP2PEngine } from "@/engines/p2p-engine";
import type {
  WiFiNetwork, HotspotState, ProvisioningState, NetworkStats,
  RegisteredDevice, RecoveryState,
} from "@/engines/wifi-engine";
import type {
  MeshPeer, ActiveRoute, MeshMessage, GatewayInfo, OfflineQueueEntry,
  IntelligentReceiverLocation, TransportType, MaintenanceSyncResult,
} from "@/engines/p2p-engine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConnectivityEventEntry {
  time: number;
  source: "wifi" | "mesh";
  event: string;
  detail: string;
}

interface ConnectivityState {
  // WiFi
  wifiConnected: boolean;
  currentSSID: string;
  localIP: string;
  networks: WiFiNetwork[];
  hotspot: HotspotState;
  provisioning: ProvisioningState;
  networkStats: NetworkStats;
  registeredDevices: RegisteredDevice[];
  recovery: RecoveryState;
  // Mesh
  peers: MeshPeer[];
  gateways: GatewayInfo[];
  activeRoute: ActiveRoute | null;
  meshMessages: MeshMessage[];
  offlineQueue: OfflineQueueEntry[];
  deviceLocations: IntelligentReceiverLocation[];
  isGatewayMode: boolean;
  meshSynced: boolean;
  isDiscoveringPeers: boolean;
  // Combined log
  eventLog: ConnectivityEventEntry[];
}

interface ConnectivityActions {
  // WiFi commands
  startDiscovery: () => void;
  stopDiscovery: () => void;
  scanNetworks: () => void;
  connectWiFi: (ssid: string, password: string) => void;
  disconnectWiFi: () => void;
  toggleHotspot: () => void;
  updateHotspot: (ssid: string, password: string) => void;
  provisionDevice: (mac?: string) => void;
  cancelProvisioning: () => void;
  connectDevice: (deviceId: string) => void;
  disconnectDevice: (deviceId: string) => void;
  refreshDeviceList: () => void;
  getLocalIPAddress: (deviceId?: string) => string;
  triggerRecovery: (deviceId: string) => void;
  // Mesh commands
  discoverPeers: (transport?: TransportType) => void;
  connectPeer: (peerId: string) => void;
  disconnectPeer: (peerId: string) => void;
  sendMeshMessage: (toPeerId: string, deviceId: string, command: string, params: Record<string, unknown>) => string;
  storeMessage: (deviceId: string, command: string, params: Record<string, unknown>) => string;
  syncMesh: () => void;
  selectBestRoute: () => ActiveRoute;
  registerGateway: (peerId: string, type: GatewayInfo["type"], targetDevices: string[]) => void;
  discoverGateway: () => void;
  enableGatewayMode: () => void;
  disableGatewayMode: () => void;
  requestMaintenanceSync: (deviceId: string) => MaintenanceSyncResult;
}

type ConnectivityContextType = ConnectivityState & ConnectivityActions;

// ─── Context ──────────────────────────────────────────────────────────────────

const ConnectivityContext = createContext<ConnectivityContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [wifiConnected, setWifiConnected] = useState(false);
  const [currentSSID, setCurrentSSID] = useState("");
  const [localIP, setLocalIP] = useState("");
  const [networks, setNetworks] = useState<WiFiNetwork[]>([]);
  const [hotspot, setHotspot] = useState<HotspotState>(mobileWiFiEngine.getHotspot());
  const [provisioning, setProvisioning] = useState<ProvisioningState>({ step: "idle", progress: 0 });
  const [networkStats, setNetworkStats] = useState<NetworkStats>(mobileWiFiEngine.getNetworkStats());
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [recovery, setRecovery] = useState<RecoveryState>(mobileWiFiEngine.getRecovery());

  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [gateways, setGateways] = useState<GatewayInfo[]>([]);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [meshMessages, setMeshMessages] = useState<MeshMessage[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueEntry[]>([]);
  const [deviceLocations, setDeviceLocations] = useState<IntelligentReceiverLocation[]>([]);
  const [isGatewayMode, setIsGatewayMode] = useState(false);
  const [meshSynced, setMeshSynced] = useState(false);
  const [isDiscoveringPeers, setIsDiscoveringPeers] = useState(false);

  const [eventLog, setEventLog] = useState<ConnectivityEventEntry[]>([]);
  const logRef = useRef(eventLog);
  useEffect(() => { logRef.current = eventLog; }, [eventLog]);

  const pushLog = useCallback((source: "wifi" | "mesh", event: string, detail: string) => {
    setEventLog(prev => [{ time: Date.now(), source, event, detail }, ...prev].slice(0, 80));
  }, []);

  // Pull engine state into React periodically
  const syncInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    // Start both engines
    mobileWiFiEngine.start();
    mobileP2PEngine.start();

    // ── WiFi event subscriptions ──────────────────────────────────────────
    const unsubs: Array<() => void> = [];

    unsubs.push(mobileWiFiEngine.on("WiFiConnected", (d) => {
      setWifiConnected(true);
      setCurrentSSID(d.ssid);
      setLocalIP(d.ip);
      pushLog("wifi", "WiFiConnected", `${d.ssid} · ${d.ip}`);
    }));
    unsubs.push(mobileWiFiEngine.on("WiFiDisconnected", () => {
      setWifiConnected(false);
      pushLog("wifi", "WiFiDisconnected", "Connection lost");
    }));
    unsubs.push(mobileWiFiEngine.on("HotspotEnabled", (d) => {
      setHotspot({ ...mobileWiFiEngine.getHotspot(), active: true });
      pushLog("wifi", "HotspotEnabled", `SSID: ${d.ssid}`);
    }));
    unsubs.push(mobileWiFiEngine.on("HotspotDisabled", () => {
      setHotspot({ ...mobileWiFiEngine.getHotspot(), active: false });
      pushLog("wifi", "HotspotDisabled", "Hotspot stopped");
    }));
    unsubs.push(mobileWiFiEngine.on("DeviceDiscovered", (d) => {
      setRegisteredDevices(mobileWiFiEngine.getDevices());
      pushLog("wifi", "DeviceDiscovered", `${d.device.id} at ${d.device.ip} via ${d.device.discoveryMethod}`);
    }));
    unsubs.push(mobileWiFiEngine.on("DeviceConnected", (d) => {
      setRegisteredDevices(mobileWiFiEngine.getDevices());
      pushLog("wifi", "DeviceConnected", `${d.deviceId} connected at ${d.ip}`);
    }));
    unsubs.push(mobileWiFiEngine.on("DeviceDisconnected", (d) => {
      setRegisteredDevices(mobileWiFiEngine.getDevices());
      pushLog("wifi", "DeviceDisconnected", d.deviceId);
    }));
    unsubs.push(mobileWiFiEngine.on("IPAddressUpdated", (d) => {
      setRegisteredDevices(mobileWiFiEngine.getDevices());
      pushLog("wifi", "IPAddressUpdated", `${d.deviceId}: ${d.oldIp} → ${d.newIp}`);
    }));
    unsubs.push(mobileWiFiEngine.on("ConnectionRecovered", (d) => {
      setRecovery(mobileWiFiEngine.getRecovery());
      pushLog("wifi", "ConnectionRecovered", `${d.deviceId} recovered in ${d.recoveryTime}ms`);
    }));
    unsubs.push(mobileWiFiEngine.on("NetworkLost", (d) => {
      pushLog("wifi", "NetworkLost", d.reason);
    }));

    // ── P2P event subscriptions ───────────────────────────────────────────
    unsubs.push(mobileP2PEngine.on("PeerFound", (d: unknown) => {
      const { peer } = d as { peer: MeshPeer };
      setPeers(mobileP2PEngine.getPeers());
      pushLog("mesh", "PeerFound", `${peer.name} via ${peer.transport}`);
    }));
    unsubs.push(mobileP2PEngine.on("PeerConnected", (d: unknown) => {
      const { peer } = d as { peer: MeshPeer };
      setPeers(mobileP2PEngine.getPeers());
      pushLog("mesh", "PeerConnected", `${peer.name} joined mesh`);
    }));
    unsubs.push(mobileP2PEngine.on("PeerDisconnected", (d: unknown) => {
      const { peer } = d as { peer: MeshPeer };
      setPeers(mobileP2PEngine.getPeers());
      pushLog("mesh", "PeerDisconnected", peer.name);
    }));
    unsubs.push(mobileP2PEngine.on("MeshCreated", (d: unknown) => {
      const { size } = d as { size: number };
      setPeers(mobileP2PEngine.getPeers());
      pushLog("mesh", "MeshCreated", `${size} peers in mesh`);
    }));
    unsubs.push(mobileP2PEngine.on("RouteUpdated", (d: unknown) => {
      const { route } = d as { route: ActiveRoute };
      setActiveRoute(route);
      pushLog("mesh", "RouteChanged", `Active: ${route.label}`);
    }));
    unsubs.push(mobileP2PEngine.on("GatewayAvailable", (d: unknown) => {
      const { gateway } = d as { gateway: GatewayInfo };
      setGateways(mobileP2PEngine.getGateways());
      pushLog("mesh", "GatewayAvailable", gateway.name);
    }));
    unsubs.push(mobileP2PEngine.on("GatewayDiscovered", (d: unknown) => {
      const { gateway } = d as { gateway: GatewayInfo };
      setGateways(mobileP2PEngine.getGateways());
      pushLog("mesh", "GatewayDiscovered", gateway?.name ?? "Unknown gateway");
    }));
    unsubs.push(mobileP2PEngine.on("GatewayLost", () => {
      setGateways(mobileP2PEngine.getGateways());
      pushLog("mesh", "GatewayLost", "Gateway disconnected");
    }));
    unsubs.push(mobileP2PEngine.on("MessageDelivered", (d: unknown) => {
      setMeshMessages(mobileP2PEngine.getMessages());
      setOfflineQueue(mobileP2PEngine.getOfflineQueue());
      const { messageId } = d as { messageId?: string };
      if (messageId) pushLog("mesh", "MessageDelivered", messageId);
    }));
    unsubs.push(mobileP2PEngine.on("MessageStored", () => {
      setOfflineQueue(mobileP2PEngine.getOfflineQueue());
      pushLog("mesh", "MessageStored", "Command queued offline");
    }));
    unsubs.push(mobileP2PEngine.on("MeshSynchronized", (d: unknown) => {
      const { synced } = d as { synced: number };
      setMeshSynced(true);
      setOfflineQueue(mobileP2PEngine.getOfflineQueue());
      pushLog("mesh", "MeshSynchronized", `${synced} messages synced`);
    }));
    unsubs.push(mobileP2PEngine.on("MaintenanceSyncCompleted", (d: unknown) => {
      const { deviceId } = d as { deviceId: string };
      pushLog("mesh", "MaintenanceSyncCompleted", deviceId);
    }));

    // Periodic state sync
    syncInterval.current = setInterval(() => {
      setHotspot(mobileWiFiEngine.getHotspot());
      setNetworkStats(mobileWiFiEngine.getNetworkStats());
      setRegisteredDevices(mobileWiFiEngine.getDevices());
      setRecovery(mobileWiFiEngine.getRecovery());
      setProvisioning(mobileWiFiEngine.getProvisioning());
      setPeers(mobileP2PEngine.getPeers());
      setActiveRoute(mobileP2PEngine.getActiveRoute());
      setOfflineQueue(mobileP2PEngine.getOfflineQueue());
      setDeviceLocations(mobileP2PEngine.getLocations());
      setIsGatewayMode(mobileP2PEngine.isGatewayMode());
      setMeshSynced(mobileP2PEngine.isMeshSynced());
      setIsDiscoveringPeers(mobileP2PEngine.isDiscovering());
    }, 2000);

    return () => {
      unsubs.forEach(u => u());
      clearInterval(syncInterval.current);
      mobileWiFiEngine.stop();
      mobileP2PEngine.stop();
    };
  }, [pushLog]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startDiscovery = useCallback(() => mobileWiFiEngine.startDiscovery(), []);
  const stopDiscovery = useCallback(() => mobileWiFiEngine.stopDiscovery(), []);
  const scanNetworks = useCallback(() => { mobileWiFiEngine.scanNetworks(); setNetworks(mobileWiFiEngine.getNetworks()); }, []);
  const connectWiFi = useCallback((ssid: string, password: string) => mobileWiFiEngine.connectWiFi(ssid, password), []);
  const disconnectWiFi = useCallback(() => mobileWiFiEngine.disconnectWiFi(), []);
  const toggleHotspot = useCallback(() => mobileWiFiEngine.toggleHotspot(), []);
  const updateHotspot = useCallback((ssid: string, password: string) => mobileWiFiEngine.updateHotspot(ssid, password), []);
  const provisionDevice = useCallback((mac?: string) => mobileWiFiEngine.provisionDevice(mac), []);
  const cancelProvisioning = useCallback(() => mobileWiFiEngine.cancelProvisioning(), []);
  const connectDevice = useCallback((deviceId: string) => mobileWiFiEngine.connectDevice(deviceId), []);
  const disconnectDevice = useCallback((deviceId: string) => mobileWiFiEngine.disconnectDevice(deviceId), []);
  const refreshDeviceList = useCallback(() => mobileWiFiEngine.refreshDeviceList(), []);
  const getLocalIPAddress = useCallback((deviceId?: string) => mobileWiFiEngine.getLocalIPAddress(deviceId), []);
  const triggerRecovery = useCallback((deviceId: string) => mobileWiFiEngine.triggerRecovery(deviceId), []);

  const discoverPeers = useCallback((transport?: TransportType) => mobileP2PEngine.discoverPeers(transport), []);
  const connectPeer = useCallback((peerId: string) => mobileP2PEngine.connectPeer(peerId), []);
  const disconnectPeer = useCallback((peerId: string) => mobileP2PEngine.disconnectPeer(peerId), []);
  const sendMeshMessage = useCallback((toPeerId: string, deviceId: string, command: string, params: Record<string, unknown>) =>
    mobileP2PEngine.sendMeshMessage(toPeerId, deviceId, command, params), []);
  const storeMessage = useCallback((deviceId: string, command: string, params: Record<string, unknown>) =>
    mobileP2PEngine.storeMessage(deviceId, command, params), []);
  const syncMesh = useCallback(() => mobileP2PEngine.syncMesh(), []);
  const selectBestRoute = useCallback(() => mobileP2PEngine.selectBestRoute(), []);
  const registerGateway = useCallback((peerId: string, type: GatewayInfo["type"], targetDevices: string[]) =>
    mobileP2PEngine.registerGateway(peerId, type, targetDevices), []);
  const discoverGateway = useCallback(() => mobileP2PEngine.discoverGateway(), []);
  const enableGatewayMode = useCallback(() => { mobileP2PEngine.enableGatewayMode(); setIsGatewayMode(true); }, []);
  const disableGatewayMode = useCallback(() => { mobileP2PEngine.disableGatewayMode(); setIsGatewayMode(false); }, []);
  const requestMaintenanceSync = useCallback((deviceId: string) => mobileP2PEngine.requestMaintenanceSync(deviceId), []);

  return (
    <ConnectivityContext.Provider value={{
      wifiConnected, currentSSID, localIP, networks, hotspot, provisioning,
      networkStats, registeredDevices, recovery,
      peers, gateways, activeRoute, meshMessages, offlineQueue,
      deviceLocations, isGatewayMode, meshSynced, isDiscoveringPeers,
      eventLog,
      startDiscovery, stopDiscovery, scanNetworks, connectWiFi, disconnectWiFi,
      toggleHotspot, updateHotspot, provisionDevice, cancelProvisioning,
      connectDevice, disconnectDevice, refreshDeviceList, getLocalIPAddress,
      triggerRecovery,
      discoverPeers, connectPeer, disconnectPeer, sendMeshMessage, storeMessage,
      syncMesh, selectBestRoute, registerGateway, discoverGateway,
      enableGatewayMode, disableGatewayMode, requestMaintenanceSync,
    }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityContextType {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error("useConnectivity must be used within ConnectivityProvider");
  return ctx;
}
