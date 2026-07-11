import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { C } from "@/constants/colors";
import { useMQTTComms } from "@/context/MQTTContext";
import type { ActiveChannel } from "@/src/modules/mqtt";

const CHANNEL_META: Record<ActiveChannel, { label: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  cloud: { label: "Cloud MQTT", icon: "cloud", color: C.on },
  local: { label: "Local MQTT", icon: "wifi", color: C.teal },
  http: { label: "HTTP Fallback", icon: "globe", color: C.warn },
  bluetooth: { label: "Bluetooth Mesh", icon: "bluetooth", color: "#93c5fd" },
  offline: { label: "Offline — Queued", icon: "cloud-off", color: C.off },
};

export default function CommsStatusPanel() {
  const { status, nativeUnavailable } = useMQTTComms();
  const active = CHANNEL_META[status.activeChannel];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Feather name="radio" size={14} color={C.sec} />
          <Text style={styles.title}>Communication Engine</Text>
        </View>
        <View style={[styles.activePill, { backgroundColor: active.color + "18", borderColor: active.color + "40" }]}>
          <Feather name={active.icon} size={11} color={active.color} />
          <Text style={[styles.activeText, { color: active.color }]}>{active.label}</Text>
        </View>
      </View>

      {nativeUnavailable && (
        <View style={styles.warnBanner}>
          <Feather name="alert-triangle" size={12} color="#fde68a" />
          <Text style={styles.warnText}>
            Native MQTT module not loaded — using the simulated bridge. Build a dev client to use the real transport.
          </Text>
        </View>
      )}

      <View style={styles.rowsWrap}>
        <ChannelRow
          label="Cloud"
          connected={status.cloud.connected}
          detail={`${status.cloud.transport}${status.cloud.latencyMs != null ? ` · ${Math.round(status.cloud.latencyMs)}ms` : ""}`}
        />
        <ChannelRow
          label="Local"
          connected={status.local?.connected ?? false}
          detail={status.local ? status.local.transport : "not configured"}
        />
        <ChannelRow
          label="Bluetooth"
          connected={status.bluetooth.available}
          detail={`${status.bluetooth.peerCount} peer${status.bluetooth.peerCount === 1 ? "" : "s"}${status.bluetooth.route ? ` · ${status.bluetooth.route}` : ""}`}
        />
        <ChannelRow
          label="Offline queue"
          connected={status.offlineQueueSize === 0}
          detail={`${status.offlineQueueSize} pending`}
          invertColor
        />
      </View>

      <Text style={styles.footerText}>{status.discoveredDeviceCount} ESP32 device(s) discovered on the network</Text>
    </View>
  );
}

function ChannelRow({ label, connected, detail, invertColor }: { label: string; connected: boolean; detail: string; invertColor?: boolean }) {
  const good = invertColor ? connected : connected;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: good ? C.on : C.mute }]} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowDetail} numberOfLines={1}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.b0,
    padding: 14,
    gap: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 12, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  activePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  activeText: { fontSize: 10, fontWeight: "800" as const, fontFamily: "Inter_700Bold" },
  warnBanner: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#fde68a14", borderColor: "#fde68a30", borderWidth: 1, borderRadius: 10, padding: 8 },
  warnText: { fontSize: 10, color: "#fde68a", flex: 1, fontFamily: "Inter_400Regular", lineHeight: 14 },
  rowsWrap: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 99 },
  rowLabel: { fontSize: 11, color: C.txt, fontFamily: "Inter_600SemiBold", width: 78 },
  rowDetail: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", flex: 1 },
  footerText: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
});
