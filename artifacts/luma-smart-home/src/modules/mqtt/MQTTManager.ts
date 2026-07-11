/**
 * MQTTManager — orchestrates every channel and picks the best one for each
 * command, in the priority order the spec calls for:
 *
 *   Cloud MQTT → Local MQTT → HTTP → Bluetooth mesh → Offline queue
 *
 * "Bluetooth" here is the app's existing `mobileP2PEngine` mesh (it already
 * models direct-Bluetooth / Bluetooth-mesh routing with real peers/gateways
 * in its own simulation) — there is no BLE hardware or BLE library in this
 * project, so this is explicitly a structural placeholder for a future
 * `react-native-ble-plx`-backed implementation, not a claim of real radio
 * access.
 */
import { MQTTConnection, ChannelId } from "./MQTTConnection";
import { buildTopics } from "./MQTTTopics";
import { mqttEvents, MQTT_EVENT } from "./MQTTEvents";
import { canControlDevice, GatedCommand, LumaRole } from "./MQTTPermissions";
import { signCommand } from "./MQTTSecurity";
import * as MQTTQueue from "./MQTTQueue";
import * as MQTTDiscovery from "./MQTTDiscovery";
import { mobileP2PEngine } from "../../../engines/p2p-engine";

export interface CloudConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface LocalConfig {
  host: string;
  port: number;
}

export interface MQTTManagerConfig {
  cloud: CloudConfig;
  local?: LocalConfig;
  httpBaseUrl?: string;
}

export type ActiveChannel = "cloud" | "local" | "http" | "bluetooth" | "offline";

export interface PublishResult {
  ok: boolean;
  channel: ActiveChannel;
  reason?: string;
}

export interface MQTTManagerStatus {
  cloud: { connected: boolean; transport: "native" | "simulated"; latencyMs: number | null; messagesPerMinute: number };
  local: { connected: boolean; transport: "native" | "simulated"; latencyMs: number | null; messagesPerMinute: number } | null;
  bluetooth: { available: boolean; peerCount: number; route: string | null };
  offlineQueueSize: number;
  activeChannel: ActiveChannel;
  discoveredDeviceCount: number;
}

class MQTTManagerImpl {
  private cloud: MQTTConnection | null = null;
  private local: MQTTConnection | null = null;
  private httpBaseUrl?: string;
  private clientIdSuffix = Math.random().toString(36).slice(2, 8);
  private started = false;

  connectAll(config: MQTTManagerConfig): void {
    if (this.started) return;
    this.started = true;
    this.httpBaseUrl = config.httpBaseUrl;

    this.cloud = new MQTTConnection(
      "cloud",
      1,
      { host: config.cloud.host, port: config.cloud.port, clientId: `luma-cloud-${this.clientIdSuffix}`, username: config.cloud.username, password: config.cloud.password },
      (id) => this.handleReconnected(id),
    );
    this.cloud.start();

    if (config.local) {
      this.local = new MQTTConnection(
        "local",
        2,
        { host: config.local.host, port: config.local.port, clientId: `luma-local-${this.clientIdSuffix}` },
        (id) => this.handleReconnected(id),
      );
      this.local.start();
    }

    MQTTDiscovery.startDiscovery();
    this.emitStatus();
  }

  /** Wires up a local broker once one is discovered (e.g. after WiFi provisioning). */
  attachLocalBroker(config: LocalConfig): void {
    if (this.local) this.local.stop();
    this.local = new MQTTConnection(
      "local",
      2,
      { host: config.host, port: config.port, clientId: `luma-local-${this.clientIdSuffix}` },
      (id) => this.handleReconnected(id),
    );
    this.local.start();
  }

  stopAll(): void {
    this.cloud?.stop();
    this.local?.stop();
    MQTTDiscovery.stopDiscovery();
    this.started = false;
  }

  private handleReconnected(channelId: ChannelId): void {
    mqttEvents.emit(MQTT_EVENT.CHANNEL_FAILOVER, { reconnected: channelId, activeChannel: this.getActiveChannel() });
    void this.drainQueue();
    this.emitStatus();
  }

  private async drainQueue(): Promise<void> {
    const { delivered, remaining } = await MQTTQueue.drain(async (op) => {
      if (op.kind !== "command") return false;
      const { role, command, params } = op.payload as { role: LumaRole; command: GatedCommand; params: Record<string, unknown> };
      const result = await this.publishCommand(op.deviceId, role, command, params);
      return result.ok;
    });
    if (delivered > 0) console.log(`[MQTTManager] drained ${delivered} queued command(s), ${remaining} remaining`);
  }

  getActiveChannel(): ActiveChannel {
    if (this.cloud?.isConnected()) return "cloud";
    if (this.local?.isConnected()) return "local";
    if (this.httpBaseUrl) return "http";
    const route = mobileP2PEngine.getActiveRoute();
    const hasTrustedOnlinePeer = mobileP2PEngine.getPeers().some((p) => p.trusted && p.online);
    if (route && (route.type === "direct_bluetooth" || route.type === "bluetooth_mesh") && hasTrustedOnlinePeer) {
      return "bluetooth";
    }
    return "offline";
  }

