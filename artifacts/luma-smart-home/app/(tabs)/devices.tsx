import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import DeviceCard from "@/components/DeviceCard";
import { ROOMS } from "@/data/luma-data";

type FilterType = "all" | "on" | "off" | "offline";

export default function DevicesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lamps, updateLamp } = useLuma();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [roomFilter, setRoomFilter] = useState("all");

  const filtered = useMemo(() => {
    return lamps.filter(l => {
      const q = !query || l.name.toLowerCase().includes(query.toLowerCase()) || l.room.toLowerCase().includes(query.toLowerCase());
      const f = filter === "all" ? true : filter === "on" ? l.on : filter === "off" ? (!l.on && l.online) : !l.online;
      const r = roomFilter === "all" ? true : l.room === roomFilter;
      return q && f && r;
    });
  }, [lamps, query, filter, roomFilter]);

  const rooms = useMemo(() => {
    const unique = [...new Set(lamps.map(l => l.room))];
    return unique;
  }, [lamps]);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Devices</Text>
          <Text style={styles.sub}>{filtered.length} of {lamps.length} shown</Text>
        </View>
        <View style={[styles.badge, lamps.filter(l => l.on).length > 0 && { borderColor: C.on + "40", backgroundColor: C.on + "12" }]}>
          <Text style={[styles.badgeText, { color: C.on }]}>{lamps.filter(l => l.on).length} ON</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Feather name="search" size={15} color={C.mute} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search devices..."
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

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {(["all", "on", "off", "offline"] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.pill, filter === f && { backgroundColor: C.accent + "20", borderColor: C.accentL + "50" }]}
          >
            <Text style={[styles.pillText, filter === f && { color: C.accentL }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.separator} />
        <TouchableOpacity
          onPress={() => setRoomFilter("all")}
          style={[styles.pill, roomFilter === "all" && { backgroundColor: C.purple + "20", borderColor: C.purple + "50" }]}
        >
          <Text style={[styles.pillText, roomFilter === "all" && { color: "#c4b5fd" }]}>All Rooms</Text>
        </TouchableOpacity>
        {rooms.map(r => (
          <TouchableOpacity
            key={r}
            onPress={() => setRoomFilter(r)}
            style={[styles.pill, roomFilter === r && { backgroundColor: C.purple + "20", borderColor: C.purple + "50" }]}
          >
            <Text style={[styles.pillText, roomFilter === r && { color: "#c4b5fd" }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="zap-off" size={40} color={C.mute} />
            <Text style={styles.emptyTitle}>No devices found</Text>
            <Text style={styles.emptySub}>Try adjusting your filters</Text>
          </View>
        ) : (
          filtered.map(lamp => (
            <DeviceCard key={lamp.id} lamp={lamp} onUpdate={updateLamp} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  title: { fontSize: 24, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, color: C.mute, marginTop: 2, fontFamily: "Inter_400Regular" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 18, marginTop: 12, marginBottom: 8, backgroundColor: C.surface, borderRadius: 13, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  filterScroll: { maxHeight: 40 },
  filterContent: { paddingHorizontal: 18, gap: 8, alignItems: "center" },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: C.b0, backgroundColor: C.surface },
  pillText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  separator: { width: 1, height: 16, backgroundColor: C.b0, marginHorizontal: 2 },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, color: C.mute, fontFamily: "Inter_400Regular" },
});
