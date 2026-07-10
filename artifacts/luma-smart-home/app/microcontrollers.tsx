import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { timeAgo } from "@/data/luma-data";

export default function MicrocontrollersScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { microcontrollers, mcDevices } = useLuma();
  const [search, setSearch] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);

  const filtered = microcontrollers.filter(mc =>
    search === "" ||
    mc.name.toLowerCase().includes(search.toLowerCase()) ||
    mc.room.toLowerCase().includes(search.toLowerCase()) ||
    mc.model.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = microcontrollers.filter(m => m.online).length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Microcontrollers</Text>
          <Text style={styles.sub}>{onlineCount}/{microcontrollers.length} online</Text>
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, searchVisible && { backgroundColor: C.accent + "22", borderColor: C.accent + "40" }]}
          onPress={() => { setSearchVisible(v => !v); setSearch(""); }}
        >
          <Feather name={searchVisible ? "x" : "search"} size={18} color={searchVisible ? C.accentL : C.sec} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => router.push("/microcontroller-register" as any)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.registerBtnText}>Register</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {searchVisible && (
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={15} color={C.mute} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, room, model…"
              placeholderTextColor={C.mute}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary row */}
        <View style={styles.summaryRow}>
          <SummaryChip icon="cpu" label="Total" value={microcontrollers.length.toString()} color={C.accentL} />
          <SummaryChip icon="wifi" label="Online" value={onlineCount.toString()} color={C.on} />
          <SummaryChip icon="wifi-off" label="Offline" value={(microcontrollers.length - onlineCount).toString()} color={C.off} />
          <SummaryChip icon="zap" label="Devices" value={mcDevices.length.toString()} color={C.gold} />
        </View>

        <Text style={styles.sectionLabel}>Registered Microcontrollers</Text>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="cpu" size={32} color={C.mute2} />
            <Text style={styles.emptyText}>
              {search ? "No results found" : "No microcontrollers registered yet"}
            </Text>
            {!search && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/microcontroller-register" as any)}
              >
                <Text style={styles.emptyBtnText}>Register your first ESP32</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {filtered.map(mc => {
          const devices = mcDevices.filter(d => d.mcId === mc.id);
          return (
            <TouchableOpacity
              key={mc.id}
              style={[styles.card, mc.online && { borderColor: C.on + "30" }]}
              onPress={() => router.push(`/microcontroller-workspace?id=${mc.id}` as any)}
              activeOpacity={0.75}
            >
              {/* Card header */}
              <View style={styles.cardHeader}>
                <View style={[styles.mcIconBox, { backgroundColor: "#f97316" + "18", borderColor: "#f97316" + "30" }]}>
                  <Feather name="cpu" size={20} color="#f97316" />
                </View>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardName}>{mc.name}</Text>
                  <Text style={styles.cardRoom}>{mc.room} · {mc.model}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: mc.online ? C.on + "20" : C.off + "20", borderColor: mc.online ? C.on + "40" : C.off + "40" }]}>
                  <View style={[styles.statusDot, { backgroundColor: mc.online ? C.on : C.off }]} />
                  <Text style={[styles.statusText, { color: mc.online ? C.on : C.off }]}>
                    {mc.online ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <CardStat icon="package" label="Firmware" value={mc.firmware} />
                <CardStat icon="zap" label="Devices" value={devices.length.toString()} />
                <CardStat icon="clock" label="Last Seen" value={mc.online ? "Now" : timeAgo(mc.lastConnected)} />
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardMac}>{mc.mac}</Text>
                <Feather name="chevron-right" size={16} color={C.mute2} />
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function SummaryChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.chip, { borderColor: color + "25", backgroundColor: color + "10" }]}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function CardStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.cardStat}>
      <Feather name={icon as any} size={12} color={C.mute} />
      <Text style={styles.cardStatLabel}>{label}</Text>
      <Text style={styles.cardStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1 },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  registerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f97316", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  registerBtnText: { fontSize: 13, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.elevated, borderRadius: 12, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  chip: { flex: 1, alignItems: "center", gap: 2, borderRadius: 12, borderWidth: 1, paddingVertical: 10 },
  chipValue: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  chipLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontFamily: "Inter_600SemiBold" },
  card: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, marginBottom: 12, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  mcIconBox: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cardTitleBlock: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  cardRoom: { fontSize: 11, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", gap: 0, borderTopWidth: 1, borderTopColor: C.b0, paddingTop: 12 },
  cardStat: { flex: 1, alignItems: "center", gap: 3 },
  cardStatLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
  cardStatValue: { fontSize: 12, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardMac: { fontSize: 10, color: C.mute2, fontFamily: "Inter_400Regular", letterSpacing: 0.5 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 12 },
  emptyText: { fontSize: 14, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBtn: { backgroundColor: "#f97316", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { fontSize: 13, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
});
