// Core Engine — barrel export
// The CoreEngine singleton is the only entry point the rest of the app should import.

export { CoreEngine } from "./CoreEngine";
export type { CoreState } from "./CoreEngine";

// Engine classes (for typing only — don't instantiate separately)
export type { EventEngine } from "./EventEngine";
export type { DatabaseEngine } from "./DatabaseEngine";
export type { SecurityEngine } from "./SecurityEngine";
export type { PermissionEngine } from "./PermissionEngine";
export type { NotificationEngine } from "./NotificationEngine";
export type { AutomationEngine } from "./AutomationEngine";
export type { DeviceManagementEngine } from "./DeviceManagementEngine";
export type { DiscoveryEngine } from "./DiscoveryEngine";
export type { DashboardEngine } from "./DashboardEngine";
export type { FirmwareEngine } from "./FirmwareEngine";
export type { MQTTCommunicationEngine } from "./MQTTCommunicationEngine";
export type { ExtensionEngine } from "./ExtensionEngine";
export type { SynchronizationEngine } from "./SynchronizationEngine";

// Shared types
export type {
  CoreEngineId,
  EngineStatus,
  CoreMessage,
  CoreMessageHandler,
  EngineHealthInfo,
  IEngine,
  EngineManifestEntry,
  MessagePriority,
} from "./types";
export { CORE_EVENTS } from "./types";

// Domain types from each engine
export type { DeviceState, DeviceCommand } from "./DeviceManagementEngine";
export type { DiscoveredDevice } from "./DiscoveryEngine";
export type { CoreNotification } from "./NotificationEngine";
export type { AutomationRule, AutomationTrigger, AutomationAction } from "./AutomationEngine";
export type { FirmwareJob, FirmwareVersion, FirmwareJobStatus } from "./FirmwareEngine";
export type { DashboardSnapshot, EnergyInsight, ConnectionHealth, ActivityEntry } from "./DashboardEngine";
export type { MQTTStatus, MQTTChannel } from "./MQTTCommunicationEngine";
export type { AppRole, DeviceCommand as PermDeviceCommand, AppAction, PermissionCheckResult } from "./PermissionEngine";
export type { SignedCommand, DeviceToken } from "./SecurityEngine";
export type { ExtensionRecord } from "./ExtensionEngine";
export type {
  QueuedOperation,
  QueuedOperationKind,
  RemoteDeviceSnapshot,
  ApplyLocalFn,
} from "./SynchronizationEngine";

// Transport abstraction layer
export type {
  ITransport,
  TransportPriority,
  TransportConnectionState,
  TransportStatus,
} from "./transport/ITransport";
export { MQTTTransport } from "./transport/MQTTTransport";
export { BluetoothTransport } from "./transport/BluetoothTransport";
export type { BluetoothMode } from "./transport/BluetoothTransport";
export { LANTransport } from "./transport/LANTransport";
export { TransportManager } from "./transport/TransportManager";
export type { SendResult, TransportManagerStatus } from "./transport/TransportManager";
