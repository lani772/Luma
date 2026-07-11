/**
 * UnifiedDeviceCard
 * Single card component for ALL lamp types — identical design whether the
 * device is GPIO-controlled (relay via Microcontroller) or MQTT-controlled.
 *
 * mode="mqtt"  → Lamp object  → full brightness slider, timer, schedule
 * mode="gpio"  → MCDevice+MC  → relay state bar, same layout & buttons
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { C } from "@/constants/colors";
import { Lamp, MCDevice, Microcontroller, fmtCountdown, timeAgo } from "@/data/luma-data";
import LumaToggle from "./LumaToggle";
import TimerSheet from "./TimerSheet";

// ─── Prop shapes ──────────────────────────────────────────────────────────────

type MQTTMode = {
  mode: "mqtt";
  lamp: Lamp;
  onUpdate: (id: string, patch: Partial<Lamp>) => void;
};

type GPIOMode = {
  mode: "gpio";
  device: MCDevice;
  mc: Microcontroller | undefined;
  onToggle: () => void;
};

export type UnifiedDeviceCardProps = MQTTMode | GPIOMode;

// ─── Entry point ──────────────────────────────────────────────────────────────

export default function UnifiedDeviceCard(props: UnifiedDeviceCardProps) {
  if (props.mode === "mqtt") return <MQTTCard {...props} />;
  return <GPIOCard {...props} />;
}

// ─── MQTT Card ────────────────────────────────────────────────────────────────

function MQTTCard({ lamp, onUpdate }: MQTTMode) {
  const [timerOpen, setTimerOpen]   = useState(false);
  const [countdown, setCountdown]   = useState(lamp.activeTimer ? fmtCountdown(lamp.activeTimer.expiresAt) : "");
  const [brightness, setBrightness] = useState(lamp.brightness);
  const sliderWidth = useRef(0);
  const glowAnim    = useRef(new Animated.Value(lamp.on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, { toValue: lamp.on ? 1 : 0, duration: 400, useNativeDriver: false }).start();
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
        const pct = Math.min(100, Math.max(1, Math.round(((gs.x0 + gs.dx) / sliderWidth.current) * 100)));
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

  const mqttOk  = lamp.mqttStatus === "connected";
  const brtFill = `${brightness}%`;

  return (
    <>
      <View style={[s.card, lamp.on && { borderColor: lamp.rgb + "40", shadowColor: lamp.rgb, shadowOpacity: 0.15, shadowRadius: 12 }]}>
        {/* Accent line */}
        <View style={[s.accentLine, { backgroundColor: lamp.on ? lamp.rgb : C.mute + "40" }]} />

        {/* Offline overlay */}
        {!lamp.online && (
          <View style={s.offlineOverlay}>
            <Feather name="wifi-off" size={22} color={C.sec} />
            <Text style={s.offlineText}>OFFLINE</Text>
          </View>
        )}

        <View style={s.inner}>
          {/* ── Header ─────────────────────────────────────────────── */}
          <View style={s.headerRow}>
            <Animated.View style={[s.bulbIcon, {
              shadowColor: lamp.rgb, shadowOpacity: lamp.on ? 0.6 : 0, shadowRadius: 12,
              backgroundColor: lamp.on ? lamp.rgb + "25" : C.elevated,
              borderColor: lamp.on ? lamp.rgb + "55" : C.b0,
            }]}>
              <Feather name="zap" size={20} color={lamp.on ? lamp.rgb : C.mute} />
            </Animated.View>

            <View style={s.nameBlock}>
              <Text style={s.name} numberOfLines={1}>{lamp.name}</Text>
              <Text style={s.room}>{lamp.room} · {lamp.floor}</Text>
            </View>

            <View style={s.headerRight}>
              <View style={[s.statePill, {
                backgroundColor: lamp.on ? C.on + "18" : C.off + "14",
                borderColor: lamp.on ? C.on + "40" : C.off + "30",
              }]}>
                <View style={[s.stateDot, { backgroundColor: lamp.on ? C.on : C.off }]} />
                <Text style={[s.stateText, { color: lamp.on ? C.on : C.off }]}>{lamp.on ? "ON" : "OFF"}</Text>
              </View>
              <LumaToggle value={lamp.on} onToggle={handleToggle} disabled={!lamp.online} />
            </View>
          </View>

          {/* ── MQTT Badge row ─────────────────────────────────────── */}
          <View style={s.badgeRow}>
            {/* Connection type */}
            <View style={[s.badge, { backgroundColor: mqttOk ? C.on + "12" : C.off + "12", borderColor: mqttOk ? C.on + "28" : C.off + "28" }]}>
              <Text style={[s.badgeText, { color: mqttOk ? C.on : C.off }]}>MQTT {mqttOk ? "●" : "○"}</Text>
            </View>
            {/* Online */}
            <View style={[s.badge, { backgroundColor: lamp.online ? C.teal + "12" : C.b1, borderColor: lamp.online ? C.teal + "28" : C.b0 }]}>
              <Text style={[s.badgeText, { color: lamp.online ? C.teal : C.mute }]}>{lamp.online ? "Online" : "Offline"}</Text>
            </View>
            {/* Firmware */}
            <View style={s.badge}>
              <Text style={s.badgeText}>FW {lamp.firmware}</Text>
            </View>
            {/* Power */}
            {lamp.power > 0 && lamp.on && (
              <View style={[s.badge, { backgroundColor: C.purple + "12", borderColor: C.purple + "28" }]}>
                <Text style={[s.badgeText, { color: "#c4b5fd" }]}>⚡{lamp.power}W</Text>
              </View>
            )}
            {/* Timer countdown */}
            {countdown !== "" && (
              <View style={[s.badge, { backgroundColor: C.warn + "14", borderColor: C.warn + "30" }]}>
                <Text style={[s.badgeText, { color: "#fde68a" }]}>⏱ {countdown}</Text>
              </View>
            )}
            <Text style={s.lastSeen}>{timeAgo(lamp.lastSeen)}</Text>
          </View>

          {/* ── Brightness slider ──────────────────────────────────── */}
          <View style={s.sliderRow}>
            <Feather name="sun" size={14} color={lamp.on ? C.warn : C.mute} style={{ opacity: lamp.online ? 1 : 0.4 }} />
            <View
              style={s.sliderTrack}
              onLayout={e => { sliderWidth.current = e.nativeEvent.layout.width; }}
              {...(lamp.online ? panResponder.panHandlers : {})}
            >
              <View style={[s.sliderFill, { width: brtFill as any, backgroundColor: lamp.on ? lamp.rgb : C.mute + "60" }]} />
              <View style={[s.sliderThumb, { left: `${brightness}%` as any, marginLeft: -8, backgroundColor: lamp.on ? lamp.rgb : C.mute }]} />
            </View>
            <Text style={[s.brtValue, { color: lamp.on ? lamp.rgb : C.mute }]}>{brightness}%</Text>
          </View>

          {/* ── Power button ───────────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleToggle}
            disabled={!lamp.online}
            activeOpacity={0.8}
            style={[s.powerBtn, { backgroundColor: lamp.on ? C.on : "#7f1d1d", opacity: lamp.online ? 1 : 0.4 }]}
          >
            <Feather name="power" size={15} color="#fff" />
            <Text style={s.powerBtnText}>{lamp.on ? "ON — TAP TO TURN OFF" : "OFF — TAP TO TURN ON"}</Text>
          </TouchableOpacity>

          {/* ── Action buttons ─────────────────────────────────────── */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.actionBtn, lamp.activeTimer && { borderColor: C.warn + "40", backgroundColor: C.warn + "12" }]}
              onPress={() => setTimerOpen(true)}
            >
              <Feather name="clock" size={13} color={lamp.activeTimer ? "#fde68a" : C.sec} />
              <Text style={[s.actionText, lamp.activeTimer && { color: "#fde68a" }]}>Timer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, lamp.schedules.length > 0 && { borderColor: C.accent + "40", backgroundColor: C.accent + "12" }]}
              onPress={() => router.push(`/device/${lamp.id}`)}
            >
              <Feather name="calendar" size={13} color={lamp.schedules.length > 0 ? "#93c5fd" : C.sec} />
              <Text style={[s.actionText, lamp.schedules.length > 0 && { color: "#93c5fd" }]}>Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/device/${lamp.id}`)}>
              <Feather name="sliders" size={13} color={C.accentL} />
              <Text style={[s.actionText, { color: C.accentL }]}>Advanced</Text>
            </TouchableOpacity>
          </View>

          {/* ── Footer ────────────────────────────────────────────── */}
          <View style={s.footer}>
            <Text style={s.footerText}>Updated {timeAgo(lamp.lastUpdate)}</Text>
            {lamp.lastCommand && (
              <Text style={s.footerText}>Last: <Text style={{ color: C.sec }}>{lamp.lastCommand}</Text></Text>
            )}
          </View>
        </View>
      </View>

      <TimerSheet lamp={lamp} visible={timerOpen} onClose={() => setTimerOpen(false)} onSet={handleTimerSet} />
    </>
  );
}

// ─── GPIO Card ────────────────────────────────────────────────────────────────

function GPIOCard({ device, mc, onToggle }: GPIOMode) {
  const online  = mc?.online ?? false;
  const accent  = "#f97316";
  const glowAnim = useRef(new Animated.Value(device.on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glowAnim, { toValue: device.on ? 1 : 0, duration: 400, useNativeDriver: false }).start();
  }, [device.on, glowAnim]);

  const handleToggle = useCallback(() => {
    if (!online) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  }, [online, onToggle]);

  const detailRoute = `/mc-device?mcId=${device.mcId}&deviceId=${device.id}` as any;
  const mcName      = device.mcName ?? mc?.name ?? "Unknown MC";

  return (
    <View style={[s.card, device.on && online && { borderColor: accent + "40", shadowColor: accent, shadowOpacity: 0.15, shadowRadius: 12 }]}>
      {/* Accent line */}
      <View style={[s.accentLine, { backgroundColor: device.on && online ? accent : C.mute + "40" }]} />

      {/* Offline overlay */}
      {!online && (
        <View style={s.offlineOverlay}>
          <Feather name="wifi-off" size={22} color={C.sec} />
          <Text style={s.offlineText}>OFFLINE</Text>
        </View>
      )}

      <View style={s.inner}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <Animated.View style={[s.bulbIcon, {
            shadowColor: accent, shadowOpacity: device.on ? 0.6 : 0, shadowRadius: 12,
            backgroundColor: device.on ? accent + "25" : C.elevated,
            borderColor: device.on ? accent + "55" : C.b0,
          }]}>
            <Feather name={device.icon as any} size={20} color={device.on ? accent : C.mute} />
          </Animated.View>

          <View style={s.nameBlock}>
            <Text style={s.name} numberOfLines={1}>{device.name}</Text>
            <Text style={s.room}>{device.room} · {mcName}</Text>
          </View>

          <View style={s.headerRight}>
            <View style={[s.statePill, {
              backgroundColor: device.on ? C.on + "18" : C.off + "14",
              borderColor: device.on ? C.on + "40" : C.off + "30",
            }]}>
              <View style={[s.stateDot, { backgroundColor: device.on ? C.on : C.off }]} />
              <Text style={[s.stateText, { color: device.on ? C.on : C.off }]}>{device.on ? "ON" : "OFF"}</Text>
            </View>
            <LumaToggle value={device.on} onToggle={handleToggle} disabled={!online} />
          </View>
        </View>

        {/* ── GPIO Badge row ─────────────────────────────────────── */}
        <View style={s.badgeRow}>
          {/* Connection type */}
          <View style={[s.badge, { backgroundColor: accent + "18", borderColor: accent + "40" }]}>
            <Text style={[s.badgeText, { color: accent }]}>GPIO ●</Text>
          </View>
          {/* Online/offline */}
          <View style={[s.badge, { backgroundColor: online ? C.teal + "12" : C.b1, borderColor: online ? C.teal + "28" : C.b0 }]}>
            <Text style={[s.badgeText, { color: online ? C.teal : C.mute }]}>{online ? "Online" : "Offline"}</Text>
          </View>
          {/* MC firmware */}
          {mc?.firmware && (
            <View style={s.badge}>
              <Text style={s.badgeText}>FW {mc.firmware}</Text>
            </View>
          )}
          {/* GPIO pin */}
          <View style={[s.badge, { backgroundColor: C.teal + "10", borderColor: C.teal + "25" }]}>
            <Text style={[s.badgeText, { color: C.teal }]}>GPIO {device.gpioPin}</Text>
          </View>
          {/* MC name */}
          <View style={[s.badge, { backgroundColor: accent + "10", borderColor: accent + "22" }]}>
            <Text style={[s.badgeText, { color: accent }]}>⊙ {mcName}</Text>
          </View>
          {/* Active logic */}
          <View style={[s.badge, { backgroundColor: C.accentL + "10", borderColor: C.accentL + "25" }]}>
            <Text style={[s.badgeText, { color: C.accentL }]}>{device.activeHigh ? "ACT-H" : "ACT-L"}</Text>
          </View>
          {/* Last updated */}
          {device.lastUpdated && <Text style={s.lastSeen}>{timeAgo(device.lastUpdated)}</Text>}
        </View>

        {/* ── Relay state bar (identical position to brightness slider) ── */}
        <View style={s.sliderRow}>
          <Feather name="zap" size={14} color={device.on && online ? accent : C.mute} style={{ opacity: online ? 1 : 0.4 }} />
          <View style={s.sliderTrack}>
            <View style={[s.sliderFill, {
              width: (device.on && online ? "100%" : "0%") as any,
              backgroundColor: accent,
            }]} />
            <View style={[s.sliderThumb, {
              left: (device.on && online ? "100%" : "0%") as any,
              marginLeft: device.on && online ? -16 : 0,
              backgroundColor: device.on && online ? accent : C.mute,
            }]} />
          </View>
          <Text style={[s.brtValue, { color: device.on && online ? accent : C.mute }]}>
            {device.on && online ? "ON" : "OFF"}
          </Text>
        </View>

        {/* ── Power button ───────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleToggle}
          disabled={!online}
          activeOpacity={0.8}
          style={[s.powerBtn, { backgroundColor: device.on ? C.on : "#7f1d1d", opacity: online ? 1 : 0.4 }]}
        >
          <Feather name="power" size={15} color="#fff" />
          <Text style={s.powerBtnText}>{device.on ? "ON — TAP TO TURN OFF" : "OFF — TAP TO TURN ON"}</Text>
        </TouchableOpacity>

        {/* ── Action buttons ─────────────────────────────────────── */}
        <View style={s.actionRow}>
          {/* Timer — not yet available for GPIO relays */}
          <TouchableOpacity style={[s.actionBtn, { opacity: 0.38 }]} disabled>
            <Feather name="clock" size={13} color={C.sec} />
            <Text style={s.actionText}>Timer</Text>
          </TouchableOpacity>
          {/* Schedule — opens device detail */}
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push(detailRoute)}>
            <Feather name="calendar" size={13} color={C.sec} />
            <Text style={s.actionText}>Schedule</Text>
          </TouchableOpacity>
          {/* Advanced — opens device detail */}
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push(detailRoute)}>
            <Feather name="sliders" size={13} color={C.accentL} />
            <Text style={[s.actionText, { color: C.accentL }]}>Advanced</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            {device.lastUpdated
              ? `Updated ${timeAgo(device.lastUpdated)}`
              : device.registrationDate
              ? `Registered ${timeAgo(device.registrationDate)}`
              : ""}
          </Text>
          <Text style={s.footerText}>
            Startup:{" "}
            <Text style={{ color: C.sec }}>
              {device.startupState === "on" ? "Always ON" : device.startupState === "off" ? "Always OFF" : "Restore"}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Shared stylesheet (identical to DeviceCard) ─────────────────────────────

const s = StyleSheet.create({
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
  accentLine:     { height: 2, borderRadius: 2 },
  inner:          { padding: 14 },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,9,18,0.65)",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 20,
  },
  offlineText:  { fontSize: 11, color: C.sec, fontWeight: "700" as const, letterSpacing: 1.5, fontFamily: "Inter_700Bold" },
  headerRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  bulbIcon:     { width: 44, height: 44, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 0 } },
  nameBlock:    { flex: 1 },
  name:         { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  room:         { fontSize: 11, color: C.sec, marginTop: 1, fontFamily: "Inter_400Regular" },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 8 },
  statePill:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  stateDot:     { width: 5, height: 5, borderRadius: 99 },
  stateText:    { fontSize: 10, fontWeight: "800" as const, letterSpacing: 0.5, fontFamily: "Inter_700Bold" },
  badgeRow:     { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 10, alignItems: "center" },
  badge:        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: C.b0, backgroundColor: C.bg },
  badgeText:    { fontSize: 9, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  lastSeen:     { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", marginLeft: 2 },
  sliderRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sliderTrack:  { flex: 1, height: 6, backgroundColor: C.bg, borderRadius: 99, overflow: "visible", position: "relative" },
  sliderFill:   { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99 },
  sliderThumb:  { position: "absolute", top: -5, width: 16, height: 16, borderRadius: 99, borderWidth: 2, borderColor: C.bg, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 3 },
  brtValue:     { fontSize: 11, fontWeight: "700" as const, minWidth: 34, textAlign: "right", fontFamily: "Inter_700Bold" },
  powerBtn:     { borderRadius: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  powerBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" as const, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Inter_700Bold" },
  actionRow:    { flexDirection: "row", gap: 8, marginBottom: 10 },
  actionBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 12, backgroundColor: C.b1, borderWidth: 1, borderColor: C.b0 },
  actionText:   { fontSize: 11, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  footer:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText:   { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
});
