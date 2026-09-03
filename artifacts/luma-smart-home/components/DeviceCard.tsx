import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, GestureResponderEvent, Platform, PanResponder, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { C } from "@/constants/colors";
import { Lamp, fmtCountdown, timeAgo } from "@/data/luma-data";
import { useMQTTComms } from "@/context/MQTTContext";
import LumaToggle from "./LumaToggle";
import TimerSheet from "./TimerSheet";

interface DeviceCardProps {
  lamp: Lamp;
  onUpdate: (id: string, patch: Partial<Lamp>) => void;
}

export default function DeviceCard({ lamp, onUpdate }: DeviceCardProps) {
  const [timerOpen, setTimerOpen] = useState(false);
  const [countdown, setCountdown] = useState(lamp.activeTimer ? fmtCountdown(lamp.activeTimer.expiresAt) : "");
  const [brightness, setBrightness] = useState(lamp.brightness);
  const sliderWidth = useRef(0);
  const glowAnim = useRef(new Animated.Value(lamp.on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: lamp.on ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [lamp.on, glowAnim]);

  useEffect(() => {
    if (!lamp.activeTimer) { setCountdown(""); return; }
    setCountdown(fmtCountdown(lamp.activeTimer.expiresAt));
    const t = setInterval(() => setCountdown(fmtCountdown(lamp.activeTimer!.expiresAt)), 1000);
    return () => clearInterval(t);
  }, [lamp.activeTimer]);

  useEffect(() => { setBrightness(lamp.brightness); }, [lamp.brightness]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => lamp.online,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gs) => {
        if (sliderWidth.current <= 0) return;
        const raw = gs.x0 + gs.dx;
        const pct = Math.min(100, Math.max(1, Math.round((raw / sliderWidth.current) * 100)));
        setBrightness(pct);
      },
      onPanResponderRelease: (_, gs) => {
        if (sliderWidth.current <= 0) return;
        const pct = Math.min(100, Math.max(1, Math.round(((gs.x0 + gs.dx) / sliderWidth.current) * 100)));
        onUpdate(lamp.id, { brightness: pct, lastCommand: `Brightness ${pct}%`, lastUpdate: Date.now() });
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    })
  ).current;

  const handleToggle = useCallback(() => {
    if (!lamp.online) return;
    const next = !lamp.on;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpdate(lamp.id, { on: next, lastCommand: next ? "Turn ON" : "Turn OFF", lastUpdate: Date.now() });
  }, [lamp.id, lamp.on, lamp.online, onUpdate]);

  const handleTimerSet = useCallback((ms: number, action: "on" | "off") => {
    onUpdate(lamp.id, {
      activeTimer: { action, expiresAt: Date.now() + ms, label: `${Math.round(ms / 60000)}m→${action.toUpperCase()}` },
      lastCommand: `Timer ${Math.round(ms / 60000)}m`,
      lastUpdate: Date.now(),
    });
    setTimerOpen(false);
  }, [lamp.id, onUpdate]);

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0)", lamp.rgb + "50"],
  });

  const mqttOk = lamp.mqttStatus === "connected";
  const brtFill = `${brightness}%`;
  const { status: commsStatus } = useMQTTComms();
  const channelColor =
    commsStatus.activeChannel === "cloud" || commsStatus.activeChannel === "local"
      ? C.on
      : commsStatus.activeChannel === "http"
      ? C.warn
      : commsStatus.activeChannel === "bluetooth"
      ? "#93c5fd"
      : C.off;

  return (
    <>
      <View style={[styles.card, lamp.on && { borderColor: lamp.rgb + "40", shadowColor: lamp.rgb, shadowOpacity: 0.15, shadowRadius: 12 }]}>
        {/* Top accent line */}
        <View style={[styles.accentLine, { backgroundColor: lamp.on ? lamp.rgb : C.mute + "40" }]} />

        {/* Offline overlay */}
        {!lamp.online && (
          <View style={styles.offlineOverlay}>
            <Feather name="wifi-off" size={22} color={C.sec} />
            <Text style={styles.offlineText}>OFFLINE</Text>
          </View>
        )}

        <View style={styles.inner}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <Animated.View style={[styles.bulbIcon, { shadowColor: lamp.rgb, shadowOpacity: lamp.on ? 0.6 : 0, shadowRadius: 12, backgroundColor: lamp.on ? lamp.rgb + "25" : C.elevated, borderColor: lamp.on ? lamp.rgb + "55" : C.b0 }]}>
              <Feather name="zap" size={20} color={lamp.on ? lamp.rgb : C.mute} />
            </Animated.View>

            <View style={styles.nameBlock}>
              <Text style={styles.name} numberOfLines={1}>{lamp.name}</Text>
              <Text style={styles.room}>{lamp.room} · {lamp.floor}</Text>
            </View>

            <View style={styles.headerRight}>
              <View style={[styles.statePill, { backgroundColor: lamp.on ? C.on + "18" : C.off + "14", borderColor: lamp.on ? C.on + "40" : C.off + "30" }]}>
                <View style={[styles.stateDot, { backgroundColor: lamp.on ? C.on : C.off }]} />
                <Text style={[styles.stateText, { color: lamp.on ? C.on : C.off }]}>{lamp.on ? "ON" : "OFF"}</Text>
              </View>
              <LumaToggle value={lamp.on} onToggle={() => handleToggle()} disabled={!lamp.online} />
            </View>
          </View>

          {/* Badge row */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: mqttOk ? C.on + "12" : C.off + "12", borderColor: mqttOk ? C.on + "28" : C.off + "28" }]}>
              <Text style={[styles.badgeText, { color: mqttOk ? C.on : C.off }]}>MQTT {mqttOk ? "●" : "○"}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: lamp.online ? C.teal + "12" : C.b1, borderColor: lamp.online ? C.teal + "28" : C.b0 }]}>
              <Text style={[styles.badgeText, { color: lamp.online ? C.teal : C.mute }]}>{lamp.online ? "Online" : "Offline"}</Text>
            </View>
            <View style={[styles.badge]}>
              <Text style={styles.badgeText}>FW {lamp.firmware}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: channelColor + "12", borderColor: channelColor + "28" }]}>
              <Text style={[styles.badgeText, { color: channelColor }]}>
                {commsStatus.activeChannel.toUpperCase()}
              </Text>
            </View>
            {lamp.power > 0 && lamp.on && (
              <View style={[styles.badge, { backgroundColor: C.purple + "12", borderColor: C.purple + "28" }]}>
                <Text style={[styles.badgeText, { color: "#c4b5fd" }]}>⚡{lamp.power}W</Text>
              </View>
            )}
            {countdown !== "" && (
              <View style={[styles.badge, { backgroundColor: C.warn + "14", borderColor: C.warn + "30" }]}>
                <Text style={[styles.badgeText, { color: "#fde68a" }]}>⏱ {countdown}</Text>
              </View>
            )}
            <Text style={styles.lastSeen}>{timeAgo(lamp.lastSeen)}</Text>
          </View>

          {/* Brightness slider */}
          <View style={styles.sliderRow}>
            <Feather name="sun" size={14} color={lamp.on ? C.warn : C.mute} style={{ opacity: lamp.online ? 1 : 0.4 }} />
            <View
              style={styles.sliderTrack}
              onLayout={e => { sliderWidth.current = e.nativeEvent.layout.width; }}
              {...(lamp.online ? panResponder.panHandlers : {})}
            >
              <View style={[styles.sliderFill, { width: brtFill as any, backgroundColor: lamp.on ? lamp.rgb : C.mute + "60" }]} />
              <View style={[styles.sliderThumb, { left: `${brightness}%` as any, marginLeft: -8, backgroundColor: lamp.on ? lamp.rgb : C.mute }]} />
            </View>
            <Text style={[styles.brtValue, { color: lamp.on ? lamp.rgb : C.mute }]}>{brightness}%</Text>
          </View>

          {/* Main toggle button */}
          <TouchableOpacity
            onPress={handleToggle}
            disabled={!lamp.online}
            activeOpacity={0.8}
            style={[styles.powerBtn, { backgroundColor: lamp.on ? C.on : "#7f1d1d", opacity: lamp.online ? 1 : 0.4 }]}
          >
            <Feather name="power" size={15} color="#fff" />
            <Text style={styles.powerBtnText}>{lamp.on ? "ON — TAP TO TURN OFF" : "OFF — TAP TO TURN ON"}</Text>
          </TouchableOpacity>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, lamp.activeTimer && { borderColor: C.warn + "40", backgroundColor: C.warn + "12" }]}
              onPress={() => setTimerOpen(true)}
            >
              <Feather name="clock" size={13} color={lamp.activeTimer ? "#fde68a" : C.sec} />
              <Text style={[styles.actionText, lamp.activeTimer && { color: "#fde68a" }]}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, lamp.schedules.length > 0 && { borderColor: C.accent + "40", backgroundColor: C.accent + "12" }]}
              onPress={() => router.push(`/device/${lamp.id}`)}
            >
              <Feather name="calendar" size={13} color={lamp.schedules.length > 0 ? "#93c5fd" : C.sec} />
              <Text style={[styles.actionText, lamp.schedules.length > 0 && { color: "#93c5fd" }]}>Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/device/${lamp.id}`)}
            >
              <Feather name="sliders" size={13} color={C.accentL} />
              <Text style={[styles.actionText, { color: C.accentL }]}>Advanced</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Updated {timeAgo(lamp.lastUpdate)}</Text>
            {lamp.lastCommand && (
              <Text style={styles.footerText}>Last: <Text style={{ color: C.sec }}>{lamp.lastCommand}</Text></Text>
            )}
          </View>
        </View>
      </View>

      <TimerSheet lamp={lamp} visible={timerOpen} onClose={() => setTimerOpen(false)} onSet={handleTimerSet} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.b0,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  accentLine: { height: 2, borderRadius: 2 },
  inner: { padding: 14 },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,9,18,0.65)",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 20,
  },
  offlineText: { fontSize: 11, color: C.sec, fontWeight: "700" as const, letterSpacing: 1.5, fontFamily: "Inter_700Bold" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  bulbIcon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 0 } },
  nameBlock: { flex: 1 },
  name: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  room: { fontSize: 11, color: C.sec, marginTop: 1, fontFamily: "Inter_400Regular" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  statePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  stateDot: { width: 5, height: 5, borderRadius: 99 },
  stateText: { fontSize: 10, fontWeight: "800" as const, letterSpacing: 0.5, fontFamily: "Inter_700Bold" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 10, alignItems: "center" },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: C.b0, backgroundColor: C.bg },
  badgeText: { fontSize: 9, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  lastSeen: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", marginLeft: 2 },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sliderTrack: { flex: 1, height: 6, backgroundColor: C.bg, borderRadius: 99, overflow: "visible", position: "relative" },
  sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99 },
  sliderThumb: { position: "absolute", top: -5, width: 16, height: 16, borderRadius: 99, borderWidth: 2, borderColor: C.bg, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 3 },
  brtValue: { fontSize: 11, fontWeight: "700" as const, minWidth: 34, textAlign: "right", fontFamily: "Inter_700Bold" },
  powerBtn: { borderRadius: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  powerBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" as const, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Inter_700Bold" },
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 12, backgroundColor: C.b1, borderWidth: 1, borderColor: C.b0 },
  actionText: { fontSize: 11, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
});
