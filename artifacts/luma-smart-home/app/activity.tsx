import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { ACTIVITY_LOG, timeAgo } from "@/data/luma-data";

const TYPE_FILTER = ["all", "device", "scene", "schedule", "login"] as const;
const TYPE_COLORS: Record<string, string> = { device: C.gold, scene: C.purple, schedule: C.accentL, login: C.teal, firmware: C.on, automation: C.rose };
const TYPE_ICONS: Record<string, string> = { device: "zap", scene: "sun", schedule: "clock", login: "log-in", firmware: "refresh-cw", automation: "cpu" };

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [query, setQuery] = useState("");
  const [typeF, setTypeF] = useState<string>("all");

  const shown = useMemo(() => {
    return ACTIVITY_LOG.filter(a => {
      const mQ = !query || a.action.toLowerCase().includes(query.toLowerCase()) || a.user.toLowerCase().includes(query.toLowerCase());
      const mT = typeF === "all" || a.type === typeF;
      return mQ && mT;
    });
  }, [query, typeF]);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Activity Log</Text>
        <TouchableOpacity style={styles.exportBtn}>
          <Feather name="download" size={15} color={C.teal} />
          <Text style={styles.exportText}>CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Feather name="search" size={15} color={C.mute} />
        <TextInput style={styles.searchInput} placeholder="Search actions or users..." placeholderTextColor={C.mute} value={query} onChangeText={setQuery} />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Feather name="x" size={15} color={C.mute} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {TYPE_FILTER.map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTypeF(t)}
            style={[styles.pill, typeF === t && { backgroundColor: (TYPE_COLORS[t] || C.accentL) + "20", borderColor: (TYPE_COLORS[t] || C.accentL) + "50" }]}
          >
            <Text style={[styles.pillText, typeF === t && { color: TYPE_COLORS[t] || C.accentL }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {shown.length === 0 && (
          <View style={styles.empty}>
            <Feather name="list" size={36} color={C.mute} />
            <Text style={styles.emptyTitle}>No activity found</Text>
            <Text style={styles.emptySub}>Try adjusting your search or filter</Text>
          </View>
        )}
        {shown.map(a => {
          const cl = TYPE_COLORS[a.type] || C.sec;
          const ic = TYPE_ICONS[a.type] || "activity";
          return (
            <View key={a.id} style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: cl + "18", borderColor: cl + "28" }]}>
                <Feather name={ic as any} size={14} color={cl} />
              </View>
              <View style={styles.activityText}>
                <Text style={styles.activityAction}>{a.action}</Text>
                <Text style={styles.activityUser}>{a.user}</Text>
              </View>
              <Text style={styles.activityTime}>{timeAgo(a.time)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.teal + "18", borderRadius: 8, borderWidth: 1, borderColor: C.teal + "30" },
  exportText: { fontSize: 11, color: C.teal, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: C.surface, borderRadius: 13, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  filterScroll: { maxHeight: 40, borderBottomWidth: 1, borderBottomColor: C.b0 },
  filterContent: { paddingHorizontal: 16, gap: 7, alignItems: "center" },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: C.b0, backgroundColor: C.surface },
  pillText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.b0 },
  activityIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  activityText: { flex: 1 },
  activityAction: { fontSize: 13, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  activityUser: { fontSize: 10, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  activityTime: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
});
