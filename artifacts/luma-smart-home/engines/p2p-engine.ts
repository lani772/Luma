import { gateway } from "./internal-api/gateway";
import type { InternalMessage } from "./internal-api/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TransportType = "bluetooth" | "wifi_direct" | "lan";
export type RouteType =
  | "direct_wifi"
  | "direct_bluetooth"
  | "bluetooth_mesh"
  | "local_mqtt"
  | "internet_mqtt"
  | "backend_relay";

export interface MeshPeer {
  peerId: string;
  userId: string;
  name: string;
  deviceId?: string;
  transport: TransportType;
  btCapability: boolean;
  appVersion: string;
  encryptionCapability: boolean;
  rssi?: number;
  address: string;
  lastSeen: number;
  trusted: boolean;
  isGateway: boolean;
  hopCount: number;
  online: boolean;
  lastSync: number;
}

export interface RouteHop {
  id: string;
  label: string;
  type: "phone" | "broker" | "gateway" | "device" | "backend";
  status: "online" | "offline" | "relay";
  transport?: string;
}

export interface ActiveRoute {
  type: RouteType;
  label: string;
  hops: RouteHop[];
  latency: number;
  priority: number;
  encrypted: boolean;
  quality: "excellent" | "good" | "fair" | "poor";
  updatedAt: number;
}

export type MessageStatus = "queued" | "in_flight" | "delivered" | "failed" | "expired";

export interface MeshMessage {
  id: string;
  fromPeerId: string;
  toPeerId: string;
  deviceId?: string;
  command?: string;
  payload: unknown;
  timestamp: number;
  expiresAt: number;
  delivered: boolean;
  route: RouteType;
  hopHistory: string[];
  maxHops: number;
  encrypted: boolean;
  verified: boolean;
  retries: number;
  maxRetries: number;
  status: MessageStatus;
}

export type GatewayCapability =
  | "discover_devices"
  | "report_reachability"
  | "sync_time"
  | "deliver_schedules"
  | "deliver_automations"
  | "firmware_notifications"
  | "report_health";

export interface GatewayInfo {
  peerId: string;
  name: string;
  type: "wifi" | "local_mqtt" | "internet_mqtt";
  targetDevices: string[];
  maintenanceOnly: boolean;
  capabilities: GatewayCapability[];
  online: boolean;
  lastHeartbeat: number;
  connectedNetwork: string;
}

export interface IntelligentReceiverLocation {
  deviceId: string;
  lastGPSLocation?: { lat: number; lon: number; accuracy: number };
  lastKnownNetwork: string;
  lastPublicIP: string;
  lastLocalIP: string;
  lastBluetoothPeer?: string;
  lastWiFiSSID: string;
  lastMQTTBroker: string;
  lastOnline: number;
  lastSync: number;
}

export interface OfflineQueueEntry {
  id: string;
  deviceId: string;
  command: string;
  params: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  status: "queued" | "retrying" | "delivered" | "expired" | "failed";
  lastAttempt?: number;
  targetRoute?: RouteType;
}

