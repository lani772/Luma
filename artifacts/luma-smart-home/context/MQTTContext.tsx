/**
 * MQTTContext — thin React wiring around `src/modules/mqtt`. Kept separate
 * from `LumaContext` (which already owns lamps/scenes/users state) so the
 * communication engine's plumbing doesn't bloat that file; this context
 * only bootstraps the manager once and republishes its status/log for
 * screens to consume.
 */
import React, { createContext, useContext, useEffect } from "react";
import {
  initMQTT,
  mqttManager,
  useMQTTStatus,
  useMQTTEventLog,
  useNativeTransportUnavailable,
  MQTTManagerStatus,
  MQTTLogEntry,
  GatedCommand,
} from "@/src/modules/mqtt";
import type { LumaRole } from "@/data/luma-data";

interface MQTTContextType {
  status: MQTTManagerStatus;
  log: MQTTLogEntry[];
  nativeUnavailable: boolean;
  nativeUnavailableReason?: string;
  sendCommand: (
    deviceId: string,
    role: LumaRole,
    command: GatedCommand,
    params: Record<string, unknown>,
  ) => ReturnType<typeof mqttManager.publishCommand>;
}

const MQTTContext = createContext<MQTTContextType | null>(null);

export function MQTTProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Cloud host mirrors the server-side simulated broker (see
    // api-server/src/engines/mqtt) until a real broker is configured.
    initMQTT({
      cloud: { host: process.env.EXPO_PUBLIC_MQTT_CLOUD_HOST ?? "mqtt.luma.local", port: 8883 },
      httpBaseUrl: process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : undefined,
    });
  }, []);

  const status = useMQTTStatus();
  const log = useMQTTEventLog();
  const { unavailable, reason } = useNativeTransportUnavailable();

  const sendCommand = (deviceId: string, role: LumaRole, command: GatedCommand, params: Record<string, unknown>) =>
    mqttManager.publishCommand(deviceId, role, command, params);

  return (
    <MQTTContext.Provider value={{ status, log, nativeUnavailable: unavailable, nativeUnavailableReason: reason, sendCommand }}>
      {children}
    </MQTTContext.Provider>
  );
}

export function useMQTTComms(): MQTTContextType {
  const ctx = useContext(MQTTContext);
  if (!ctx) throw new Error("useMQTTComms must be used within MQTTProvider");
  return ctx;
}
