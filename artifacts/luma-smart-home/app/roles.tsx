import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import {
  ADMIN_PERMISSIONS_DEF,
  AdminDelegatedPermission,
  MC_ROLE_DEF,
  MCUserRole,
  OWNER_PERMISSIONS_DEF,
} from "@/data/luma-data";

const TABS = ["Hierarchy", "Owner", "Admins"] as const;
type Tab = typeof TABS[number];

const ROLE_ORDER: MCUserRole[] = ["owner", "device_admin", "full_access", "partial_access", "guest"];

export default function RolesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { mcUsers, toggleAdminPerm, revokeAdmin, promoteToAdmin } = useLuma();

  const [tab, setTab] = useState<Tab>("Hierarchy");
  const [expandedAdmin, setExpandedAdmin] = useState<number | null>(null);

  const owner = mcUsers.find(u => u.role === "owner" && u.mcId === "MC001");
  const admins = mcUsers.filter(u => u.role === "device_admin" && u.mcId === "MC001");
  const eligibleForAdmin = mcUsers.filter(u => u.role !== "owner" && u.role !== "device_admin" && u.mcId === "MC001");

  function handleTogglePerm(userId: number, perm: AdminDelegatedPermission) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleAdminPerm(userId, perm);
  }

  function handleRevokeAdmin(userId: number, name: string) {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    revokeAdmin(userId);
    if (expandedAdmin === userId) setExpandedAdmin(null);
  }

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Role Manager</Text>
          <Text style={s.subtitle}>MCU-centric permission model</Text>
        </View>
      </View>

      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[s.tabBtn, tab === t && { backgroundColor: C.elevated, borderColor: C.b0 }]}>
            <Text style={[s.tabText, tab === t && { color: C.txt }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── HIERARCHY TAB ── */}
        {tab === "Hierarchy" && (
          <>
            <Text style={s.sectionLabel}>Permission Scope Levels</Text>
            <View style={s.scopeCard}>
              {([
                { scope: "MCU Level", icon: "cpu", color: "#F59E0B", desc: "Firmware, factory reset, key generation, WiFi config. Owner-exclusive — no delegation." },
                { scope: "Device Level", icon: "zap", color: "#7C3AED", desc: "Per-device access assignment. Owner or authorized Device Admin grants per-user." },
                { scope: "Feature Level", icon: "sliders", color: "#06B6D4", desc: "Control / Scheduling / Timer / Automation / Monitoring. Granular per user per device." },
                { scope: "Time Level", icon: "clock", color: "#10B981", desc: "Permanent, temporary, scheduled window, or one-time use. Applies to all roles." },
              ] as const).map((item, i) => (
                <View key={item.scope} style={[s.scopeRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.b0 }]}>
                  <View style={[s.scopeIconBox, { backgroundColor: item.color + "18" }]}>
                    <Feather name={item.icon as "cpu"} size={16} color={item.color} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.scopeName, { color: item.color }]}>{i + 1}. {item.scope}</Text>
                    <Text style={s.scopeDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={s.sectionLabel}>Role Hierarchy</Text>
            {ROLE_ORDER.map(role => {
              const def = MC_ROLE_DEF[role];
              const count = mcUsers.filter(u => u.role === role && u.mcId === "MC001").length;
              const isOwner = role === "owner";
              return (
                <View key={role} style={[s.roleCard, { borderColor: def.color + "25" }]}>
                  <View style={s.roleHeader}>
                    <View style={[s.roleIcon, { backgroundColor: def.color + "18", borderColor: def.color + "30" }]}>
                      <Feather name={def.icon as "star"} size={18} color={def.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[s.roleName, { color: def.color }]}>{def.label}</Text>
                        <View style={[s.rankBadge, { backgroundColor: def.color + "20" }]}>
                          <Text style={[s.rankText, { color: def.color }]}>Rank {def.rank}</Text>
                        </View>
                        {isOwner && (
                          <View style={s.immutableBadge}>
                            <Feather name="lock" size={9} color={C.mute} />
                            <Text style={s.immutableText}>Immutable</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.roleDesc}>{def.desc}</Text>
                    </View>
                    <View style={[s.countPill, { backgroundColor: def.color + "15" }]}>
                      <Text style={[s.countText, { color: def.color }]}>{count}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── OWNER TAB ── */}
        {tab === "Owner" && (
          <>
            {owner && (
              <View style={[s.ownerCard]}>
                <View style={s.ownerRow}>
                  <View style={[s.avatar, { backgroundColor: "#F59E0B25", borderColor: "#F59E0B50" }]}>
                    <Text style={[s.avatarText, { color: "#F59E0B" }]}>{owner.avatarInit}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ownerName}>{owner.name}</Text>
                    <Text style={s.ownerEmail}>{owner.email}</Text>
                  </View>
                  <View style={s.ownerBadge}>
                    <Feather name="star" size={11} color="#F59E0B" />
                    <Text style={s.ownerBadgeText}>Owner</Text>
                  </View>
                </View>
                <View style={s.ownerNotice}>
                  <Feather name="info" size={13} color={C.mute} />
                  <Text style={s.ownerNoticeText}>Owner permissions are permanent and cannot be edited, delegated, or revoked.</Text>
                </View>
              </View>
            )}

            <Text style={s.sectionLabel}>Owner-Exclusive Permissions ({OWNER_PERMISSIONS_DEF.length})</Text>
            <View style={s.permsCard}>
              {OWNER_PERMISSIONS_DEF.map((p, i) => (
                <View key={p.key} style={[s.permRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.b0 }]}>
                  <View style={s.permIconBox}>
                    <Feather name={p.icon as "key"} size={14} color={"#F59E0B"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.permLabel}>{p.label}</Text>
                    <Text style={s.permDesc}>{p.desc}</Text>
                  </View>
                  <Feather name="lock" size={13} color={C.mute} />
                </View>
              ))}
            </View>

            <View style={s.transferCard}>
              <Feather name="alert-triangle" size={16} color={C.off} />
              <View style={{ flex: 1 }}>
                <Text style={s.transferTitle}>Transfer Ownership</Text>
                <Text style={s.transferDesc}>Permanently move all Owner permissions to another user. This action cannot be undone.</Text>
              </View>
              <TouchableOpacity style={s.transferBtn}>
                <Text style={s.transferBtnText}>Transfer</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── ADMINS TAB ── */}
        {tab === "Admins" && (
          <>
            <Text style={s.sectionLabel}>Device Admins ({admins.length})</Text>

            {admins.length === 0 && (
              <View style={s.empty}>
                <Feather name="shield" size={36} color={C.mute} />
                <Text style={s.emptyTitle}>No Device Admins</Text>
                <Text style={s.emptySub}>Promote a user below to delegate management tasks</Text>
              </View>
            )}

            {admins.map(admin => {
              const isExpanded = expandedAdmin === admin.id;
              return (
                <View key={admin.id} style={s.adminCard}>
                  <TouchableOpacity style={s.adminHeader} onPress={() => setExpandedAdmin(isExpanded ? null : admin.id)} activeOpacity={0.75}>
                    <View style={[s.avatar, { backgroundColor: "#7C3AED25", borderColor: "#7C3AED50" }]}>
                      <Text style={[s.avatarText, { color: "#7C3AED" }]}>{admin.avatarInit}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.adminName}>{admin.name}</Text>
                      <Text style={s.adminMeta}>{admin.adminDelegation.length} of {ADMIN_PERMISSIONS_DEF.length} permissions · {admin.deviceAccess.length} devices</Text>
                    </View>
                    <TouchableOpacity style={s.revokeBtn} onPress={() => handleRevokeAdmin(admin.id, admin.name)}>
                      <Text style={s.revokeBtnText}>Revoke</Text>
                    </TouchableOpacity>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={C.mute} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={s.delegationMatrix}>
                      <Text style={s.matrixHeader}>Delegated Permissions</Text>
                      {ADMIN_PERMISSIONS_DEF.map(p => {
                        const granted = admin.adminDelegation.includes(p.key);
                        return (
                          <TouchableOpacity
                            key={p.key}
                            style={s.matrixRow}
                            onPress={() => handleTogglePerm(admin.id, p.key)}
                            activeOpacity={0.7}>
                            <View style={[s.matrixIcon, { backgroundColor: granted ? "#7C3AED18" : C.elevated }]}>
                              <Feather name={p.icon as "key"} size={13} color={granted ? "#7C3AED" : C.mute} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.matrixLabel, { color: granted ? C.txt : C.sec }]}>{p.label}</Text>
                              <Text style={s.matrixDesc}>{p.desc}</Text>
                            </View>
                            <View style={[s.toggle, { backgroundColor: granted ? "#7C3AED" : C.elevated, borderColor: granted ? "#7C3AED" : C.b0 }]}>
                              {granted && <Feather name="check" size={11} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            {eligibleForAdmin.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 8 }]}>Eligible Users</Text>
                {eligibleForAdmin.map(u => {
                  const def = MC_ROLE_DEF[u.role];
                  return (
                    <View key={u.id} style={s.eligibleCard}>
                      <View style={[s.avatar, { backgroundColor: def.color + "20", borderColor: def.color + "40" }]}>
                        <Text style={[s.avatarText, { color: def.color }]}>{u.avatarInit}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.adminName}>{u.name}</Text>
                        <Text style={s.adminMeta}>{def.label} · {u.deviceAccess.length} devices</Text>
                      </View>
                      <TouchableOpacity
                        style={s.promoteBtn}
                        onPress={() => {
                          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          promoteToAdmin(u.id, ["invite_users", "approve_requests", "view_activity_logs"]);
                        }}>
                        <Feather name="shield" size={12} color="#7C3AED" />
                        <Text style={s.promoteBtnText}>Promote</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            <View style={s.scopeNotice}>
              <Feather name="info" size={13} color={C.mute} />
              <Text style={s.scopeNoticeText}>Device Admins cannot modify MCU-level settings (firmware, keys, reset). Those remain Owner-exclusive.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  tabRow: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 13, margin: 16, padding: 4, gap: 4, borderWidth: 1, borderColor: C.b0 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  tabText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },

  scopeCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 20, overflow: "hidden" },
  scopeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  scopeIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  scopeName: { fontSize: 13, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  scopeDesc: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },

  roleCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  roleHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  roleIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  roleName: { fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  roleDesc: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 2 },
  rankBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rankText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  immutableBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.elevated, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  immutableText: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
  countPill: { minWidth: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  countText: { fontSize: 13, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },

  avatar: { width: 44, height: 44, borderRadius: 99, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },

  ownerCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: "#F59E0B25", padding: 14, marginBottom: 16, gap: 12 },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ownerName: { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  ownerEmail: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  ownerBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F59E0B18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#F59E0B30" },
  ownerBadgeText: { fontSize: 11, fontWeight: "700" as const, color: "#F59E0B", fontFamily: "Inter_700Bold" },
  ownerNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.elevated, borderRadius: 10, padding: 10 },
  ownerNoticeText: { flex: 1, fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", lineHeight: 16 },

  permsCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 16, overflow: "hidden" },
  permRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  permIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: "#F59E0B15", alignItems: "center", justifyContent: "center" },
  permLabel: { fontSize: 13, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  permDesc: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },

  transferCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.off + "10", borderRadius: 14, borderWidth: 1, borderColor: C.off + "25", padding: 14 },
  transferTitle: { fontSize: 13, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },
  transferDesc: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 2 },
  transferBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.off + "18", borderRadius: 8, borderWidth: 1, borderColor: C.off + "30" },
  transferBtnText: { fontSize: 12, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center" },

  adminCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 10, overflow: "hidden" },
  adminHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  adminName: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  adminMeta: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.off + "14", borderRadius: 8, borderWidth: 1, borderColor: C.off + "25" },
  revokeBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },

  delegationMatrix: { borderTopWidth: 1, borderTopColor: C.b0, backgroundColor: C.bg + "88", padding: 12, gap: 4 },
  matrixHeader: { fontSize: 10, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "Inter_600SemiBold" },
  matrixRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderRadius: 10 },
  matrixIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  matrixLabel: { fontSize: 12, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  matrixDesc: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  toggle: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  eligibleCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 12, marginBottom: 8 },
  promoteBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#7C3AED15", borderRadius: 8, borderWidth: 1, borderColor: "#7C3AED30" },
  promoteBtnText: { fontSize: 11, fontWeight: "700" as const, color: "#7C3AED", fontFamily: "Inter_700Bold" },

  scopeNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.elevated, borderRadius: 12, padding: 12, marginTop: 8 },
  scopeNoticeText: { flex: 1, fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
