import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import ProgressBar from "@/components/ProgressBar";
import { rssiColor, signalColor, timeAgo } from "@/data/luma-data";

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lamps } = useLuma();

  const healthy = lamps.filter(l => l.online && l.health.signalQuality >= 70).length;
  const warning = lamps.filter(l => l.online && l.health.signalQuality >= 40 && l.health.signalQuality < 70).length;
  const critical = lamps.filter(l => !l.online || l.health.signalQuality < 40).length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Device Health</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          <SummaryBadge label="Healthy" value={healthy} color={C.on} icon="check-circle" />
          <SummaryBadge label="Warning" value={warning} color={C.warn} icon="alert-triangle" />
          <SummaryBadge label="Critical" value={critical} color={C.off} icon="x-circle" />
        </View>

        <Text style={styles.sectionLabel}>Device Status</Text>

        {lamps.map(lamp => {
          const sq = lamp.health.signalQuality;
          const sc = signalColor(sq);
          const rc = rssiColor(lamp.health.rssi);
          const cpu = lamp.health.cpu;
          const mem = lamp.health.memory;
          const status = !lamp.online ? "critical" : sq < 40 ? "critical" : sq < 70 ? "warning" : "healthy";
          const statusColor = status === "healthy" ? C.on : status === "warning" ? C.warn : C.off;

          return (
            <View key={lamp.id} style={[styles.healthCard, { borderColor: statusColor + "25" }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.lampIcon, { backgroundColor: statusColor + "18", borderColor: statusColor + "30" }]}>
                  <Feather name={lamp.online ? "zap" : "zap-off"} size={16} color={statusColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lampName} numberOfLines={1}>{lamp.name}</Text>
                  <Text style={styles.lampRoom}>{lamp.room} · {lamp.firmware}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: statusColor + "18", borderColor: statusColor + "30" }]}>
                  <Text style={[styles.statusChipText, { color: statusColor }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                </View>
              </View>

              {/* Metrics */}
              <View style={styles.metricsGrid}>
                <MetricRow label="Signal Quality" value={`${sq}%`} pct={sq} color={sc} />
                <MetricRow label="CPU Usage" value={`${cpu}%`} pct={cpu} color={cpu > 60 ? C.warn : C.on} />
                <MetricRow label="Memory" value={`${mem}%`} pct={mem} color={mem > 70 ? C.warn : C.on} />
              </View>

              {/* Info chips */}
              <View style={styles.chipRow}>
                <Chip label={`${lamp.health.rssi} dBm`} icon="wifi" color={rc} />
                <Chip label={lamp.health.ip || "Offline"} icon="server" color={lamp.online ? C.sec : C.mute} />
                <Chip label={lamp.health.uptime || "—"} icon="clock" color={C.mute} />
                <Chip label={`${lamp.health.restartCount} restarts`} icon="refresh-cw" color={lamp.health.restartCount > 5 ? C.warn : C.mute} />
              </View>

              <Text style={styles.lastSeen}>Last seen {timeAgo(lamp.lastSeen)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SummaryBadge({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[styles.summaryCard, { borderColor: color + "30", backgroundColor: color + "10" }]}>
      <Feather name={icon as any} size={18} color={color} />
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MetricRow({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricBar}>
        <ProgressBar value={pct} max={100} color={color} height={4} />
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, icon, color }: { label: string; icon: string; color: string }) {
  return (
    <View style={styles.chipItem}>
      <Feather name={icon as any} size={9} color={color} />
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 22, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 9, color: C.mute, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  healthCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  lampIcon: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  lampName: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  lampRoom: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusChipText: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  metricsGrid: { gap: 6 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricLabel: { fontSize: 10, color: C.mute, width: 88, fontFamily: "Inter_400Regular" },
  metricBar: { flex: 1 },
  metricValue: { fontSize: 11, fontWeight: "700" as const, width: 32, textAlign: "right", fontFamily: "Inter_700Bold" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipItem: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.elevated, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.b0 },
  chipText: { fontSize: 9, fontFamily: "Inter_400Regular" },
  lastSeen: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
});
