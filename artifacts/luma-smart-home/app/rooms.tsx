import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import ProgressBar from "@/components/ProgressBar";
import { ROOMS } from "@/data/luma-data";

export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lamps } = useLuma();

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>All Rooms</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {ROOMS.map(room => {
            const rl = lamps.filter(l => room.lampIds.includes(l.id));
            const on = rl.filter(l => l.on).length;
            const online = rl.filter(l => l.online).length;
            const power = rl.reduce((a, l) => a + (l.on ? l.power : 0), 0);
            const energy = rl.reduce((a, l) => a + l.energyToday, 0);
            return (
              <View key={room.id} style={[styles.roomCard, on > 0 && { borderColor: C.on + "30" }]}>
                <View style={styles.roomHeader}>
                  <Text style={styles.roomEmoji}>{room.emoji}</Text>
                  <View>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.roomCount}>{rl.length} lamp{rl.length !== 1 ? "s" : ""}</Text>
                  </View>
                </View>
                <View style={styles.statsGrid}>
                  <Stat label="Active" value={`${on}/${rl.length}`} color={on > 0 ? C.on : C.mute} />
                  <Stat label="Online" value={`${online}/${rl.length}`} color={online === rl.length ? C.on : C.warn} />
                  <Stat label="Power" value={`${power}W`} color={C.gold} />
                  <Stat label="Today" value={`${energy.toFixed(2)}kWh`} color={C.accentL} />
                </View>
                <ProgressBar value={on} max={Math.max(rl.length, 1)} color={on > 0 ? C.on : C.mute} height={3} />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  roomCard: { width: "47%", backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 14, gap: 10 },
  roomHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  roomEmoji: { fontSize: 22 },
  roomName: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  roomCount: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  statsGrid: { gap: 5 },
  stat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  statValue: { fontSize: 12, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
});
