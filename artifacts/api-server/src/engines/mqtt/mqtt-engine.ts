import { BaseEngine } from "../base-engine";
import type { EngineId, InternalMessage } from "../../internal-api/types";
import { logger } from "../../lib/logger";

export interface MQTTSubscription {
  topic: string;
  qos: 0 | 1 | 2;
  subscribedBy: EngineId;
}

export interface MQTTMessage {
  topic: string;
  payload: unknown;
  timestamp: string;
  retained: boolean;
}

export interface BrokerConfig {
  host: string;
  port: number;
  clientId: string;
  username?: string;
  password?: string;
  clean: boolean;
  keepalive: number;
}

export class MQTTEngine extends BaseEngine {
  readonly id: EngineId = "mqtt_engine";
  readonly name = "MQTT Engine";
  readonly version = "1.0.0";
  readonly capabilities = [
    "mqtt_broker_communication",
    "topic_management",
    "publish_subscribe",
    "device_messaging",
    "mqtt_authentication",
    "offline_message_queue",
  ];
  readonly subscribedActions = [
    "CONNECT_BROKER",
    "DISCONNECT_BROKER",
    "PUBLISH_DEVICE_STATE",
    "SUBSCRIBE_TOPIC",
    "UNSUBSCRIBE_TOPIC",
    "GET_BROKER_STATUS",
    "PUBLISH",
    "GET_SUBSCRIPTIONS",
    "AUTHENTICATE",
  ];

  private brokerConfig: BrokerConfig | null = null;
  private connected: boolean = false;
  private subscriptions: Map<string, MQTTSubscription> = new Map();
  private messageLog: MQTTMessage[] = [];
  private offlinePublishQueue: MQTTMessage[] = [];
  private reconnectAttempts: number = 0;

  protected onStart(): void {
    this.brokerConfig = {
      host: process.env["MQTT_HOST"] ?? "mqtt.luma.local",
      port: Number(process.env["MQTT_PORT"] ?? "1883"),
      clientId: `luma-server-${Date.now()}`,
      username: process.env["MQTT_USER"],
      password: process.env["MQTT_PASS"],
      clean: true,
      keepalive: 60,
    };
    logger.info({ host: this.brokerConfig.host }, "[MQTTEngine] configured");
  }

  protected onStop(): void {
    this.connected = false;
    this.subscriptions.clear();
  }

  protected handleMessage(message: InternalMessage): void {
    logger.debug({ action: message.action }, "[MQTTEngine] received");

    switch (message.action) {
      case "CONNECT_BROKER":
        this.handleConnect(message);
        break;
      case "DISCONNECT_BROKER":
        this.handleDisconnect();
        break;
      case "PUBLISH_DEVICE_STATE":
      case "PUBLISH":
        this.handlePublish(message);
        break;
      case "SUBSCRIBE_TOPIC":
        this.handleSubscribe(message);
        break;
      case "UNSUBSCRIBE_TOPIC":
        this.handleUnsubscribe(message);
        break;
      case "GET_BROKER_STATUS":
        this.handleGetStatus(message);
        break;
      case "GET_SUBSCRIPTIONS":
        this.handleGetSubscriptions(message);
        break;
      case "AUTHENTICATE":
        this.handleAuthenticate(message);
        break;
      default:
        logger.warn({ action: message.action }, "[MQTTEngine] unknown action");
    }
  }

  private handleConnect(message: InternalMessage): void {
    const config = message.payload as Partial<BrokerConfig>;
    if (config.host) this.brokerConfig = { ...this.brokerConfig!, ...config };

    this.connected = true;
    this.reconnectAttempts = 0;
    logger.info({ host: this.brokerConfig?.host }, "[MQTTEngine] broker connected");

    this.broadcast("MQTT_CONNECTED", {
      broker: `${this.brokerConfig?.host}:${this.brokerConfig?.port}`,
      clientId: this.brokerConfig?.clientId,
    }, "high");

    this.drainOfflineQueue();
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.broadcast("MQTT_DISCONNECTED", { broker: this.brokerConfig?.host }, "high");
    logger.info("[MQTTEngine] disconnected");
  }

  private handlePublish(message: InternalMessage): void {
    const { topic, payload, retained } = message.payload as {
      topic: string;
      payload: unknown;
      retained?: boolean;
    };

    const mqttMsg: MQTTMessage = {
      topic,
      payload,
      timestamp: new Date().toISOString(),
      retained: retained ?? false,
    };

    if (!this.connected) {
      this.offlinePublishQueue.push(mqttMsg);
      logger.warn({ topic }, "[MQTTEngine] queued (broker offline)");
      return;
    }

    this.messageLog.push(mqttMsg);
    if (this.messageLog.length > 200) this.messageLog.shift();

    logger.info({ topic }, "[MQTTEngine] published");
    this.broadcast("MQTT_MESSAGE_PUBLISHED", { topic, payload }, "normal");
  }

  private handleSubscribe(message: InternalMessage): void {
    const { topic, qos } = message.payload as { topic: string; qos?: 0 | 1 | 2 };
    this.subscriptions.set(topic, {
      topic,
      qos: qos ?? 0,
      subscribedBy: message.source as EngineId,
    });
    logger.info({ topic }, "[MQTTEngine] subscribed");
  }

  private handleUnsubscribe(message: InternalMessage): void {
    const { topic } = message.payload as { topic: string };
    this.subscriptions.delete(topic);
    logger.info({ topic }, "[MQTTEngine] unsubscribed");
  }

  private handleGetStatus(message: InternalMessage): void {
    this.emit(message.source as EngineId, "MQTT_STATUS", {
      connected: this.connected,
      broker: this.brokerConfig?.host,
      port: this.brokerConfig?.port,
      clientId: this.brokerConfig?.clientId,
      subscriptions: this.subscriptions.size,
      offlineQueueSize: this.offlinePublishQueue.length,
      reconnectAttempts: this.reconnectAttempts,
    }, "normal");
  }

  private handleGetSubscriptions(message: InternalMessage): void {
    this.emit(message.source as EngineId, "SUBSCRIPTIONS_LIST", {
      subscriptions: [...this.subscriptions.values()],
    }, "normal");
  }

  private handleAuthenticate(message: InternalMessage): void {
    const { username, password } = message.payload as { username: string; password: string };
    const valid = username.length > 0 && password.length >= 6;
    this.emit(message.source as EngineId, "AUTH_RESULT", { valid }, "high");
  }

  private drainOfflineQueue(): void {
    if (this.offlinePublishQueue.length === 0) return;
    logger.info({ count: this.offlinePublishQueue.length }, "[MQTTEngine] draining offline queue");

    const toSend = [...this.offlinePublishQueue];
    this.offlinePublishQueue = [];

    for (const msg of toSend) {
      this.messageLog.push(msg);
      this.broadcast("MQTT_MESSAGE_PUBLISHED", { topic: msg.topic, payload: msg.payload }, "normal");
    }
  }

  isConnected(): boolean { return this.connected; }
  getSubscriptions(): MQTTSubscription[] { return [...this.subscriptions.values()]; }
  getMessageLog(): MQTTMessage[] { return [...this.messageLog]; }
}

export const mqttEngine = new MQTTEngine();
