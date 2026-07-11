/**
 * MQTTEvents — centralized event bus for the entire communication engine.
 *
 * Every module in `modules/mqtt` reports what it does by emitting one of
 * these events instead of calling into other modules directly. UI (dashboard,
 * device cards) subscribes here rather than reaching into MQTTManager
 * internals, so screens never need to know which transport is active.
 */

export const MQTT_EVENT = {
  DEVICE_CONNECTED: "DEVICE_CONNECTED",
  DEVICE_DISCONNECTED: "DEVICE_DISCONNECTED",
  BROKER_CONNECTED: "BROKER_CONNECTED",
  BROKER_DISCONNECTED: "BROKER_DISCONNECTED",
  COMMAND_SENT: "COMMAND_SENT",
  COMMAND_RECEIVED: "COMMAND_RECEIVED",
  COMMAND_QUEUED: "COMMAND_QUEUED",
  DEVICE_REGISTERED: "DEVICE_REGISTERED",
  DEVICE_UPDATED: "DEVICE_UPDATED",
  DEVICE_DISCOVERED: "DEVICE_DISCOVERED",
  SYNC_STARTED: "SYNC_STARTED",
  SYNC_COMPLETED: "SYNC_COMPLETED",
  BLUETOOTH_CONNECTED: "BLUETOOTH_CONNECTED",
  BLUETOOTH_DISCONNECTED: "BLUETOOTH_DISCONNECTED",
  FIRMWARE_AVAILABLE: "FIRMWARE_AVAILABLE",
  FIRMWARE_UPDATED: "FIRMWARE_UPDATED",
  CHANNEL_FAILOVER: "CHANNEL_FAILOVER",
  STATUS_CHANGED: "STATUS_CHANGED",
  SECURITY_VIOLATION: "SECURITY_VIOLATION",
  NATIVE_TRANSPORT_UNAVAILABLE: "NATIVE_TRANSPORT_UNAVAILABLE",
} as const;

export type MQTTEventName = (typeof MQTT_EVENT)[keyof typeof MQTT_EVENT];

type Listener = (payload: any) => void;

/** Small, dependency-free typed pub/sub bus (no Node `events` module in RN). */
class MQTTEventBus {
  private listeners = new Map<string, Set<Listener>>();
  private recent: Array<{ event: string; payload: unknown; at: number }> = [];

  on(event: MQTTEventName | string, listener: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off(event: MQTTEventName | string, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: MQTTEventName | string, payload?: unknown): void {
    this.recent.push({ event, payload, at: Date.now() });
    if (this.recent.length > 300) this.recent.shift();
    this.listeners.get(event)?.forEach((l) => {
      try {
        l(payload);
      } catch (err) {
        console.error(`[MQTTEvents] listener for ${event} threw`, err);
      }
    });
  }

  getRecent(limit = 50): Array<{ event: string; payload: unknown; at: number }> {
    return this.recent.slice(-limit).reverse();
  }
}

export const mqttEvents = new MQTTEventBus();
