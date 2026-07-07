import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { LumaNotification } from "@/data/luma-data";

const CATS = ["all", "users", "offline", "schedule", "timer", "energy", "firmware", "security"];

const CAT_COLORS: Record<string, string> = {
  users: C.indigo, offline: C.off, schedule: C.accentL, timer: C.warn,
  energy: C.purple, firmware: C.teal, security: C.rose,
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { notifications, markAllNotifRead, archiveNotif, markNotifRead } = useLuma();
  const [cat, setCat] = useState("all");

  const visible = notifications.filter(n => !n.archived && (cat === "all" || n.cat === cat));
  const unread = notifications.filter(n => !n.read && !n.archived).length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllNotifRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cat filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {CATS.map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => setCat(c)}
            style={[styles.catPill, cat === c && { backgroundColor: (CAT_COLORS[c] || C.accentL) + "20", borderColor: (CAT_COLORS[c] || C.accentL) + "50" }]}
          >
            <Text style={[styles.catText, cat === c && { color: CAT_COLORS[c] || C.accentL }]}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {visible.length === 0 && (
          <View style={styles.empty}>
            <Feather name="bell-off" size={40} color={C.mute} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySub}>You're all caught up</Text>
          </View>
        )}
        {visible.map(n => {
          const ac = CAT_COLORS[n.cat] || C.sec;
          return (
            <TouchableOpacity
              key={n.id}
              onPress={() => markNotifRead(n.id)}
              activeOpacity={0.8}
              style={[styles.notifRow, !n.read && { backgroundColor: C.elevated + "cc" }]}
            >
              <View style={[styles.notifIcon, { backgroundColor: ac + "18", borderColor: ac + "30" }]}>
                <Feather name={(n.icon as any) || "bell"} size={14} color={ac} />
              </View>
              <View style={styles.notifContent}>
                <Text style={[styles.notifTitle, !n.read && { color: C.txt }]}>{n.title}</Text>
                <Text style={styles.notifTime}>{n.time}</Text>
              </View>
              <View style={styles.notifRight}>
                {!n.read && <View style={[styles.unreadDot, { backgroundColor: ac }]} />}
                <TouchableOpacity onPress={() => archiveNotif(n.id)} style={styles.archiveBtn}>
                  <Feather name="x" size={13} color={C.mute} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.accentL + "18", borderRadius: 8, borderWidth: 1, borderColor: C.accentL + "30" },
  markAllText: { fontSize: 11, color: C.accentL, fontWeight: "700" as const, fontFamily: "Inter_600SemiBold" },
  filterScroll: { maxHeight: 42, borderBottomWidth: 1, borderBottomColor: C.b0 },
  filterContent: { paddingHorizontal: 16, gap: 7, alignItems: "center" },
  catPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: C.b0, backgroundColor: C.surface },
  catText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular" },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.b0 },
  notifIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 13, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  notifTime: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 2 },
  notifRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  unreadDot: { width: 7, height: 7, borderRadius: 99 },
  archiveBtn: { width: 26, height: 26, borderRadius: 99, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center" },
});
