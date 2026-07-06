import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, GRAD } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import BarChart from "@/components/BarChart";
import DonutChart from "@/components/DonutChart";
import {
  ENERGY_TODAY, ENERGY_WEEK_FORECAST, ENERGY_MONTH_FORECAST, HOURLY_WATTS,
  LAMP_ANALYTICS, ENERGY_INSIGHTS, SAVINGS_SUMMARY, effColor, effGrade, ROOMS,
} from "@/data/luma-data";

const PERIODS = ["today", "week", "month"] as const;
type Period = typeof PERIODS[number];
const SECTIONS = ["Overview", "Power Curve", "By Lamp", "Insights"] as const;
type SectionT = typeof SECTIONS[number];

export default function EnergyScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lamps } = useLuma();
  const [period, setPeriod] = useState<Period>("today");
  const [section, setSection] = useState<SectionT>("Overview");
  const [sortKey, setSortKey] = useState<"kwh" | "cost" | "eff">("kwh");

  const totalToday = lamps.reduce((a, l) => a + l.energyToday, 0);
  const totalCostToday = lamps.reduce((a, l) => a + l.costToday, 0);
  const totalMonth = lamps.reduce((a, l) => a + l.energyMonth, 0);
  const totalCostMonth = lamps.reduce((a, l) => a + l.costMonth, 0);
  const totalPower = lamps.reduce((a, l) => a + (l.on ? l.power : 0), 0);
  const avgDaily = totalMonth / 30;
  const peakPower = Math.max(...HOURLY_WATTS.map(h => h.w ?? 0));

  const periodData = period === "today" ? ENERGY_TODAY : period === "week" ? ENERGY_WEEK_FORECAST : ENERGY_MONTH_FORECAST;
  const chartData = periodData.map(d => ({ label: d.t, value: d.kwh ?? 0 }));

  const distribution = useMemo(() => {
    return ROOMS.map((r, i) => {
      const lampId = r.lampIds[0];
      const analytics = LAMP_ANALYTICS.find(l => l.lampId === lampId);
      return { room: r.name, emoji: r.emoji, kwh: analytics?.kwh ?? 0, color: analytics?.color ?? GRAD.avatars[i % GRAD.avatars.length][0] };
    });
  }, []);
  const totalDistKwh = distribution.reduce((a, d) => a + d.kwh, 0) || 1;

  const sortedLamps = useMemo(() => {
    return [...LAMP_ANALYTICS].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [sortKey]);

  const forecastSavingsPct = 8.3;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Energy</Text>
        <View style={[styles.powerPill, totalPower > 0 && { borderColor: C.purple + "40", backgroundColor: C.purple + "12" }]}>
          <Feather name="zap" size={11} color={C.accentL} />
          <Text style={styles.powerText}>{totalPower}W now</Text>
        </View>
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={styles.periodBtn}>
            {period === p ? (
              <LinearGradient colors={GRAD.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.periodBtnActive}>
                <Text style={styles.periodTextActive}>{p === "today" ? "Today" : p === "week" ? "Week" : "Month"}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.periodText}>{p === "today" ? "Today" : p === "week" ? "Week" : "Month"}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <KpiCard label="Today" value={totalToday.toFixed(2)} unit="kWh" trend="+4.2%" up color={C.accentL} icon="sun" />
          <KpiCard label="This Month" value={totalMonth.toFixed(0)} unit="kWh" trend="-8.3%" up={false} color={C.purple} icon="calendar" />
          <KpiCard label="Avg Daily" value={avgDaily.toFixed(2)} unit="kWh" color={C.teal} icon="activity" />
          <KpiCard label="Peak Power" value={peakPower.toString()} unit="W" color={C.warn} icon="trending-up" />
        </View>

        {/* Section tabs */}
        <View style={styles.sectionTabBar}>
          {SECTIONS.map(s => (
            <TouchableOpacity key={s} onPress={() => setSection(s)} style={styles.sectionTabBtn}>
              <Text style={[styles.sectionTabText, section === s && styles.sectionTabTextActive]}>{s}</Text>
              {section === s && <LinearGradient colors={GRAD.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sectionIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {section === "Overview" && (
          <>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Consumption Trend ({period === "today" ? "Today, hourly" : period === "week" ? "This week" : "This month"})</Text>
              <BarChart data={chartData} color={C.accent} height={120} />
            </View>

            <View style={styles.kpiGrid}>
              <View style={[styles.miniCard, { flex: 1 }]}>
                <View style={styles.miniCardTop}>
                  <Feather name="zap" size={12} color={C.on} />
                  <Text style={styles.miniCardLabel}>Live Power</Text>
                </View>
                <Text style={[styles.miniCardValue, { color: C.on }]}>{totalPower}W</Text>
                <Text style={styles.miniCardSub}>{lamps.filter(l => l.on).length} lamps active</Text>
              </View>
              <View style={[styles.miniCard, { flex: 1 }]}>
                <View style={styles.miniCardTop}>
                  <Feather name="award" size={12} color={C.teal} />
                  <Text style={styles.miniCardLabel}>Efficiency</Text>
                </View>
                <Text style={[styles.miniCardValue, { color: C.teal }]}>{effGrade(89)}</Text>
                <Text style={styles.miniCardSub}>Fleet average grade</Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Energy Distribution by Room</Text>
              <View style={styles.donutRow}>
                <DonutChart data={distribution.map(d => ({ value: d.kwh, color: d.color }))} size={130} strokeWidth={20} />
                <View style={styles.legendCol}>
                  {distribution.map((d, i) => (
                    <View key={i} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                      <Text style={styles.legendText} numberOfLines={1}>{d.emoji} {d.room}</Text>
                      <Text style={styles.legendPct}>{((d.kwh / totalDistKwh) * 100).toFixed(0)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.forecastBanner}>
              <View style={styles.forecastTop}>
                <Feather name="trending-down" size={16} color={C.on} />
                <Text style={styles.forecastTitle}>Forecast vs Last Period</Text>
              </View>
              <View style={styles.forecastTrack}>
                <LinearGradient colors={GRAD.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.forecastFill, { width: `${100 - forecastSavingsPct}%` }]} />
              </View>
              <Text style={styles.forecastText}>Projected {forecastSavingsPct}% savings vs last period · ${SAVINGS_SUMMARY.projected.toFixed(2)} saved</Text>
            </View>
          </>
        )}

        {section === "Power Curve" && (
          <>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Hourly Power Draw (W)</Text>
              <BarChart data={HOURLY_WATTS.map(h => ({ label: h.t, value: h.w ?? 0 }))} color={C.warn} height={120} />
            </View>

            <Text style={styles.sectionLabel}>Peak Analysis</Text>
            <View style={styles.matrixCard}>
              <PeakRow label="Peak Power" value={`${peakPower}W`} time="8PM" color={C.warn} />
              <PeakRow label="Lowest Draw" value="45W" time="6AM" color={C.on} />
              <PeakRow label="Avg Draw" value={`${Math.round(HOURLY_WATTS.reduce((a, h) => a + (h.w ?? 0), 0) / HOURLY_WATTS.length)}W`} time="All day" color={C.accentL} />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Cost vs Consumption</Text>
              <BarChart data={ENERGY_TODAY.map(d => ({ label: d.t, value: d.cost ?? 0 }))} color={C.teal} height={100} />
            </View>
          </>
        )}

        {section === "By Lamp" && (
          <>
            <View style={styles.sortRow}>
              <Text style={styles.sectionLabel}>By Lamp</Text>
              <View style={styles.sortBtns}>
                {(["kwh", "cost", "eff"] as const).map(k => (
                  <TouchableOpacity key={k} onPress={() => setSortKey(k)} style={[styles.sortBtn, sortKey === k && { backgroundColor: C.accent + "20", borderColor: C.accentL + "40" }]}>
                    <Text style={[styles.sortBtnText, sortKey === k && { color: C.accentL }]}>{k === "kwh" ? "kWh" : k === "cost" ? "Cost" : "Eff%"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {sortedLamps.map(l => {
              const ec = effColor(l.eff);
              return (
                <View key={l.lampId} style={styles.lampRow}>
                  <View style={[styles.lampIcon, { backgroundColor: l.on ? l.color + "25" : C.elevated }]}>
                    <Feather name="zap" size={14} color={l.on ? l.color : C.mute} />
                  </View>
                  <View style={styles.lampInfo}>
                    <Text style={styles.lampName} numberOfLines={1}>{l.name}</Text>
                    <Text style={styles.lampRoom}>{l.room}</Text>
                  </View>
                  <View style={styles.lampStatCol}>
                    <Text style={styles.lampStatLabel}>kWh</Text>
                    <Text style={styles.lampStatValue}>{l.kwh.toFixed(1)}</Text>
                  </View>
                  <View style={styles.lampStatCol}>
                    <Text style={styles.lampStatLabel}>Cost</Text>
                    <Text style={styles.lampStatValue}>${l.cost.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.effBadge, { backgroundColor: ec + "18", borderColor: ec + "40" }]}>
                    <Text style={[styles.effBadgeText, { color: ec }]}>{effGrade(l.eff)}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {section === "Insights" && (
          <>
            <Text style={styles.sectionLabel}>Smart Insights</Text>
            {ENERGY_INSIGHTS.map((ins, i) => (
              <View key={i} style={[styles.insightCard, { borderLeftColor: ins.color }]}>
                <View style={styles.insightTop}>
                  <Feather name={ins.icon as any} size={15} color={ins.color} />
                  <Text style={styles.insightTitle}>{ins.title}</Text>
                  <View style={[styles.insightTag, { backgroundColor: ins.color + "18" }]}>
                    <Text style={[styles.insightTagText, { color: ins.color }]}>{ins.tag}</Text>
                  </View>
                </View>
                <Text style={styles.insightText}>{ins.text}</Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>Savings Summary</Text>
            <View style={styles.savingsCard}>
              <SavingsCol label="This Month" value={`$${SAVINGS_SUMMARY.thisMonth.toFixed(2)}`} color={C.on} />
              <View style={styles.savingsDivider} />
              <SavingsCol label="Projected" value={`$${SAVINGS_SUMMARY.projected.toFixed(2)}`} color={C.accentL} />
              <View style={styles.savingsDivider} />
              <SavingsCol label="Annual Est." value={`$${SAVINGS_SUMMARY.annual.toFixed(1)}`} color={C.warn} />
            </View>
          </>
        )}

        {/* Cost summary footer */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Today: ${totalCostToday.toFixed(3)}</Text>
          <Text style={styles.footerText}>This Month: ${totalCostMonth.toFixed(2)}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function KpiCard({ label, value, unit, trend, up, color, icon }: { label: string; value: string; unit: string; trend?: string; up?: boolean; color: string; icon: string }) {
  return (
    <View style={[styles.kpiCard, { borderColor: color + "25" }]}>
      <View style={styles.kpiTop}>
        <Feather name={icon as any} size={13} color={color} />
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiUnit}>{unit}</Text>
      {trend && (
        <View style={styles.kpiTrendRow}>
          <Feather name={up ? "trending-up" : "trending-down"} size={10} color={up ? C.on : C.off} />
          <Text style={[styles.kpiTrend, { color: up ? C.on : C.off }]}>{trend}</Text>
        </View>
      )}
    </View>
  );
}

function PeakRow({ label, value, time, color }: { label: string; value: string; time: string; color: string }) {
  return (
    <View style={styles.peakRow}>
      <View style={[styles.peakDot, { backgroundColor: color }]} />
      <Text style={styles.peakLabel}>{label}</Text>
      <Text style={[styles.peakValue, { color }]}>{value}</Text>
      <Text style={styles.peakTime}>{time}</Text>
    </View>
  );
}

function SavingsCol({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.savingsCol}>
      <Text style={[styles.savingsValue, { color }]}>{value}</Text>
      <Text style={styles.savingsLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  powerPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  powerText: { fontSize: 11, color: C.accentL, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  periodRow: { flexDirection: "row", paddingHorizontal: 18, gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  periodBtn: { flex: 1 },
  periodBtnActive: { paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  periodTextActive: { fontSize: 12, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
  periodText: { fontSize: 12, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold", textAlign: "center", paddingVertical: 8 },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  kpiGrid: { flexDirection: "row", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  kpiCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, padding: 14 },
  kpiTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  kpiLabel: { fontSize: 10, color: C.mute, fontWeight: "700" as const, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Inter_600SemiBold" },
  kpiValue: { fontSize: 24, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  kpiUnit: { fontSize: 11, color: C.sec, marginTop: 1, fontFamily: "Inter_400Regular" },
  kpiTrendRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  kpiTrend: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  sectionTabBar: { flexDirection: "row", marginBottom: 16, borderBottomWidth: 1, borderBottomColor: C.b0 },
  sectionTabBtn: { paddingVertical: 8, marginRight: 18 },
  sectionTabText: { fontSize: 12, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  sectionTabTextActive: { color: C.txt },
  sectionIndicator: { height: 2, borderRadius: 2, marginTop: 7 },
  chartCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, marginBottom: 16 },
  chartTitle: { fontSize: 12, color: C.sec, fontWeight: "700" as const, marginBottom: 12, fontFamily: "Inter_600SemiBold" },
  miniCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 12 },
  miniCardTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  miniCardLabel: { fontSize: 10, color: C.mute, fontWeight: "700" as const, fontFamily: "Inter_600SemiBold" },
  miniCardValue: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  miniCardSub: { fontSize: 10, color: C.mute, marginTop: 2, fontFamily: "Inter_400Regular" },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  legendCol: { flex: 1, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 99 },
  legendText: { flex: 1, fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  legendPct: { fontSize: 11, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  forecastBanner: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.on + "30", padding: 16, marginBottom: 16 },
  forecastTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  forecastTitle: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  forecastTrack: { height: 8, borderRadius: 4, backgroundColor: C.elevated, overflow: "hidden", marginBottom: 8 },
  forecastFill: { height: "100%", borderRadius: 4 },
  forecastText: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  matrixCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 16 },
  peakRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  peakDot: { width: 8, height: 8, borderRadius: 99 },
  peakLabel: { flex: 1, fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  peakValue: { fontSize: 13, fontWeight: "700" as const, fontFamily: "Inter_700Bold", marginRight: 8 },
  peakTime: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  sortRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sortBtns: { flexDirection: "row", gap: 6, marginBottom: 10 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  sortBtnText: { fontSize: 10, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  lampRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 12, marginBottom: 8 },
  lampIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  lampInfo: { flex: 1.4 },
  lampName: { fontSize: 12, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  lampRoom: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  lampStatCol: { alignItems: "flex-end", marginRight: 6 },
  lampStatLabel: { fontSize: 8, color: C.mute, textTransform: "uppercase", fontFamily: "Inter_400Regular" },
  lampStatValue: { fontSize: 12, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  effBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  effBadgeText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  insightCard: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.b0, borderLeftWidth: 3, padding: 14, marginBottom: 10 },
  insightTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  insightTitle: { flex: 1, fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  insightTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  insightTagText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  insightText: { fontSize: 11, color: C.sec, lineHeight: 16, fontFamily: "Inter_400Regular" },
  savingsCard: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, marginBottom: 16 },
  savingsCol: { flex: 1, alignItems: "center" },
  savingsDivider: { width: 1, backgroundColor: C.b0 },
  savingsValue: { fontSize: 18, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  savingsLabel: { fontSize: 9, color: C.mute, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Inter_400Regular" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8 },
  footerText: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
});
