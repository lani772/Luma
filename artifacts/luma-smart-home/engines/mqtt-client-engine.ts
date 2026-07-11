import { gateway } from "./internal-api/gateway";
import type { InternalMessage } from "./internal-api/types";

export interface MQTTClientConfig {
  brokerUrl: string;
  port: number;
  clientId: string;
  username?: string;
  password?: string;
  cleanSession: boolean;
  keepAlive: number;
}

export interface MQTTIncomingMessage {
  topic: string;
  payload: unknown;
  timestamp: string;
}

type MQTTMessageHandler = (message: MQTTIncomingMessage) => void;
type MQTTEventHandler = (data: Record<string, unknown>) => void;

export class MobileRNMQTTClientEngine {
  private token: string = "";
  private connected: boolean = false;
  private subscriptions: Map<string, MQTTMessageHandler[]> = new Map();
  private offlineCommandQueue: Array<{ topic: string; payload: unknown }> = [];
  private onConnectHandler?: MQTTEventHandler;
  private onDisconnectHandler?: MQTTEventHandler;
  private config: MQTTClientConfig | null = null;

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "rn_mqtt_client_engine",
        name: "React Native MQTT Client Engine",
        version: "1.0.0",
        capabilities: [
          "mobile_mqtt_connection",
          "mobile_local_broker",
          "device_control_from_app",
          "real_time_status_updates",
          "offline_command_storage",
        ],
        subscribedActions: [
          "MQTT_CONNECTED",
          "MQTT_DISCONNECTED",
          "MQTT_MESSAGE_PUBLISHED",
          "MQTT_STATUS",
          "DEVICE_STATE_CHANGED",
        ],
      },
      (msg) => this.handleMessage(msg),
    );
  }

  stop(): void {
    gateway.unregisterEngine("rn_mqtt_client_engine", this.token);
  }

  connect(config: MQTTClientConfig): void {
    this.config = config;
    gateway.sendCommand(
      "rn_mqtt_client_engine",
      "mqtt_engine",
      "CONNECT_BROKER",
      {
        host: config.brokerUrl,
        port: config.port,
        clientId: config.clientId,
        username: config.username,
        password: config.password,
        clean: config.cleanSession,
        keepalive: config.keepAlive,
      },
      "high",
    );
  }

  disconnect(): void {
    gateway.sendCommand("rn_mqtt_client_engine", "mqtt_engine", "DISCONNECT_BROKER", {});
  }

  publish(topic: string, payload: unknown): void {
    if (!this.connected) {
      this.offlineCommandQueue.push({ topic, payload });
      console.log(`[RN MQTT] queued offline: ${topic}`);
      return;
    }
    gateway.sendCommand("rn_mqtt_client_engine", "mqtt_engine", "PUBLISH", { topic, payload });
  }

  subscribe(topic: string, handler: MQTTMessageHandler): () => void {
    if (!this.subscriptions.has(topic)) this.subscriptions.set(topic, []);
    this.subscriptions.get(topic)!.push(handler);

    gateway.sendCommand("rn_mqtt_client_engine", "mqtt_engine", "SUBSCRIBE_TOPIC", {
      topic,
      qos: 1,
    });

    return () => {
      const handlers = this.subscriptions.get(topic);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx > -1) handlers.splice(idx, 1);
      }
    };
  }

  controlDevice(deviceId: string, command: string, params?: Record<string, unknown>): void {
    const topic = `luma/device/${deviceId}/command`;
    this.publish(topic, { device: deviceId, action: command, params });
  }

  onConnect(handler: MQTTEventHandler): void { this.onConnectHandler = handler; }
  onDisconnect(handler: MQTTEventHandler): void { this.onDisconnectHandler = handler; }
  isConnected(): boolean { return this.connected; }
  getOfflineQueueSize(): number { return this.offlineCommandQueue.length; }

  private drainOfflineQueue(): void {
    if (this.offlineCommandQueue.length === 0) return;
    const queue = [...this.offlineCommandQueue];
    this.offlineCommandQueue = [];
    for (const item of queue) {
      this.publish(item.topic, item.payload);
    }
  }

  private handleMessage(message: InternalMessage): void {
    const p = message.payload as Record<string, unknown>;
    switch (message.action) {
      case "MQTT_CONNECTED":
        this.connected = true;
        this.onConnectHandler?.(p);
        this.drainOfflineQueue();
        break;
      case "MQTT_DISCONNECTED":
        this.connected = false;
        this.onDisconnectHandler?.(p);
        break;
      case "MQTT_MESSAGE_PUBLISHED": {
        const topic = p["topic"] as string;
        const handlers = this.subscriptions.get(topic);
        if (handlers) {
          const msg: MQTTIncomingMessage = {
            topic,
            payload: p["payload"],
            timestamp: new Date().toISOString(),
          };
          handlers.forEach((h) => h(msg));
        }
        break;
      }
    }
  }
}

export const mobileRNMQTTClientEngine = new MobileRNMQTTClientEngine();
