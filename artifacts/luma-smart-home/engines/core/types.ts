// Core Engine — shared type definitions
// All engines in the embedded core communicate through these interfaces only.

export type CoreEngineId =
  | "core_engine"
  | "event_engine"
  | "database_engine"
  | "security_engine"
  | "permission_engine"
  | "notification_engine"
  | "automation_engine"
  | "dashboard_engine"
  | "device_management_engine"
  | "discovery_engine"
  | "extension_engine"
  | "firmware_engine"
  | "mqtt_communication_engine"
  | "sync_engine";

export type EngineStatus = "idle" | "booting" | "running" | "paused" | "stopping" | "stopped" | "error";

export type MessageType = "COMMAND" | "EVENT" | "QUERY" | "RESPONSE" | "BROADCAST";
export type MessagePriority = "critical" | "high" | "normal" | "low";

export interface CoreMessage {
  id: string;
  source: CoreEngineId | "system";
  destination: CoreEngineId | "broadcast";
  type: MessageType;
  action: string;
  payload: Record<string, unknown>;
  timestamp: string;
  priority: MessagePriority;
  correlationId?: string;
  ttl?: number;
}

export type CoreMessageHandler = (message: CoreMessage) => void | Promise<void>;

export interface EngineCapability {
  id: string;
  description: string;
}

export interface EngineManifestEntry {
  id: CoreEngineId;
  name: string;
  version: string;
  capabilities: string[];
  dependencies: CoreEngineId[];
  optional: boolean;
}

export interface EngineHealthInfo {
  id: CoreEngineId;
  name: string;
  version: string;
  status: EngineStatus;
  startedAt: string | null;
  uptimeMs: number;
  lastHeartbeatAt: string | null;
  messagesSent: number;
  messagesReceived: number;
  errorCount: number;
  lastError: string | null;
}

export interface CoreBootError extends Error {
  stuckEngines: CoreEngineId[];
}

export interface IEngine {
  readonly id: CoreEngineId;
  readonly name: string;
  readonly version: string;
  readonly capabilities: string[];
  readonly dependencies: CoreEngineId[];
  readonly optional: boolean;
  readonly status: EngineStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause?(): Promise<void>;
  resume?(): Promise<void>;
  getHealth(): EngineHealthInfo;
  handleMessage(message: CoreMessage): void | Promise<void>;
}

// Core event names
export const CORE_EVENTS = {
  BOOT_STARTED:      "CORE_BOOT_STARTED",
  READY:             "CORE_READY",
  EXTENSION_FAILED:  "CORE_EXTENSION_FAILED",
  BACKGROUNDED:      "CORE_BACKGROUNDED",
  FOREGROUNDED:      "CORE_FOREGROUNDED",
  SHUTDOWN:          "CORE_SHUTDOWN",
  ENGINE_REGISTERED: "CORE_ENGINE_REGISTERED",
  ENGINE_STATUS:     "CORE_ENGINE_STATUS_CHANGED",
} as const;