  async publishCommand(
    deviceId: string,
    role: LumaRole,
    command: GatedCommand,
    params: Record<string, unknown>,
    opts?: { deviceKey?: string },
  ): Promise<PublishResult> {
    const permission = canControlDevice(role, command);
    if (!permission.allowed) {
      mqttEvents.emit(MQTT_EVENT.SECURITY_VIOLATION, { deviceId, command, role, reason: permission.reason });
      return { ok: false, channel: "offline", reason: permission.reason };
    }

    const topic = buildTopics(deviceId).command;
    const basePayload = { device: deviceId, action: command, params };
    // Signed if we hold the device's key (e.g. from the pairing/provisioning
    // flow); unsigned commands still flow — real device-side firmware would
    // reject unsigned admin-tier commands, but the app can't assume every
    // caller has the key wired up yet, so this degrades honestly rather than
    // silently pretending everything is signed.
    const payload = opts?.deviceKey ? { ...basePayload, signed: await signCommand(basePayload, opts.deviceKey) } : basePayload;

    const channel = this.getActiveChannel();
    mqttEvents.emit(MQTT_EVENT.COMMAND_SENT, { deviceId, command, channel });

    switch (channel) {
      case "cloud": {
        const ok = await this.cloud!.publish(topic, payload);
        return ok ? { ok, channel } : this.fallbackFrom(deviceId, role, command, params, opts, "cloud");
      }
      case "local": {
        const ok = await this.local!.publish(topic, payload);
        return ok ? { ok, channel } : this.fallbackFrom(deviceId, role, command, params, opts, "local");
      }
      case "http":
        return this.publishViaHttp(deviceId, command, params);
      case "bluetooth":
        return this.publishViaBluetooth(deviceId, command, params);
      default:
        await MQTTQueue.enqueue("command", deviceId, { role, command, params });
        return { ok: false, channel: "offline", reason: "no_channel_available_queued" };
    }
  }

  private async fallbackFrom(
    deviceId: string,
    role: LumaRole,
    command: GatedCommand,
    params: Record<string, unknown>,
    opts: { deviceKey?: string } | undefined,
    failedChannel: ActiveChannel,
  ): Promise<PublishResult> {
    mqttEvents.emit(MQTT_EVENT.CHANNEL_FAILOVER, { from: failedChannel });
    if (failedChannel === "cloud" && this.local?.isConnected()) {
      const ok = await this.local.publish(buildTopics(deviceId).command, { device: deviceId, action: command, params });
      return { ok, channel: "local" };
    }
    if (this.httpBaseUrl) return this.publishViaHttp(deviceId, command, params);
    const hasBt = mobileP2PEngine.getPeers().some((p) => p.trusted && p.online);
    if (hasBt) return this.publishViaBluetooth(deviceId, command, params);
    await MQTTQueue.enqueue("command", deviceId, { role, command, params });
    return { ok: false, channel: "offline", reason: `${failedChannel}_failed_queued` };
  }

  private async publishViaHttp(deviceId: string, command: GatedCommand, params: Record<string, unknown>): Promise<PublishResult> {
    if (!this.httpBaseUrl) return { ok: false, channel: "offline", reason: "no_http_base_url" };
    try {
      const res = await fetch(`${this.httpBaseUrl}/api/engines/devices/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, command, params }),
      });
      return { ok: res.ok, channel: "http", reason: res.ok ? undefined : `http_${res.status}` };
    } catch (err) {
      return { ok: false, channel: "http", reason: err instanceof Error ? err.message : "http_error" };
    }
  }

  private publishViaBluetooth(deviceId: string, command: GatedCommand, params: Record<string, unknown>): PublishResult {
    const peer = mobileP2PEngine.getPeers().find((p) => p.trusted && p.online);
    if (!peer) return { ok: false, channel: "bluetooth", reason: "no_trusted_peer" };
    mobileP2PEngine.sendMeshMessage(peer.peerId, deviceId, command, params);
    return { ok: true, channel: "bluetooth" };
  }

  async subscribeDeviceTopics(deviceId: string, handler: (kind: string, payload: Record<string, unknown>) => void): Promise<() => void> {
    const topics = buildTopics(deviceId);
    const unsubs: Array<() => void> = [];
    for (const [kind, topic] of Object.entries(topics)) {
      if (this.cloud) unsubs.push(await this.cloud.subscribe(topic, (_t, p) => handler(kind, p)));
      if (this.local) unsubs.push(await this.local.subscribe(topic, (_t, p) => handler(kind, p)));
    }
    return () => unsubs.forEach((u) => u());
  }

  getStatus(): MQTTManagerStatus {
    const route = mobileP2PEngine.getActiveRoute();
    return {
      cloud: {
        connected: this.cloud?.isConnected() ?? false,
        transport: this.cloud?.getTransport() ?? "simulated",
        latencyMs: this.cloud?.getMetrics().latencyMs ?? null,
        messagesPerMinute: this.cloud?.getMetrics().messagesPerMinute ?? 0,
      },
      local: this.local
        ? {
            connected: this.local.isConnected(),
            transport: this.local.getTransport(),
            latencyMs: this.local.getMetrics().latencyMs,
            messagesPerMinute: this.local.getMetrics().messagesPerMinute,
          }
        : null,
      bluetooth: {
        available: mobileP2PEngine.getPeers().some((p) => p.trusted && p.online),
        peerCount: mobileP2PEngine.getPeers().filter((p) => p.online).length,
        route: route?.type ?? null,
      },
      offlineQueueSize: 0, // filled in asynchronously by callers via MQTTQueue.size() — kept sync here to avoid a Promise-returning getter
      activeChannel: this.getActiveChannel(),
      discoveredDeviceCount: 0, // same — see getStatusAsync for the full async snapshot
    };
  }

  async getStatusAsync(): Promise<MQTTManagerStatus> {
    const [queueSize, discovered] = await Promise.all([MQTTQueue.size(), MQTTDiscovery.getDiscovered()]);
    return { ...this.getStatus(), offlineQueueSize: queueSize, discoveredDeviceCount: discovered.length };
  }

  private emitStatus(): void {
    mqttEvents.emit(MQTT_EVENT.STATUS_CHANGED, this.getStatus());
  }
}

export const mqttManager = new MQTTManagerImpl();
