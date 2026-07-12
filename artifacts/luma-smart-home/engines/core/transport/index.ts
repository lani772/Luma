// Transport Abstraction — barrel export
// Import from here to get the interface, all adapters, and the manager.

export type { ITransport, TransportPriority, TransportConnectionState, TransportStatus } from "./ITransport";
export { MQTTTransport } from "./MQTTTransport";
export { BluetoothTransport } from "./BluetoothTransport";
export type { BluetoothMode } from "./BluetoothTransport";
export { LANTransport } from "./LANTransport";
export { TransportManager } from "./TransportManager";
export type { SendResult, TransportManagerStatus } from "./TransportManager";
