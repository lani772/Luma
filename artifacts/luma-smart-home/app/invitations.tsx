import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { CloudAPI, type CloudInvitation } from "@/services/cloud-api";

type TabId = "received" | "sent";

const PERMISSION_ICONS: Record<string, string> = {
  view:    "eye",
  control: "sliders",
  admin:   "shield",
  manage:  "settings",
  full:    "star",
};

function InviteCard({
  invite, isSent, onAccept, onDecline, onCancel, loading,
}: {
  invite: CloudInvitation;
  isSent: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  loading?: boolean;
}) {
  const expired = new Date(invite.expiresAt) < new Date();
  const isPending = invite.status === "pending";
  const statusColor = {
    pending:  C.gold,
    accepted: C.on,
    declined: C.off,
    expired:  C.mute,
  }[invite.status] ?? C.mute;

  return (
    <View style={inv.card}>
      {/* Header row */}
      <View style={inv.header}>
        <View style={inv.deviceIcon}>
          <Feather name="cpu" size={18} color={C.accentL} />
        </View>
        <View style={inv.headerText}>
          <Text style={inv.deviceName}>{invite.deviceName}</Text>
          <Text style={inv.meta}>
            {isSent
              ? `To: ${invite.toEmail ?? invite.toUsername ?? "Unknown"}`
              : `From: ${invite.fromUserName}`}
          </Text>
        </View>
        <View style={[inv.statusPill, { backgroundColor: statusColor + "18", borderColor: statusColor + "40" }]}>
          <Text style={[inv.statusTxt, { color: statusColor }]}>
            {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Permissions */}
      {invite.permissions.length > 0 && (
        <View style={inv.permsRow}>
          {invite.permissions.slice(0, 4).map(p => (
            <View key={p} style={inv.permChip}>
              <Feather name={(PERMISSION_ICONS[p] ?? "check") as any} size={11} color={C.accentL} />
              <Text style={inv.permTxt}>{p}</Text>
            </View>
          ))}
          {invite.permissions.length > 4 && (
            <View style={inv.permChip}>
              <Text style={inv.permTxt}>+{invite.permissions.length - 4}</Text>
            </View>
          )}
        </View>
      )}

      {/* Message */}
      {invite.message ? (
        <Text style={inv.message}>"{invite.message}"</Text>
      ) : null}

      {/* Footer */}
      <View style={inv.footer}>
        <Text style={inv.expires}>
          {expired
            ? "Expired"
            : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={C.accentL} />
        ) : isPending ? (
          isSent ? (
            <TouchableOpacity style={inv.cancelBtn} onPress={onCancel}>
              <Text style={inv.cancelTxt}>Withdraw</Text>
            </TouchableOpacity>
          ) : (
            <View style={inv.actions}>
              <TouchableOpacity style={inv.declineBtn} onPress={onDecline}>
                <Text style={inv.declineTxt}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={inv.acceptBtn} onPress={onAccept}>
                <Text style={inv.acceptTxt}>Accept</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}
      </View>
    </View>
  );
}

const inv = StyleSheet.create({
  card:       { backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14, gap: 10 },
  header:     { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  deviceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.accent + "20", borderWidth: 1, borderColor: C.accent + "40", alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, gap: 2 },
  deviceName: { fontSize: 15, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  meta:       { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusTxt:  { fontSize: 11, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  permsRow:   { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  permChip:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.card2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.b0 },
  permTxt:    { fontSize: 11, color: C.sec, fontFamily: "Inter_500Medium" },
  message:    { fontSize: 13, color: C.sec, fontStyle: "italic" as const, fontFamily: "Inter_400Regular", lineHeight: 18 },
  footer:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  expires:    { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  actions:    { flexDirection: "row", gap: 8 },
  declineBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.b1 },
  declineTxt: { fontSize: 13, color: C.sec, fontFamily: "Inter_600SemiBold" },
  acceptBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: C.accent },
  acceptTxt:  { fontSize: 13, color: C.txt, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  cancelBtn:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.off + "40" },
  cancelTxt:  { fontSize: 13, color: C.off, fontFamily: "Inter_600SemiBold" },
});

export default function InvitationsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [tab, setTab]                   = useState<TabId>("received");
  const [received, setReceived]         = useState<CloudInvitation[]>([]);
  const [sent, setSent]                 = useState<CloudInvitation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [actionId, setActionId]         = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [r, s] = await Promise.allSettled([
      CloudAPI.getReceivedInvitations(),
      CloudAPI.getSentInvitations(),
    ]);
    if (r.status === "fulfilled") setReceived(r.value);
    if (s.status === "fulfilled") setSent(s.value);
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAll().catch(() => {});
    setRefreshing(false);
  }

  async function handleAccept(id: string) {
    setActionId(id);
    try {
      await CloudAPI.acceptInvitation(id);
      setReceived(prev => prev.map(i => i.id === id ? { ...i, status: "accepted" } : i));
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to accept invitation");
    } finally {
      setActionId(null);
    }
  }

  async function handleDecline(id: string) {
    setActionId(id);
    try {
      await CloudAPI.declineInvitation(id);
      setReceived(prev => prev.map(i => i.id === id ? { ...i, status: "declined" } : i));
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to decline invitation");
    } finally {
      setActionId(null);
    }
  }

  async function handleCancel(id: string) {
    setActionId(id);
    try {
      await CloudAPI.cancelInvitation(id);
      setSent(prev => prev.filter(i => i.id !== id));
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to withdraw invitation");
    } finally {
      setActionId(null);
    }
  }

  const pendingCount = received.filter(i => i.status === "pending").length;
  const list = tab === "received" ? received : sent;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Invitations</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["received", "sent"] as TabId[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
              {t === "received" ? "Received" : "Sent"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accentL} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.accentL} />
            <Text style={styles.centerTxt}>Loading invitations…</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="mail" size={44} color={C.b2} />
            <Text style={styles.emptyTitle}>
              {tab === "received" ? "No Invitations" : "No Sent Invitations"}
            </Text>
            <Text style={styles.emptySub}>
              {tab === "received"
                ? "When someone invites you to their smart home, it will appear here."
                : "Invitations you send to others will appear here."}
            </Text>
          </View>
        ) : (
          list.map(invite => (
            <InviteCard
              key={invite.id}
              invite={invite}
              isSent={tab === "sent"}
              loading={actionId === invite.id}
              onAccept={() => handleAccept(invite.id)}
              onDecline={() => handleDecline(invite.id)}
              onCancel={() => handleCancel(invite.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  topBar:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.b0, gap: 10 },
  backBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title:       { flex: 1, fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  badge:       { backgroundColor: C.accentL, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt:    { fontSize: 12, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
  tabRow:      { flexDirection: "row", marginHorizontal: 18, marginVertical: 14, backgroundColor: C.elevated, borderRadius: 12, borderWidth: 1, borderColor: C.b0, padding: 3 },
  tab:         { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 9 },
  tabActive:   { backgroundColor: C.accent },
  tabTxt:      { fontSize: 13, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  tabTxtActive:{ color: C.txt },
  content:     { paddingHorizontal: 18, gap: 12, paddingTop: 4 },
  center:      { alignItems: "center", paddingTop: 60, gap: 12 },
  centerTxt:   { fontSize: 14, color: C.sec, fontFamily: "Inter_400Regular" },
  empty:       { alignItems: "center", paddingTop: 64, gap: 12, paddingHorizontal: 24 },
  emptyTitle:  { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  emptySub:    { fontSize: 13, color: C.sec, textAlign: "center", lineHeight: 20, fontFamily: "Inter_400Regular" },
});
