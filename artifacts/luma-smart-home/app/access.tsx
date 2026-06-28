import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { DEVICE_PERMISSIONS } from "@/data/luma-data";

const TABS = ["requests", "permissions", "history"] as const;
type Tab = typeof TABS[number];

export default function AccessScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { pendingRequests, approvedRequests, approveRequest, rejectRequest } = useLuma();
  const [tab, setTab] = useState<Tab>("requests");

  function handleApprove(id: number) {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    approveRequest(id);
  }

  function handleReject(id: number) {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    rejectRequest(id);
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Access Control</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && { backgroundColor: C.elevated, borderColor: C.b0 }]}>
            <Text style={[styles.tabText, tab === t && { color: C.txt }]}>
              {t === "requests" ? "Requests" : t === "permissions" ? "Permissions" : "History"}
            </Text>
            {t === "requests" && pendingRequests.length > 0 && (
              <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{pendingRequests.length}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === "requests" && (
          <>
            {pendingRequests.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="check-circle" size={40} color={C.on} />
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptySub}>All access requests have been reviewed</Text>
              </View>
            ) : (
              pendingRequests.map(r => (
                <View key={r.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={[styles.avatar, { backgroundColor: r.color + "25", borderColor: r.color + "50" }]}>
                      <Text style={[styles.avatarText, { color: r.color }]}>{r.init}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestName}>{r.user}</Text>
                      <Text style={styles.requestDevices}>Requests: {r.req}</Text>
                    </View>
                    <Text style={styles.requestWhen}>{r.when}</Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(r.id)}>
                      <Feather name="check" size={14} color={C.on} />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(r.id)}>
                      <Feather name="x" size={14} color={C.off} />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {tab === "permissions" && (
          <>
            <Text style={styles.sectionLabel}>Device Access Control</Text>
            {DEVICE_PERMISSIONS.map(p => (
              <View key={p.lampId} style={styles.permCard}>
                <View style={styles.permHeader}>
                  <Feather name="zap" size={15} color={C.gold} />
                  <Text style={styles.permLamp}>{p.lamp}</Text>
                </View>
                <View style={styles.tagRow}>
                  {p.allowed.map(r => (
                    <View key={r} style={styles.allowedTag}>
                      <Feather name="check" size={10} color={C.on} />
                      <Text style={styles.allowedText}>{r}</Text>
                    </View>
                  ))}
                  {p.denied.map(d => (
                    <View key={d} style={styles.deniedTag}>
                      <Feather name="x" size={10} color={C.off} />
                      <Text style={styles.deniedText}>{d}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.actionsRow}>
                  {p.actions.map(a => (
                    <View key={a} style={styles.actionTag}>
                      <Text style={styles.actionTagText}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {tab === "history" && (
          <>
            <Text style={styles.sectionLabel}>Approval History</Text>
            {approvedRequests.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="clock" size={36} color={C.mute} />
                <Text style={styles.emptyTitle}>No history yet</Text>
                <Text style={styles.emptySub}>Approved requests will appear here</Text>
              </View>
            ) : (
              approvedRequests.map((r, i) => (
                <View key={i} style={styles.historyRow}>
                  <View style={[styles.avatar, { backgroundColor: r.color + "25", borderColor: r.color + "50" }]}>
                    <Text style={[styles.avatarText, { color: r.color }]}>{r.init}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestName}>{r.user}</Text>
                    <Text style={styles.requestDevices}>{r.req}</Text>
                  </View>
                  <View style={[styles.approvedPill]}>
                    <Text style={styles.approvedText}>Approved</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 13, margin: 16, padding: 4, gap: 4, borderWidth: 1, borderColor: C.b0 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "transparent", flexDirection: "row", justifyContent: "center", gap: 5 },
  tabText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  tabBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.off, alignItems: "center", justifyContent: "center" },
  tabBadgeText: { fontSize: 9, color: "#fff", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular" },
  requestCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, marginBottom: 12, gap: 14 },
  requestHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 99, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  requestName: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  requestDevices: { fontSize: 11, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  requestWhen: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  requestActions: { flexDirection: "row", gap: 10 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: C.on + "14", borderWidth: 1, borderColor: C.on + "30" },
  approveBtnText: { fontSize: 13, fontWeight: "700" as const, color: C.on, fontFamily: "Inter_700Bold" },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: C.off + "14", borderWidth: 1, borderColor: C.off + "30" },
  rejectBtnText: { fontSize: 13, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  permCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 10, gap: 10 },
  permHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  permLamp: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  allowedTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.on + "12", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  allowedText: { fontSize: 10, color: C.on, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  deniedTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.off + "12", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  deniedText: { fontSize: 10, color: C.off, fontFamily: "Inter_600SemiBold" },
  actionsRow: { flexDirection: "row", gap: 6 },
  actionTag: { backgroundColor: C.elevated, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.b0 },
  actionTagText: { fontSize: 10, color: C.sec, fontFamily: "Inter_400Regular" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  approvedPill: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.on + "18", borderRadius: 6, borderWidth: 1, borderColor: C.on + "30" },
  approvedText: { fontSize: 10, color: C.on, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
});
