import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";

const LAMP_COLOR = "#FBBF24";

export default function LampsManagerScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lamps, updateLamp, deleteLamp } = useLuma();
  const [search, setSearch] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const filtered = lamps.filter(l => {
    const matchSearch = search === "" ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.room.toLowerCase().includes(search.toLowerCase()) ||
      l.deviceId.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "online" ? l.online : !l.online);
    return matchSearch && matchFilter;
  });

  const totalOnline = lamps.filter(l => l.online).length;
  const totalOn = lamps.filter(l => l.on).length;

  function confirmDelete(id: string, name: string) {
    Alert.alert(
      "Remove Lamp",
      `Remove "${name}" from your home?\n\nThis cannot be undone.`,
      [
        { text: "Cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteLamp(id) },
      ]
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Lamp Manager</Text>
          <Text style={styles.sub}>{lamps.length} lamp{lamps.length !== 1 ? "s" : ""} registered</Text>
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, searchVisible && { backgroundColor: LAMP_COLOR + "20", borderColor: LAMP_COLOR + "40" }]}
          onPress={() => { setSearchVisible(v => !v); setSearch(""); }}
        >
          <Feather name={searchVisible ? "x" : "search"} size={18} color={searchVisible ? LAMP_COLOR : C.sec} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/lamp-add" as any)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#000" />
          <Text style={styles.addBtnText}>Add Lamp</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      {searchVisible && (
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={15} color={C.mute} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, room, device ID…"
              placeholderTextColor={C.mute}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatChip icon="zap" label="Total" value={lamps.length.toString()} color={LAMP_COLOR} />
          <StatChip icon="wifi" label="Online" value={totalOnline.toString()} color={C.on} />
          <StatChip icon="sun" label="On" value={totalOn.toString()} color={C.accentL} />
          <StatChip icon="wifi-off" label="Offline" value={(lamps.length - totalOnline).toString()} color={C.off} />
        </View>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {(["all", "online", "offline"] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && { backgroundColor: LAMP_COLOR + "20", borderColor: LAMP_COLOR + "50" }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && { color: LAMP_COLOR, fontFamily: "Inter_700Bold" }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          {filter === "all" ? "All Lamps" : filter === "online" ? "Online Lamps" : "Offline Lamps"}
        </Text>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="zap" size={34} color={C.mute2} />
            <Text style={styles.emptyTitle}>
              {lamps.length === 0 ? "No lamps yet" : "No results"}
            </Text>
            <Text style={styles.emptyDesc}>
              {lamps.length === 0
                ? "Add your first smart lamp to get started"
                : "Try adjusting your search or filter"}
            </Text>
            {lamps.length === 0 && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/lamp-add" as any)}>
                <Feather name="plus" size={15} color="#000" />
                <Text style={styles.emptyBtnText}>Add Your First Lamp</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {filtered.map(lamp => (
          <TouchableOpacity
            key={lamp.id}
            style={[styles.card, lamp.on && lamp.online && { borderColor: LAMP_COLOR + "35" }]}
            onPress={() => router.push(`/device/${lamp.id}` as any)}
            activeOpacity={0.78}
          >
            {/* Card top row */}
            <View style={styles.cardTop}>
              {/* Icon */}
              <View style={[
                styles.lampIcon,
                { backgroundColor: (lamp.on && lamp.online ? LAMP_COLOR : C.mute2) + "18", borderColor: (lamp.on && lamp.online ? LAMP_COLOR : C.mute2) + "35" }
              ]}>
                <Feather name="zap" size={20} color={lamp.on && lamp.online ? LAMP_COLOR : C.mute2} />
              </View>

              {/* Name + room */}
              <View style={styles.cardMeta}>
                <Text style={styles.cardName}>{lamp.name}</Text>
                <Text style={styles.cardRoom}>{lamp.room} · {lamp.floor}</Text>
              </View>

              {/* Toggle */}
              <Switch
                value={lamp.on && lamp.online}
                disabled={!lamp.online}
                onValueChange={() => updateLamp(lamp.id, { on: !lamp.on, lastCommand: lamp.on ? "off" : "on", lastUpdate: Date.now() })}
                trackColor={{ false: C.mute2, true: LAMP_COLOR + "80" }}
                thumbColor={lamp.on && lamp.online ? LAMP_COLOR : C.sec}
              />
            </View>

            {/* Status row */}
            <View style={styles.cardStats}>
              <View style={[styles.statusPill, { backgroundColor: lamp.online ? C.on + "18" : C.off + "18", borderColor: lamp.online ? C.on + "40" : C.off + "35" }]}>
                <View style={[styles.statusDot, { backgroundColor: lamp.online ? C.on : C.off }]} />
                <Text style={[styles.statusText, { color: lamp.online ? C.on : C.off }]}>
                  {lamp.online ? "Online" : "Offline"}
                </Text>
              </View>
              <Text style={styles.cardBrightness}>{lamp.brightness}% · {lamp.colorTemp}K</Text>
              <View style={[styles.colorSwatch, { backgroundColor: lamp.rgb }]} />
            </View>

            {/* Bottom: device ID + delete */}
            <View style={styles.cardFooter}>
              <Text style={styles.cardDeviceId}>{lamp.deviceId}</Text>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDelete(lamp.id, lamp.name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="trash-2" size={14} color={C.off} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

function StatChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.statChip, { borderColor: color + "28", backgroundColor: color + "10" }]}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1 },
  title: { fontSize: 19, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: LAMP_COLOR, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: "700" as const, color: "#000", fontFamily: "Inter_700Bold" },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.elevated, borderRadius: 12, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  content: { padding: 16 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statChip: { flex: 1, alignItems: "center", gap: 2, borderRadius: 12, borderWidth: 1, paddingVertical: 10 },
  statValue: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterChip: { flex: 1, paddingVertical: 7, borderRadius: 9, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  filterChipText: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12, fontFamily: "Inter_600SemiBold" },
  card: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 10, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  lampIcon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  cardRoom: { fontSize: 11, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  cardStats: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: C.b0, paddingTop: 10 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  cardBrightness: { flex: 1, fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  colorSwatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "#ffffff20" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.b0, paddingTop: 10 },
  cardDeviceId: { fontSize: 10, color: C.mute2, fontFamily: "Inter_400Regular", letterSpacing: 0.4 },
  deleteBtn: { padding: 4 },
  empty: { alignItems: "center", paddingVertical: 56, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 13, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 30 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: LAMP_COLOR, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, marginTop: 10 },
  emptyBtnText: { fontSize: 13, fontWeight: "700" as const, color: "#000", fontFamily: "Inter_700Bold" },
});
