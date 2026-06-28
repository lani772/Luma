import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";

export default function ScenesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { scenes, lamps, activateScene } = useLuma();

  const activeScene = scenes.find(s => s.active);

  function handleActivate(id: string) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    activateScene(id);
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Scenes</Text>
        {activeScene && (
          <View style={[styles.activePill, { backgroundColor: activeScene.color + "18", borderColor: activeScene.color + "40" }]}>
            <Text style={[styles.activePillText, { color: activeScene.color }]}>{activeScene.emoji} Active</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Active scene banner */}
        {activeScene && (
          <View style={[styles.activeBanner, { backgroundColor: activeScene.color + "14", borderColor: activeScene.color + "35" }]}>
            <Text style={styles.activeBannerEmoji}>{activeScene.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeBannerTitle, { color: activeScene.color }]}>{activeScene.name}</Text>
              <Text style={styles.activeBannerDesc}>{activeScene.desc}</Text>
            </View>
            <View style={[styles.activeIndicator, { backgroundColor: activeScene.color }]} />
          </View>
        )}

        <Text style={styles.sectionLabel}>All Scenes</Text>
        <View style={styles.grid}>
          {scenes.map(s => {
            const active = s.active;
            const affectedLamps = lamps.filter(l => {
              const cfgs: Record<string, string[]> = {
                morning: ["L001", "L003"], movie: ["L001"], reading: ["L005"],
                sleep: ["L001", "L002", "L003", "L005"], away: ["L004"], vacation: ["L001"],
              };
              return (cfgs[s.id] || []).includes(l.id);
            });

            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.sceneCard, { borderColor: active ? s.color + "50" : C.b0, backgroundColor: active ? s.color + "14" : C.surface }]}
                onPress={() => handleActivate(s.id)}
                activeOpacity={0.75}
              >
                {active && <View style={[styles.activeDot, { backgroundColor: s.color }]} />}
                <Text style={styles.emoji}>{s.emoji}</Text>
                <Text style={[styles.sceneName, active && { color: s.color }]}>{s.name}</Text>
                <Text style={styles.sceneDesc}>{s.desc}</Text>
                <Text style={styles.lampCount}>{affectedLamps.length} lamp{affectedLamps.length !== 1 ? "s" : ""}</Text>

                <View style={[styles.activateBtn, { backgroundColor: active ? s.color : C.elevated, borderColor: active ? s.color : C.b0 }]}>
                  <Text style={[styles.activateBtnText, { color: active ? "#fff" : C.mute }]}>
                    {active ? "Active" : "Activate"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active lamp states */}
        <Text style={styles.sectionLabel}>Lamp States</Text>
        {lamps.map(lamp => (
          <View key={lamp.id} style={styles.lampRow}>
            <View style={[styles.lampDot, { backgroundColor: lamp.on ? lamp.rgb : C.mute }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lampName}>{lamp.name}</Text>
              <Text style={styles.lampRoom}>{lamp.room}</Text>
            </View>
            <View style={styles.lampStatus}>
              <Text style={[styles.lampState, { color: lamp.on ? C.on : C.mute }]}>{lamp.on ? "ON" : "OFF"}</Text>
              {lamp.on && <Text style={styles.lampBrightness}>{lamp.brightness}%</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  activePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  activePillText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  activeBanner: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  activeBannerEmoji: { fontSize: 28 },
  activeBannerTitle: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  activeBannerDesc: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  activeIndicator: { width: 4, height: 40, borderRadius: 2 },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontFamily: "Inter_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  sceneCard: { width: "47%", borderRadius: 18, borderWidth: 1.5, padding: 16, position: "relative" },
  activeDot: { position: "absolute", top: 12, right: 12, width: 8, height: 8, borderRadius: 99 },
  emoji: { fontSize: 28, marginBottom: 8 },
  sceneName: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", marginBottom: 3 },
  sceneDesc: { fontSize: 10, color: C.mute, lineHeight: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
  lampCount: { fontSize: 9, color: C.mute, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Inter_400Regular", marginBottom: 10 },
  activateBtn: { borderRadius: 8, paddingVertical: 7, alignItems: "center", borderWidth: 1 },
  activateBtnText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  lampRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  lampDot: { width: 10, height: 10, borderRadius: 99 },
  lampName: { fontSize: 13, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  lampRoom: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  lampStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  lampState: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  lampBrightness: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
});