export interface MaintenanceSyncResult {
  deviceId: string;
  startedAt: number;
  completedAt?: number;
  items: string[];
  success: boolean;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class MobileP2PEngine {
  private token = "";
  private handlers = new Map<string, Array<(data: unknown) => void>>();

  // State
  private _localPeerId = `luma-${Math.random().toString(36).slice(2, 8)}`;
  private _peers = new Map<string, MeshPeer>();
  private _gateways = new Map<string, GatewayInfo>();
  private _activeRoute: ActiveRoute | null = null;
  private _messages = new Map<string, MeshMessage>();
  private _offlineQueue: OfflineQueueEntry[] = [];
  private _locations = new Map<string, IntelligentReceiverLocation>();
  private _isGatewayMode = false;
  private _meshSynced = false;
  private _discovering = false;
  private _eventLog: { time: number; event: string; detail: string }[] = [];

  // Internals
  private discoveryInterval?: ReturnType<typeof setInterval>;
  private routeCheckInterval?: ReturnType<typeof setInterval>;
  private retryInterval?: ReturnType<typeof setInterval>;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "p2p_engine",
        name: "Bluetooth & P2P Mesh Engine",
        version: "2.0.0",
        capabilities: [
          "peer_discovery",
          "secure_mesh_network",
          "multi_hop_relay",
          "store_and_forward",
          "gateway_node",
          "auto_route_selection",
          "offline_command_queue",
          "community_gateway",
          "intelligent_routing",
          "e2e_encryption",
        ],
        subscribedActions: [
          "PEER_DISCOVERED", "PEER_CONNECTED", "PEER_DISCONNECTED",
          "P2P_MESSAGE_RECEIVED", "SYNC_COMPLETE", "TRANSPORT_CHANGED",
          "WIFI_CONNECTED", "WIFI_DISCONNECTED", "HOTSPOT_AVAILABLE",
          "DEVICE_CONNECTED", "DEVICE_DISCONNECTED",
        ],
      },
      (msg) => this._handleGatewayMessage(msg),
    );
    this._initLocations();
    this._computeRoute();
    this._startRetryLoop();
    // Begin passive peer discovery
    setTimeout(() => this.discoverPeers(), 1200);
  }

  stop(): void {
    clearInterval(this.discoveryInterval);
    clearInterval(this.routeCheckInterval);
    clearInterval(this.retryInterval);
    gateway.unregisterEngine("p2p_engine", this.token);
  }

  // ── Commands (§2.3) ────────────────────────────────────────────────────────

  /** DiscoverPeers: scan for nearby phones running the app over Bluetooth */
  discoverPeers(transport: TransportType = "bluetooth"): void {
    if (this._discovering) return;
    this._discovering = true;
    this._logEvent("DiscoverPeers", `Scanning via ${transport}`);
    gateway.broadcastMessage("p2p_engine", "DISCOVER_PEERS", { transport, localPeerId: this._localPeerId });

    // Simulate finding 1-3 nearby peers
    const count = 1 + Math.floor(Math.random() * 3);
    const peersToFind = MOCK_PEERS.slice(0, count);
    let delay = 600;
    peersToFind.forEach(template => {
      setTimeout(() => {
        const peer: MeshPeer = {
          ...template,
          peerId: `peer-${Math.random().toString(36).slice(2, 8)}`,
          lastSeen: Date.now(),
          lastSync: Date.now() - Math.random() * 300000,
        };
        this._peers.set(peer.peerId, peer);
        this._emit("PeerFound", { peer });
        this._logEvent("PeerFound", `${peer.name} (${peer.transport}, RSSI: ${peer.rssi ?? "n/a"})`);
        gateway.broadcastMessage("p2p_engine", "PEER_FOUND", { peer });
        this._maybeFormMesh();
      }, delay);
      delay += 400 + Math.random() * 600;
    });

    setTimeout(() => {
      this._discovering = false;
      this._checkForGateway();
    }, delay + 200);
  }

  /** ConnectPeer: establish a mesh link with a discovered peer */
  connectPeer(peerId: string): void {
    const peer = this._peers.get(peerId);
    if (!peer) return;
    peer.trusted = true;
    peer.online = true;
    this._emit("PeerConnected", { peer });
    this._logEvent("PeerConnected", `${peer.name} now trusted — mesh link established`);
    gateway.broadcastMessage("p2p_engine", "PEER_CONNECTED", { peer });
    this._computeRoute();
    // Deliver any pending messages
    this._deliverPendingTo(peerId);
  }

  /** DisconnectPeer: close mesh link */
  disconnectPeer(peerId: string): void {
    const peer = this._peers.get(peerId);
    if (!peer) return;
    peer.online = false;
    this._emit("PeerDisconnected", { peer });
    this._logEvent("PeerDisconnected", `${peer.name} disconnected from mesh`);
    gateway.broadcastMessage("p2p_engine", "PEER_DISCONNECTED", { peerId });
    this._computeRoute();
  }

  /** SendMeshMessage: send a new encrypted message into the mesh */
  sendMeshMessage(toPeerId: string, deviceId: string, command: string, params: Record<string, unknown>): string {
    const id = `mesh-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const route = this._activeRoute?.type ?? "bluetooth_mesh";
    const msg: MeshMessage = {
      id,
      fromPeerId: this._localPeerId,
      toPeerId,
      deviceId,
      command,
      payload: params,
      timestamp: Date.now(),
      expiresAt: Date.now() + 300_000, // 5 min TTL
      delivered: false,
      route,
      hopHistory: [this._localPeerId],
      maxHops: 5,
      encrypted: true,
      verified: true,
      retries: 0,
      maxRetries: 3,
      status: "in_flight",
    };
    this._messages.set(id, msg);
    this._logEvent("SendMeshMessage", `cmd:${command} → ${toPeerId} via ${route}`);
    this._forwardMessage(msg);
    return id;
  }

  /** StoreMessage: persist a message locally when no peer is reachable */
  storeMessage(deviceId: string, command: string, params: Record<string, unknown>): string {
    const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const entry: OfflineQueueEntry = {
      id,
      deviceId,
      command,
      params,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3_600_000, // 1h TTL
      attempts: 0,
      maxAttempts: 10,
      status: "queued",
      targetRoute: this._activeRoute?.type,
    };
    this._offlineQueue.push(entry);
    this._logEvent("StoreMessage", `Queued ${command} for ${deviceId} (offline)`);
    this._emit("MessageStored", { entry });
    return id;
  }

  /** SyncMesh: reconcile queued/duplicate messages once connectivity returns */
  syncMesh(): void {
    const pending = this._offlineQueue.filter(e => e.status === "queued");
    if (pending.length === 0) { this._meshSynced = true; return; }

    this._logEvent("SyncMesh", `Syncing ${pending.length} queued messages`);
    let delay = 0;
    pending.forEach(entry => {
      setTimeout(() => {
        entry.status = "delivered";
        entry.attempts++;
        this._emit("MessageDelivered", { entry });
        this._logEvent("MessageDelivered", `${entry.command} → ${entry.deviceId}`);
      }, delay += 300);
    });

    setTimeout(() => {
      this._meshSynced = true;
      this._offlineQueue = this._offlineQueue.filter(e => e.status !== "delivered");
      this._emit("MeshSynchronized", { synced: pending.length });
      this._logEvent("MeshSynchronized", `${pending.length} messages delivered`);
      gateway.broadcastMessage("p2p_engine", "MESH_SYNCHRONIZED", { count: pending.length });
    }, pending.length * 300 + 200);
  }

  /** SelectBestRoute: recalculate and choose the optimal delivery path */
  selectBestRoute(): ActiveRoute {
    return this._computeRoute();
  }

  /** RegisterGateway: mark a phone as an active gateway */
  registerGateway(peerId: string, type: GatewayInfo["type"], targetDevices: string[]): void {
    const peer = this._peers.get(peerId);
    const gw: GatewayInfo = {
      peerId,
      name: peer?.name ?? `Gateway-${peerId.slice(-4)}`,
      type,
      targetDevices,
      maintenanceOnly: true,
      capabilities: ["discover_devices", "report_reachability", "sync_time", "deliver_schedules", "report_health"],
      online: true,
      lastHeartbeat: Date.now(),
      connectedNetwork: "local",
    };
    this._gateways.set(peerId, gw);
    if (peer) { peer.isGateway = true; }
    this._emit("GatewayAvailable", { gateway: gw });
    this._logEvent("RegisterGateway", `${gw.name} registered as ${type} gateway`);
    gateway.broadcastMessage("p2p_engine", "GATEWAY_REGISTERED", { peerId, type });
    this._computeRoute();
  }

  /** DiscoverGateway: search for available community gateway phones */
  discoverGateway(): void {
    this._logEvent("DiscoverGateway", "Searching for community gateway phones");
    const gwPeers = [...this._peers.values()].filter(p => p.isGateway && p.online);
    if (gwPeers.length > 0) {
      const gw = this._gateways.get(gwPeers[0].peerId);
      if (gw) this._emit("GatewayDiscovered", { gateway: gw });
    } else {
      // Simulate finding one after a delay
      setTimeout(() => {
        const peerId = [...this._peers.values()][0]?.peerId;
        if (peerId) this.registerGateway(peerId, "wifi", ["L001", "L003"]);
      }, 2000);
    }
  }

  /** EnableGatewayMode: this phone acts as community gateway */
  enableGatewayMode(): void {
    this._isGatewayMode = true;
    this._logEvent("GatewayModeEnabled", "This device is now a community gateway");
    gateway.broadcastMessage("p2p_engine", "GATEWAY_MODE_ENABLED", {
      peerId: this._localPeerId,
      capabilities: ["discover_devices", "report_reachability", "sync_time", "deliver_schedules", "report_health"],
      maintenanceOnly: true,
    });
    this._emit("GatewayAvailable", {
      gateway: {
        peerId: this._localPeerId,
        name: "This Phone",
        type: "wifi",
        targetDevices: [],
        maintenanceOnly: true,
        capabilities: [],
        online: true,
        lastHeartbeat: Date.now(),
        connectedNetwork: "local",
      },
    });
  }

  disableGatewayMode(): void {
    this._isGatewayMode = false;
    this._emit("GatewayLost", { peerId: this._localPeerId });
    this._logEvent("GatewayModeDisabled", "Gateway mode turned off");
  }

  /** RequestMaintenanceSync: trigger maintenance sync pass */
  requestMaintenanceSync(deviceId: string): MaintenanceSyncResult {
    const result: MaintenanceSyncResult = {
      deviceId,
      startedAt: Date.now(),
      items: [],
      success: false,
    };
    const items = ["time_sync", "schedule_sync", "automation_rules", "firmware_check", "health_report"];
    this._logEvent("MaintenanceSyncStarted", `Syncing ${deviceId}`);
    this._emit("MaintenanceSyncStarted", { deviceId });
    gateway.broadcastMessage("p2p_engine", "MAINTENANCE_SYNC_STARTED", { deviceId });

    let delay = 300;
    items.forEach(item => {
      setTimeout(() => {
        result.items.push(item);
        this._logEvent("SyncItem", `${item} → ${deviceId}`);
      }, delay += 250);
    });

    setTimeout(() => {
      result.completedAt = Date.now();
      result.success = true;
      this._emit("MaintenanceSyncCompleted", { deviceId, items: result.items });
      this._logEvent("MaintenanceSyncCompleted", `${deviceId} — ${items.length} items synced`);
      gateway.broadcastMessage("p2p_engine", "MAINTENANCE_SYNC_COMPLETED", { deviceId, items: result.items });
    }, delay + 200);

    return result;
  }

  /** VerifyAuthorization: confirm ownership/permissions/signatures before executing */
  verifyAuthorization(userId: string, deviceId: string, command: string): boolean {
    // Owner always allowed; check permission matrix
    const isOwner = userId === "1";
    const allowed = isOwner || ["toggle", "brightness", "color_temp"].includes(command);
    this._logEvent("VerifyAuthorization", `user:${userId} cmd:${command} dev:${deviceId} → ${allowed ? "✓" : "✗"}`);
    return allowed;
  }

  /** UpdateConnectivityStatus: refresh connectivity status of a device */
  updateConnectivityStatus(deviceId: string, status: Partial<IntelligentReceiverLocation>): void {
    const existing = this._locations.get(deviceId) ?? this._defaultLocation(deviceId);
    this._locations.set(deviceId, { ...existing, ...status, lastSync: Date.now() });
    this._logEvent("ConnectivityUpdated", `${deviceId} status updated`);
  }

  // ── Intelligent Route Selection (§2.5.2) ──────────────────────────────────

  private _computeRoute(): ActiveRoute {
    const hasPeers = [...this._peers.values()].some(p => p.trusted && p.online);
    const hasGateway = this._gateways.size > 0;
    const hasWifi = true; // simulate always having wifi for now
    const hasBluetooth = hasPeers;

    let route: ActiveRoute;

    if (hasWifi) {
      route = {
        type: "direct_wifi",
        label: "Direct Wi-Fi",
        hops: [
          { id: "phone", label: "Your Phone", type: "phone", status: "online", transport: "wifi" },
          { id: "router", label: "Wi-Fi Router", type: "broker", status: "online", transport: "wifi" },
          { id: "esp32", label: "ESP32 Device", type: "device", status: "online", transport: "wifi" },
        ],
        latency: 18 + Math.random() * 10,
        priority: 1,
        encrypted: true,
        quality: "excellent",
        updatedAt: Date.now(),
      };
    } else if (hasBluetooth) {
      const gatewayPeer = [...this._peers.values()].find(p => p.isGateway);
      if (gatewayPeer) {
        route = {
          type: "bluetooth_mesh",
          label: "Bluetooth Mesh",
          hops: [
            { id: "phone", label: "Your Phone", type: "phone", status: "online", transport: "bluetooth" },
            { id: gatewayPeer.peerId, label: gatewayPeer.name, type: "gateway", status: "relay", transport: "bluetooth" },
            { id: "esp32", label: "ESP32 Device", type: "device", status: "online", transport: "wifi" },
          ],
          latency: 85 + Math.random() * 40,
          priority: 3,
          encrypted: true,
          quality: "good",
          updatedAt: Date.now(),
        };
      } else {
        route = {
          type: "direct_bluetooth",
          label: "Direct Bluetooth",
          hops: [
            { id: "phone", label: "Your Phone", type: "phone", status: "online", transport: "bluetooth" },
            { id: "esp32", label: "ESP32 Device", type: "device", status: "online", transport: "bluetooth" },
          ],
          latency: 45 + Math.random() * 20,
          priority: 2,
          encrypted: true,
          quality: "good",
          updatedAt: Date.now(),
        };
      }
    } else if (hasGateway) {
      route = {
        type: "local_mqtt",
        label: "Local MQTT Broker",
        hops: [
          { id: "phone", label: "Your Phone", type: "phone", status: "online", transport: "wifi" },
          { id: "mqtt", label: "Local MQTT", type: "broker", status: "online", transport: "mqtt" },
          { id: "esp32", label: "ESP32 Device", type: "device", status: "online", transport: "mqtt" },
        ],
        latency: 35 + Math.random() * 15,
        priority: 4,
        encrypted: true,
        quality: "good",
        updatedAt: Date.now(),
      };
    } else {
      route = {
        type: "backend_relay",
        label: "Backend Relay",
        hops: [
          { id: "phone", label: "Your Phone", type: "phone", status: "online", transport: "internet" },
          { id: "backend", label: "LUMA Backend", type: "backend", status: "online", transport: "https" },
          { id: "esp32", label: "ESP32 Device", type: "device", status: "online", transport: "mqtt" },
        ],
        latency: 180 + Math.random() * 80,
        priority: 6,
        encrypted: true,
        quality: "fair",
        updatedAt: Date.now(),
      };
    }

    const prevType = this._activeRoute?.type;
    this._activeRoute = route;

    if (prevType && prevType !== route.type) {
      this._emit("RouteUpdated", { route, prev: prevType });
      this._logEvent("RouteChanged", `${prevType} → ${route.type} (priority ${route.priority})`);
      gateway.broadcastMessage("p2p_engine", "ROUTE_CHANGED", { type: route.type, priority: route.priority });
    }

    return route;
  }

  // ── Store-and-Forward (§2.2.4) ─────────────────────────────────────────────

  private _forwardMessage(msg: MeshMessage): void {
    const peer = this._peers.get(msg.toPeerId);
    const reachable = peer?.trusted && peer?.online;

    if (reachable) {
      setTimeout(() => {
        msg.delivered = true;
        msg.status = "delivered";
        msg.hopHistory.push(msg.toPeerId);
        this._emit("MessageDelivered", { messageId: msg.id, toPeerId: msg.toPeerId });
        this._logEvent("MessageDelivered", `${msg.id} → ${msg.toPeerId}`);
      }, 200 + Math.random() * 400);
    } else {
      msg.status = "queued";
      // Convert to offline queue entry
      this.storeMessage(msg.deviceId ?? msg.toPeerId, msg.command ?? "command", msg.payload as Record<string, unknown>);
    }
  }

  private _deliverPendingTo(peerId: string): void {
    const pending = [...this._messages.values()].filter(m => m.toPeerId === peerId && !m.delivered);
    pending.forEach(msg => {
      msg.status = "in_flight";
      setTimeout(() => {
        msg.delivered = true;
        msg.status = "delivered";
        this._emit("MessageDelivered", { messageId: msg.id });
      }, 300);
    });
  }

  private _startRetryLoop(): void {
    this.retryInterval = setInterval(() => {
      const now = Date.now();
      const toRetry = this._offlineQueue.filter(e =>
        e.status === "queued" &&
        e.attempts < e.maxAttempts &&
        now < e.expiresAt
      );
      if (toRetry.length === 0) return;
      const route = this._activeRoute;
      if (route && route.priority <= 3) {
        // Has a good enough route — deliver
        toRetry.slice(0, 3).forEach(entry => {
          entry.status = "retrying";
          entry.attempts++;
          entry.lastAttempt = now;
          setTimeout(() => {
            entry.status = "delivered";
            this._emit("MessageDelivered", { entry });
          }, 500);
        });
      }
      // Expire old messages
      this._offlineQueue.forEach(e => {
        if (now > e.expiresAt && e.status !== "delivered") e.status = "expired";
      });
      this._offlineQueue = this._offlineQueue.filter(e => e.status !== "expired" && e.status !== "delivered");
    }, 8000);
  }

  // ── Community Gateway Mode (§2.5.4) ───────────────────────────────────────

  private _checkForGateway(): void {
    const peers = [...this._peers.values()];
    const potentialGateway = peers.find(p => p.trusted && p.online && p.btCapability);
    if (potentialGateway && !this._gateways.has(potentialGateway.peerId)) {
      if (Math.random() > 0.4) {
        this.registerGateway(potentialGateway.peerId, "wifi", ["L001", "L002", "L003"]);
        this._emit("GatewayDiscovered", { gateway: this._gateways.get(potentialGateway.peerId) });
      }
    }
  }

  // ── Mesh Formation (§2.2.2) ────────────────────────────────────────────────

  private _maybeFormMesh(): void {
    const online = [...this._peers.values()].filter(p => p.online);
    if (online.length >= 2) {
      this._emit("MeshCreated", { peers: online.map(p => p.peerId), size: online.length });
      this._logEvent("MeshCreated", `Mesh formed with ${online.length} peers`);
    }
  }

  // ── Intelligent Receiver Location (§2.5.1) ────────────────────────────────

  private _initLocations(): void {
    const devices = ["L001", "L002", "L003", "L004", "L005", "L006"];
    devices.forEach(id => {
      this._locations.set(id, this._defaultLocation(id));
    });
  }

  private _defaultLocation(deviceId: string): IntelligentReceiverLocation {
    return {
      deviceId,
      lastKnownNetwork: "HomeNetwork-5G",
      lastPublicIP: "41.xxx.xxx.xxx",
      lastLocalIP: `192.168.1.${10 + Math.floor(Math.random() * 200)}`,
      lastWiFiSSID: "HomeNetwork-5G",
      lastMQTTBroker: "mqtt://192.168.1.1:1883",
      lastOnline: Date.now() - Math.random() * 3600000,
      lastSync: Date.now() - Math.random() * 300000,
    };
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getPeers(): MeshPeer[] { return [...this._peers.values()]; }
  getGateways(): GatewayInfo[] { return [...this._gateways.values()]; }
  getActiveRoute(): ActiveRoute | null { return this._activeRoute; }
  getMessages(): MeshMessage[] { return [...this._messages.values()].slice(-50); }
  getOfflineQueue(): OfflineQueueEntry[] { return [...this._offlineQueue]; }
  getLocations(): IntelligentReceiverLocation[] { return [...this._locations.values()]; }
  isGatewayMode(): boolean { return this._isGatewayMode; }
  isMeshSynced(): boolean { return this._meshSynced; }
  isDiscovering(): boolean { return this._discovering; }
  getLocalPeerId(): string { return this._localPeerId; }
  getEventLog(): { time: number; event: string; detail: string }[] { return [...this._eventLog].reverse().slice(0, 50); }

  // ── Pub/Sub ────────────────────────────────────────────────────────────────

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
    return () => {
      const arr = this.handlers.get(event);
      if (arr) { const i = arr.indexOf(handler); if (i > -1) arr.splice(i, 1); }
    };
  }

  private _emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach(h => h(data));
  }

  private _logEvent(event: string, detail: string): void {
    this._eventLog.push({ time: Date.now(), event, detail });
    if (this._eventLog.length > 200) this._eventLog.shift();
  }

  private _handleGatewayMessage(msg: InternalMessage): void {
    const p = msg.payload as Record<string, unknown>;
    switch (msg.action) {
      case "WIFI_CONNECTED":
      case "HOTSPOT_AVAILABLE":
        setTimeout(() => this._computeRoute(), 500);
        break;
      case "WIFI_DISCONNECTED":
        this._computeRoute();
        break;
      case "DEVICE_CONNECTED":
        this.updateConnectivityStatus(p["deviceId"] as string, {
          lastLocalIP: p["ip"] as string,
          lastOnline: Date.now(),
        });
        break;
    }
  }
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PEERS: Omit<MeshPeer, "peerId" | "lastSeen" | "lastSync">[] = [
  {
    userId: "alice-001",
    name: "Alice's Phone",
    transport: "bluetooth",
    btCapability: true,
    appVersion: "3.2.0",
    encryptionCapability: true,
    rssi: -62,
    address: "00:1A:2B:3C:4D:5E",
    trusted: true,
    isGateway: false,
    hopCount: 1,
    online: true,
  },
  {
    userId: "bob-002",
    name: "Bob's Tablet",
    transport: "bluetooth",
    btCapability: true,
    appVersion: "3.1.5",
    encryptionCapability: true,
    rssi: -75,
    address: "00:1A:2B:3C:4D:6F",
    trusted: false,
    isGateway: true,
    hopCount: 2,
    online: true,
  },
  {
    userId: "claire-003",
    name: "Claire's Phone",
    transport: "wifi_direct",
    btCapability: true,
    appVersion: "3.2.0",
    encryptionCapability: true,
    rssi: -58,
    address: "192.168.49.3",
    trusted: false,
    isGateway: false,
    hopCount: 1,
    online: true,
  },
];

export const mobileP2PEngine = new MobileP2PEngine();
