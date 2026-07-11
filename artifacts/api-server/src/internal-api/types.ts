export type EngineId =
  | "firmware_engine"
  | "device_engine"
  | "wifi_engine"
  | "mqtt_engine"
  | "usb_engine"
  | "firmware_upload_engine"
  | "rn_mqtt_client_engine"
  | "p2p_engine";

export type MessageType = "COMMAND" | "EVENT" | "QUERY" | "RESPONSE" | "BROADCAST";
export type MessagePriority = "critical" | "high" | "normal" | "low";
export type EngineStatus = "initializing" | "running" | "stopped" | "error";

export interface InternalMessage {
  id: string;
  source: EngineId | "gateway";
  destination: EngineId | "broadcast";
  type: MessageType;
  action: string;
  payload: Record<string, unknown>;
  timestamp: string;
  priority: MessagePriority;
  correlationId?: string;
  ttl?: number;
}

export interface EngineRegistration {
  id: EngineId;
  name: string;
  version: string;
  capabilities: string[];
  subscribedActions: string[];
}

export interface EngineInfo extends EngineRegistration {
  status: EngineStatus;
  registeredAt: string;
  lastHeartbeat: string;
  messagesSent: number;
  messagesReceived: number;
}

export interface QueuedMessage {
  message: InternalMessage;
  attempts: number;
  nextRetryAt: number;
  maxAttempts: number;
}

export type MessageHandler = (message: InternalMessage) => void | Promise<void>;

export const ENGINE_NAMES: Record<EngineId, string> = {
  firmware_engine: "Firmware Engine",
  device_engine: "Device Engine",
  wifi_engine: "WiFi & Hotspot Engine",
  mqtt_engine: "MQTT Engine",
  usb_engine: "USB Communication Engine",
  firmware_upload_engine: "Firmware Upload Engine",
  rn_mqtt_client_engine: "React Native MQTT Client Engine",
  p2p_engine: "Peer-to-Peer Communication Engine",
};
