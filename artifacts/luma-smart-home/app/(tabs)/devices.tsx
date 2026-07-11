import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import UnifiedDeviceCard from "@/components/UnifiedDeviceCard";

type DeviceKind    = "all" | "gpio" | "mqtt";
type StatusFilter  = "all" | "on"  | "off" | "offline";

const KIND_OPTIONS: { key: DeviceKind; label: string; icon: string }[] = [
  { key: "all",  label: "All",  icon: "layers"  },
  { key: "gpio", label: "GPIO", icon: "sliders" },
  { key: "mqtt", label: "MQTT", icon: "wifi"    },
];
const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all",     label: "All"     },
  { key: "on",      label: "On"      },
  { key: "off",     label: "Off"     },
  { key: "offline", label: "Offline" },
];

export default function DevicesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { lamps, mcDevices, microcontrollers, updateLamp, toggleMCDevice } = useLuma();

  const [query,        setQuery]        = useState("");
  const [kindFilter,   setKindFilter]   = useState<DeviceKind>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roomFilter,   setRoomFilter]   = useState("all");
  const [mcFilter,     setMcFilter]     = useState("all");

  // Combined unique rooms
  const rooms = useMemo(() => {
    const r = [...new Set([...lamps.map(l => l.room), ...mcDevices.map(d => d.room)])];
    return r.sort();
  }, [lamps, mcDevices]);

  // GPIO devices enriched with parent MC reference
  const gpioItems = useMemo(() =>
    mcDevices.map(d => ({ device: d, mc: microcontrollers.find(m => m.id === d.mcId) })),
    [mcDevices, microcontrollers]
  );

  const filteredGPIO = useMemo(() => {
    if (kindFilter === "mqtt") return [];
    return gpioItems.filter(({ device: d, mc }) => {
      const online = mc?.online ?? false;
      const q = !query
        || d.name.toLowerCase().includes(query.toLowerCase())
        || d.room.toLowerCase().includes(query.toLowerCase())
        || (d.mcName ?? "").toLowerCase().includes(query.toLowerCase());
      const s = statusFilter === "all" ? true
        : statusFilter === "on"      ? d.on
        : statusFilter === "off"     ? (!d.on && online)
        : !online;
      const r = roomFilter === "all" || d.room === roomFilter;
      const m = mcFilter   === "all" || d.mcId === mcFilter;
      return q && s && r && m;
    });
  }, [gpioItems, kindFilter, query, statusFilter, roomFilter, mcFilter]);

  const filteredMQTT = useMemo(() => {
    if (kindFilter === "gpio") return [];
    return lamps.filter(l => {
      const q = !query
        || l.name.toLowerCase().includes(query.toLowerCase())
        || l.room.toLowerCase().includes(query.toLowerCase());
      const s = statusFilter === "all" ? true
        : statusFilter === "on"      ? l.on
        : statusFilter === "off"     ? (!l.on && l.online)
        : !l.online;
      const r = roomFilter === "all" || l.room === roomFilter;
      return q && s && r;
    });
  }, [lamps, kindFilter, query, statusFilter, roomFilter]);

  const totalShown   = filteredGPIO.length + filteredMQTT.length;
  const totalDevices = mcDevices.length + lamps.length;
  const totalOn      = mcDevices.filter(d => d.on).length + lamps.filter(l => l.on).length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Devices</Text>
          <Text style={styles.sub}>{totalShown} of {totalDevices} shown</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.onBadge, totalOn > 0 && { borderColor: C.on + "40", backgroundColor: C.on + "12" }]}>
            <Text style={[styles.onBadgeText, { color: C.on }]}>{totalOn} ON</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/device-register" as any)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={15} color="#000" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search ─────────────────────────────────────────────────── */}
      <View style={styles.searchBar}>
        <Feather name="search" size={15} color={C.mute} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search devices, rooms, controllers…"
          placeholderTextColor={C.mute}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Feather name="x" size={15} color={C.mute} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Kind selector ──────────────────────────────────────────── */}
      <View style={styles.kindRow}>
        {KIND_OPTIONS.map(({ key, label, icon }) => {
          const active = kindFilter === key;
          const accent = key === "gpio" ? "#f97316" : C.accentL;
          const count  = key === "gpio" ? mcDevices.length : key === "mqtt" ? lamps.length : totalDevices;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.kindPill, active && { backgroundColor: accent + "18", borderColor: accent + "45" }]}
              onPress={() => setKindFilter(key)}
            >
              <Feather name={icon as any} size={12} color={active ? accent : C.mute} />
              <Text style={[styles.kindText, active && { color: accent, fontFamily: "Inter_700Bold" }]}>{label}</Text>
              <View style={[styles.kindBadge, { backgroundColor: (active ? accent : C.mute) + "20" }]}>
                <Text style={[styles.kindBadgeText, { color: active ? accent : C.mute }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Secondary filters (scrollable) ─────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {/* Status */}
        {STATUS_OPTIONS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setStatusFilter(key)}
            style={[styles.pill, statusFilter === key && { backgroundColor: C.accent + "20", borderColor: C.accentL + "50" }]}
          >
            <Text style={[styles.pillText, statusFilter === key && { color: C.accentL }]}>{label}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.sep} />

        {/* Rooms */}
        <TouchableOpacity
          style={[styles.pill, roomFilter === "all" && { backgroundColor: C.purple + "20", borderColor: C.purple + "50" }]}
          onPress={() => setRoomFilter("all")}
        >
          <Text style={[styles.pillText, roomFilter === "all" && { color: "#c4b5fd" }]}>All Rooms</Text>
        </TouchableOpacity>
        {rooms.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.pill, roomFilter === r && { backgroundColor: C.purple + "20", borderColor: C.purple + "50" }]}
            onPress={() => setRoomFilter(r)}
          >
            <Text style={[styles.pillText, roomFilter === r && { color: "#c4b5fd" }]}>{r}</Text>
          </TouchableOpacity>
        ))}

        {/* MC filter (GPIO / All only) */}
        {kindFilter !== "mqtt" && microcontrollers.length > 0 && (
          <>
            <View style={styles.sep} />
            <TouchableOpacity
              style={[styles.pill, mcFilter === "all" && { backgroundColor: "#f97316" + "20", borderColor: "#f97316" + "50" }]}
              onPress={() => setMcFilter("all")}
            >
              <Text style={[styles.pillText, mcFilter === "all" && { color: "#f97316" }]}>All MCs</Text>
            </TouchableOpacity>
            {microcontrollers.map(mc => (
              <TouchableOpacity
                key={mc.id}
                style={[styles.pill, mcFilter === mc.id && { backgroundColor: "#f97316" + "20", borderColor: "#f97316" + "50" }]}
                onPress={() => setMcFilter(mc.id)}
              >
                <View style={[styles.onlineDot, { backgroundColor: mc.online ? C.on : C.off }]} />
                <Text style={[styles.pillText, mcFilter === mc.id && { color: "#f97316" }]}>{mc.name}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── Device list ────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* GPIO Devices */}
        {filteredGPIO.length > 0 && (
          <>
            {kindFilter === "all" && (
              <View style={styles.sectionLabel}>
                <Feather name="sliders" size={11} color="#f97316" />
                <Text style={[styles.sectionLabelText, { color: "#f97316" }]}>
                  GPIO DEVICES ({filteredGPIO.length})
                </Text>
              </View>
            )}
            {filteredGPIO.map(({ device, mc }) => (
              <UnifiedDeviceCard
                key={device.id}
                mode="gpio"
                device={device}
                mc={mc}
                onToggle={() => toggleMCDevice(device.id)}
              />
            ))}
          </>
        )}

        {/* MQTT Lamps */}
        {filteredMQTT.length > 0 && (
          <>
            {kindFilter === "all" && (
              <View style={styles.sectionLabel}>
                <Feather name="wifi" size={11} color={C.accentL} />
                <Text style={styles.sectionLabelText}>MQTT LAMPS ({filteredMQTT.length})</Text>
              </View>
            )}
            {filteredMQTT.map(lamp => (
              <UnifiedDeviceCard
                key={lamp.id}
                mode="mqtt"
                lamp={lamp}
                onUpdate={updateLamp}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {totalShown === 0 && (
          <View style={styles.empty}>
            <Feather name="layers" size={40} color={C.mute} />
            <Text style={styles.emptyTitle}>No devices found</Text>
            <Text style={styles.emptySub}>
              {totalDevices === 0
                ? "Register your first GPIO device or add an MQTT lamp"
                : "Try adjusting filters"}
            </Text>
            {totalDevices === 0 && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/device-register" as any)}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.emptyBtnText}>Register Device</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  title:        { fontSize: 24, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub:          { fontSize: 11, color: C.mute, marginTop: 2, fontFamily: "Inter_400Regular" },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  onBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  onBadgeText:  { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  addBtn:       { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FBBF24", borderRadius: 9, paddingHorizontal: 11, paddingVertical: 6 },
  addBtnText:   { fontSize: 12, fontWeight: "700" as const, color: "#000", fontFamily: "Inter_700Bold" },

  // Search
  searchBar:    { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 18, marginTop: 12, marginBottom: 10, backgroundColor: C.surface, borderRadius: 13, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput:  { flex: 1, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },

  // Kind row
  kindRow:      { flexDirection: "row", gap: 8, paddingHorizontal: 18, marginBottom: 8 },
  kindPill:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 11, borderWidth: 1, borderColor: C.b0, backgroundColor: C.surface },
  kindText:     { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular" },
  kindBadge:    { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  kindBadgeText:{ fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },

  // Filters
  filterScroll:    { maxHeight: 38 },
  filterContent:   { paddingHorizontal: 18, gap: 7, alignItems: "center" },
  pill:            { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: C.b0, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", gap: 4 },
  pillText:        { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  sep:             { width: 1, height: 16, backgroundColor: C.b0, marginHorizontal: 2 },
  onlineDot:       { width: 6, height: 6, borderRadius: 3 },

  // List
  scroll:          { flex: 1 },
  content:         { padding: 18, paddingBottom: 20 },
  sectionLabel:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, marginTop: 6 },
  sectionLabelText:{ fontSize: 10, fontWeight: "700" as const, color: C.sec, letterSpacing: 1.4, fontFamily: "Inter_600SemiBold" },

  // Empty
  empty:           { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle:      { fontSize: 16, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptySub:        { fontSize: 13, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 30 },
  emptyBtn:        { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#f97316", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  emptyBtnText:    { fontSize: 13, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
});
