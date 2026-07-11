/**
 * Public surface of the MQTT communication engine.
 *
 * `initMQTT()` should be called once near app root (see
 * `hooks/useMQTTBootstrap.ts`); everything else can be imported from here.
 */
import { useEffect, useState } from "react";
import { mqttManager, MQTTManagerConfig, MQTTManagerStatus } from "./MQTTManager";
import { mqttEvents, MQTT_EVENT, MQTTEventName } from "./MQTTEvents";

export * from "./MQTTTopics";
export * from "./MQTTEvents";
export * from "./MQTTSecurity";
export * from "./MQTTPermissions";
export * from "./MQTTStorage";
export { ReconnectSupervisor, computeBackoffMs } from "./MQTTRecovery";
export * as MQTTQueue from "./MQTTQueue";
export * as MQTTDiscovery from "./MQTTDiscovery";
export * as MQTTSync from "./MQTTSync";
export { MQTTConnection } from "./MQTTConnection";
export { createMQTTService, isNativeMqttAvailable } from "./MQTTService";
export { mqttManager } from "./MQTTManager";
export type { MQTTManagerConfig, MQTTManagerStatus, ActiveChannel, PublishResult } from "./MQTTManager";

let initialized = false;

/**
 * Bootstraps the communication engine. Cloud host defaults to the same
 * simulated broker the server-side engines already model
 * (`mqtt.luma.local`) unless overridden — see `replit.md` for how to point
 * this at a real broker once one exists.
 */
export function initMQTT(config?: Partial<MQTTManagerConfig>): void {
  if (initialized) return;
  initialized = true;
  mqttManager.connectAll({
    cloud: { host: config?.cloud?.host ?? "mqtt.luma.local", port: config?.cloud?.port ?? 8883 },
    local: config?.local,
    httpBaseUrl: config?.httpBaseUrl,
  });
}

export function useMQTTStatus(pollMs = 2000): MQTTManagerStatus {
  const [status, setStatus] = useState<MQTTManagerStatus>(mqttManager.getStatus());

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      mqttManager.getStatusAsync().then((s) => {
        if (!cancelled) setStatus(s);
      });
    };
    refresh();
    const interval = setInterval(refresh, pollMs);
    const unsub = mqttEvents.on(MQTT_EVENT.STATUS_CHANGED, refresh);
    const unsubFailover = mqttEvents.on(MQTT_EVENT.CHANNEL_FAILOVER, refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsub();
      unsubFailover();
    };
  }, [pollMs]);

  return status;
}

export interface MQTTLogEntry {
  event: string;
  payload: unknown;
  at: number;
}

export function useMQTTEventLog(events?: MQTTEventName[], limit = 30): MQTTLogEntry[] {
  const [log, setLog] = useState<MQTTLogEntry[]>(mqttEvents.getRecent(limit));

  useEffect(() => {
    const watch = events ?? Object.values(MQTT_EVENT);
    const unsubs = watch.map((event) =>
      mqttEvents.on(event, (payload) => {
        setLog((prev) => [{ event, payload, at: Date.now() }, ...prev].slice(0, limit));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [events, limit]);

  return log;
}

/** True once the native module has been confirmed absent (fires under Expo Go). */
export function useNativeTransportUnavailable(): { unavailable: boolean; reason?: string } {
  const [state, setState] = useState<{ unavailable: boolean; reason?: string }>({ unavailable: false });
  useEffect(() => {
    return mqttEvents.on(MQTT_EVENT.NATIVE_TRANSPORT_UNAVAILABLE, (payload: { reason: string }) => {
      setState({ unavailable: true, reason: payload.reason });
    });
  }, []);
  return state;
}
