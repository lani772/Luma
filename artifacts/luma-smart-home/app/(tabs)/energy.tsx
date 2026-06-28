import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import BarChart from "@/components/BarChart";
import ProgressBar from "@/components/ProgressBar";
import { ENERGY_WEEKLY, ENERGY_MONTHLY } from "@/data/luma-data";

export default function EnergyScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lamps } = useLuma();
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");

  const totalToday = lamps.reduce((a, l) => a + l.energyToday, 0);
  const totalCostToday = lamps.reduce((a, l) => a + l.costToday, 0);
  const totalMonth = lamps.reduce((a, l) => a + l.energyMonth, 0);
  const totalCostMonth = lamps.reduce((a, l) => a + l.costMonth, 0);
  const totalPower = lamps.reduce((a, l) => a + (l.on ? l.power : 0), 0);

  const chartData = period === "daily"
    ? ENERGY_WEEKLY.map(e => ({ label: e.day, value: e.kwh }))
    : ENERGY_MONTHLY.map(e => ({ label: e.m, value: e.kwh }));

  const maxEnergy = Math.max(...lamps.map(l => l.energyToday), 0.01);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Energy</Text>
        <View style={[styles.powerPill, totalPower > 0 && { borderColor: C.purple + "40", backgroundColor: C.purple + "12" }]}>
          <Feather name="zap" size={11} color="#c4b5fd" />
          <Text style={styles.powerText}>{totalPower}W now</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary cards */}
        <View style={styles.statGrid}>
          <SummaryCard label="Today" kwh={totalToday} cost={totalCostToday} color={C.accentL} icon="sun" />
          <SummaryCard label="This Month" kwh={totalMonth} cost={totalCostMonth} color={C.purple} icon="calendar" />
        </View>

        {/* Toggle */}
        <View style={styles.toggleRow}>
          {(["daily", "monthly"] as const).map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.toggleBtn, period === p && { backgroundColor: C.accent + "20", borderColor: C.accentL + "40" }]}
            >
              <Text style={[styles.toggleText, period === p && { color: C.accentL }]}>
                {p === "daily" ? "Daily (7d)" : "Monthly (6m)"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{period === "daily" ? "Last 7 Days (kWh)" : "Last 6 Months (kWh)"}</Text>
          <BarChart data={chartData} color={C.accent} height={120} />
        </View>

        {/* Per-device breakdown */}
        <Text style={styles.sectionLabel}>Device Breakdown</Text>
        {lamps.map(lamp => {
          const totalW = lamp.voltage * lamp.current;
          return (
            <View key={lamp.id} style={styles.deviceRow}>
              <View style={styles.deviceHeader}>
                <View style={[styles.deviceIcon, { backgroundColor: lamp.on ? lamp.rgb + "25" : C.elevated }]}>
                  <Feather name="zap" size={14} color={lamp.on ? lamp.rgb : C.mute} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName} numberOfLines={1}>{lamp.name}</Text>
                  <Text style={styles.deviceRoom}>{lamp.room}</Text>
                </View>
                <View style={styles.deviceStats}>
                  <Text style={[styles.deviceKwh, { color: C.accentL }]}>{lamp.energyToday.toFixed(2)} kWh</Text>
                  <Text style={styles.deviceCost}>${lamp.costToday.toFixed(3)}</Text>
                </View>
              </View>
              <ProgressBar value={lamp.energyToday} max={maxEnergy} color={C.accent} height={3} />
              <View style={styles.elecRow}>
                <ElecStat label="Voltage" value={`${lamp.voltage}V`} color={C.gold} />
                <ElecStat label="Current" value={`${lamp.current.toFixed(3)}A`} color={C.teal} />
                <ElecStat label="Power" value={`${lamp.power}W`} color={C.purple} />
                <ElecStat label="Month" value={`${lamp.energyMonth.toFixed(1)} kWh`} color={C.accentL} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, kwh, cost, color, icon }: { label: string; kwh: number; cost: number; color: string; icon: string }) {
  return (
    <View style={[styles.summaryCard, { borderColor: color + "25" }]}>
      <View style={styles.summaryTop}>
        <Feather name={icon as any} size={14} color={color} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={[styles.summaryKwh, { color }]}>{kwh.toFixed(2)}</Text>
      <Text style={styles.summaryUnit}>kWh</Text>
      <Text style={styles.summaryCost}>${cost.toFixed(3)} cost</Text>
    </View>
  );
}

function ElecStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.elecStat}>
      <Text style={styles.elecLabel}>{label}</Text>
      <Text style={[styles.elecValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  title: { fontSize: 24, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  powerPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  powerText: { fontSize: 11, color: "#c4b5fd", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  statGrid: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, padding: 14 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  summaryLabel: { fontSize: 10, color: C.mute, fontWeight: "700" as const, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Inter_600SemiBold" },
  summaryKwh: { fontSize: 26, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  summaryUnit: { fontSize: 11, color: C.sec, marginTop: 1, fontFamily: "Inter_400Regular" },
  summaryCost: { fontSize: 11, color: C.mute, marginTop: 4, fontFamily: "Inter_400Regular" },
  toggleRow: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 13, padding: 4, gap: 4, marginBottom: 16, borderWidth: 1, borderColor: C.b0 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  toggleText: { fontSize: 12, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  chartCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, marginBottom: 18 },
  chartTitle: { fontSize: 12, color: C.sec, fontWeight: "700" as const, marginBottom: 12, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  deviceRow: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 10, gap: 8 },
  deviceHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  deviceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  deviceRoom: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  deviceStats: { alignItems: "flex-end" },
  deviceKwh: { fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  deviceCost: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  elecRow: { flexDirection: "row", gap: 0 },
  elecStat: { flex: 1, alignItems: "center" },
  elecLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 },
  elecValue: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold", marginTop: 2 },
});
