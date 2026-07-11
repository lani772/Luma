import { gateway } from "./internal-api/gateway";
import type { InternalMessage } from "./internal-api/types";

export type P2PTransport = "bluetooth" | "wifi_direct" | "lan";

export interface P2PPeer {
  peerId: string;
  name: string;
  transport: P2PTransport;
  rssi?: number;
  address: string;
  lastSeen: string;
  trusted: boolean;
}

export interface P2PMessage {
  id: string;
  fromPeerId: string;
  toPeerId: string;
  payload: unknown;
  timestamp: string;
  delivered: boolean;
  transport: P2PTransport;
}

type P2PEventHandler = (data: Record<string, unknown>) => void;

export class MobileP2PEngine {
  private token: string = "";
  private peers: Map<string, P2PPeer> = new Map();
  private messageStore: Map<string, P2PMessage> = new Map();
  private pendingSync: P2PMessage[] = [];
  private eventHandlers: Map<string, P2PEventHandler[]> = new Map();
  private activeTransport: P2PTransport | null = null;
  private localPeerId: string = `mobile-${Math.random().toString(36).slice(2, 10)}`;

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "p2p_engine",
        name: "Peer-to-Peer Communication Engine",
        version: "1.0.0",
        capabilities: [
          "device_to_device_communication",
          "mobile_to_mobile_communication",
          "bluetooth_communication",
          "wifi_direct_communication",
          "store_and_forward",
          "background_synchronization",
        ],
        subscribedActions: [
          "PEER_DISCOVERED",
          "PEER_CONNECTED",
          "PEER_DISCONNECTED",
          "P2P_MESSAGE_RECEIVED",
          "SYNC_COMPLETE",
          "TRANSPORT_CHANGED",
        ],
      },
      (msg) => this.handleMessage(msg),
    );
  }

  stop(): void {
    gateway.unregisterEngine("p2p_engine", this.token);
  }

  discoverPeers(transport?: P2PTransport): void {
    gateway.broadcastMessage(
      "p2p_engine",
      "DISCOVER_PEERS",
      { transport: transport ?? "bluetooth", localPeerId: this.localPeerId },
      "normal",
    );
    this.simulatePeerDiscovery(transport ?? "bluetooth");
  }

  connectPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.warn(`[P2PEngine] peer ${peerId} not found`);
      return;
    }
    peer.trusted = true;
    this.activeTransport = peer.transport;
    this.emitEvent("PeerConnected", { peer });
    this.syncMessages(peerId);
  }

  sendOfflineMessage(toPeerId: string, payload: unknown): string {
    const id = `p2p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const msg: P2PMessage = {
      id,
      fromPeerId: this.localPeerId,
      toPeerId,
      payload,
      timestamp: new Date().toISOString(),
      delivered: false,
      transport: this.activeTransport ?? "bluetooth",
    };
    this.messageStore.set(id, msg);
    this.pendingSync.push(msg);

    const peer = this.peers.get(toPeerId);
    if (peer?.trusted) {
      msg.delivered = true;
      this.emitEvent("MessageDelivered", { messageId: id, toPeerId });
    } else {
      console.log(`[P2PEngine] message ${id} stored for sync`);
    }
    return id;
  }

  syncMessages(peerId?: string): void {
    const toSync = peerId
      ? this.pendingSync.filter((m) => m.toPeerId === peerId)
      : [...this.pendingSync];

    if (toSync.length === 0) return;

    for (const msg of toSync) {
      msg.delivered = true;
      const idx = this.pendingSync.indexOf(msg);
      if (idx > -1) this.pendingSync.splice(idx, 1);
    }

    this.emitEvent("SyncComplete", { synced: toSync.length, peerId });
    console.log(`[P2PEngine] synced ${toSync.length} messages`);
  }

  selectTransport(): P2PTransport {
    if (this.peers.size > 0) {
      const trusted = [...this.peers.values()].find((p) => p.trusted);
      if (trusted) return trusted.transport;
    }
    return "bluetooth";
  }

  getPeers(): P2PPeer[] { return [...this.peers.values()]; }
  getPendingSync(): P2PMessage[] { return [...this.pendingSync]; }
  getLocalPeerId(): string { return this.localPeerId; }

  on(event: string, handler: P2PEventHandler): () => void {
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

  private emitEvent(event: string, data: Record<string, unknown>): void {
    this.eventHandlers.get(event)?.forEach((h) => h(data));
  }

  private simulatePeerDiscovery(transport: P2PTransport): void {
    setTimeout(() => {
      const peer: P2PPeer = {
        peerId: `peer-${Math.random().toString(36).slice(2, 8)}`,
        name: "LUMA Mobile B",
        transport,
        rssi: transport === "bluetooth" ? -65 : undefined,
        address: transport === "bluetooth" ? "00:11:22:33:44:55" : "192.168.49.1",
        lastSeen: new Date().toISOString(),
        trusted: false,
      };
      this.peers.set(peer.peerId, peer);
      this.emitEvent("PeerDiscovered", { peer });
      console.log(`[P2PEngine] discovered peer: ${peer.peerId} via ${transport}`);
    }, 800);
  }

  private handleMessage(message: InternalMessage): void {
    const p = message.payload as Record<string, unknown>;
    switch (message.action) {
      case "PEER_DISCOVERED":
        this.emitEvent("PeerDiscovered", p);
        break;
      case "PEER_CONNECTED":
        this.emitEvent("PeerConnected", p);
        break;
      case "PEER_DISCONNECTED":
        this.emitEvent("PeerDisconnected", p);
        break;
      case "P2P_MESSAGE_RECEIVED":
        this.emitEvent("MessageReceived", p);
        break;
    }
  }
}

export const mobileP2PEngine = new MobileP2PEngine();
