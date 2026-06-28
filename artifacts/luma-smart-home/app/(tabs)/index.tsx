import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import BarChart from "@/components/BarChart";
import { ACTIVITY_LOG, ENERGY_WEEKLY, ROOMS, timeAgo } from "@/data/luma-data";

const QUICK_SCENES = ["morning", "movie", "reading", "sleep"];
const SCENE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  morning: { label: "Morning", emoji: "🌅", color: "#D4A017" },
  movie: { label: "Movie", emoji: "🎬", color: "#7C3AED" },
  reading: { label: "Reading", emoji: "📖", color: "#06B6D4" },
  sleep: { label: "Sleep", emoji: "🌙", color: "#4F46E5" },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good Night";
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  if (h < 21) return "Good Evening";
  return "Good Night";
}

function getDate() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { lamps, scenes, notifications, activateScene } = useLuma();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const activeLamps = lamps.filter(l => l.on).length;
  const onlineLamps = lamps.filter(l => l.online).length;
  const totalPower = lamps.reduce((a, l) => a + (l.on ? l.power : 0), 0);
  const unread = notifications.filter(n => !n.read && !n.archived).length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>LUMA</Text>
          <Text style={styles.brandSub}>SMART HOME</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/notifications")}>
          <Feather name="bell" size={20} color={C.sec} />
          {unread > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greetBlock}>
          <Text style={styles.greeting}>{getGreeting()}, Alex</Text>
          <Text style={styles.date}>{getDate()}</Text>
        </View>

        {/* Stat cards */}
        <View style={styles.statRow}>
          <StatCard label="Active" value={String(activeLamps)} max={lamps.length} color={C.on} icon="zap" />
          <StatCard label="Power" value={`${totalPower}W`} max={100} color={C.gold} icon="activity" />
          <StatCard label="Online" value={String(onlineLamps)} max={lamps.length} color={C.teal} icon="wifi" />
        </View>

        {/* Quick Scenes */}
        <SectionLabel>Quick Scenes</SectionLabel>
        <View style={styles.scenesGrid}>
          {QUICK_SCENES.map(id => {
            const s = scenes.find(sc => sc.id === id);
            const meta = SCENE_LABELS[id];
            const active = s?.active ?? false;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => activateScene(id)}
                activeOpacity={0.75}
                style={[styles.sceneBtn, active && { borderColor: meta.color + "60", backgroundColor: meta.color + "18" }]}
              >
                <Text style={styles.sceneEmoji}>{meta.emoji}</Text>
                <Text style={[styles.sceneName, active && { color: meta.color }]}>{meta.label}</Text>
                {active && <View style={[styles.activeDot, { backgroundColor: meta.color }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Rooms */}
        <SectionLabel>Rooms</SectionLabel>
        <View style={styles.roomsGrid}>
          {ROOMS.slice(0, 4).map(room => {
            const rl = lamps.filter(l => room.lampIds.includes(l.id));
            const on = rl.filter(l => l.on).length;
            return (
              <TouchableOpacity
                key={room.id}
                style={[styles.roomCard, on > 0 && { borderColor: C.b2 }]}
                onPress={() => router.push("/rooms")}
                activeOpacity={0.75}
              >
                <Text style={styles.roomEmoji}>{room.emoji}</Text>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={[styles.roomStatus, { color: on > 0 ? C.on : C.mute }]}>{on}/{rl.length} on</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Energy chart */}
        <SectionLabel>Weekly Energy</SectionLabel>
        <View style={styles.chartCard}>
          <BarChart
            data={ENERGY_WEEKLY.map(e => ({ label: e.day, value: e.kwh }))}
            color={C.accent}
            height={90}
          />
          <View style={styles.chartFooter}>
            <Text style={styles.chartSub}>Total this week: <Text style={{ color: C.accentL }}>86.0 kWh</Text></Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/energy")}>
              <Text style={[styles.chartSub, { color: C.accentL }]}>Details →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <SectionLabel>Recent Activity</SectionLabel>
        <View style={styles.activityCard}>
          {ACTIVITY_LOG.slice(0, 4).map(a => {
            const iconMap: Record<string, string> = { device: "zap", scene: "sun", schedule: "clock", login: "log-in", firmware: "refresh-cw", automation: "cpu" };
            const colorMap: Record<string, string> = { device: C.gold, scene: C.purple, schedule: C.accentL, login: C.teal };
            const ic = iconMap[a.type] ?? "activity";
            const cl = colorMap[a.type] ?? C.sec;
            return (
              <View key={a.id} style={styles.activityRow}>
                <View style={[styles.activityIcon, { backgroundColor: cl + "18", borderColor: cl + "30" }]}>
                  <Feather name={ic as any} size={13} color={cl} />
                </View>
                <View style={styles.activityText}>
                  <Text style={styles.activityAction} numberOfLines={1}>{a.action}</Text>
                  <Text style={styles.activityUser}>{a.user}</Text>
                </View>
                <Text style={styles.activityTime}>{timeAgo(a.time)}</Text>
              </View>
            );
          })}
          <TouchableOpacity onPress={() => router.push("/activity")} style={styles.viewAllBtn}>
            <Text style={styles.viewAllText}>View All Activity</Text>
            <Feather name="chevron-right" size={13} color={C.accentL} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function StatCard({ label, value, max, color, icon }: { label: string; value: string; max: number; color: string; icon: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + "25" }]}>
      <View style={styles.statTop}>
        <Feather name={icon as any} size={14} color={color} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  brand: { fontSize: 22, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", letterSpacing: 3 },
  brandSub: { fontSize: 8, color: C.gold, letterSpacing: 4, fontFamily: "Inter_600SemiBold" },
  notifBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: C.off, borderWidth: 1.5, borderColor: C.elevated },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  greetBlock: { marginBottom: 18 },
  greeting: { fontSize: 26, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  date: { fontSize: 12, color: C.mute, marginTop: 2, fontFamily: "Inter_400Regular" },
  statRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, padding: 12 },
  statTop: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  statLabel: { fontSize: 9, color: C.mute, fontWeight: "700" as const, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Inter_600SemiBold" },
  statValue: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  scenesGrid: { flexDirection: "row", gap: 8, marginBottom: 20 },
  sceneBtn: { flex: 1, alignItems: "center", paddingVertical: 12, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0 },
  sceneEmoji: { fontSize: 20, marginBottom: 4 },
  sceneName: { fontSize: 10, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  activeDot: { width: 5, height: 5, borderRadius: 99, marginTop: 4 },
  roomsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  roomCard: { width: "47%", backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14 },
  roomEmoji: { fontSize: 22, marginBottom: 6 },
  roomName: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", marginBottom: 2 },
  roomStatus: { fontSize: 11, fontFamily: "Inter_400Regular" },
  chartCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, marginBottom: 20 },
  chartFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  chartSub: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  activityCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 20 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.b0 },
  activityIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  activityText: { flex: 1 },
  activityAction: { fontSize: 12, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  activityUser: { fontSize: 10, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  activityTime: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  viewAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 12 },
  viewAllText: { fontSize: 12, color: C.accentL, fontWeight: "700" as const, fontFamily: "Inter_600SemiBold" },
});
