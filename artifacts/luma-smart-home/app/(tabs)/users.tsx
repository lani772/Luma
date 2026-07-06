import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, GRAD } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { LumaRole, LUMA_ROLES, PERMS_DEF, ROOMS, USER_ACTIVITY } from "@/data/luma-data";

const TABS = ["Members", "Permissions", "Activity", "Invites"] as const;
type TabT = typeof TABS[number];

const ROLE_KEYS = Object.keys(LUMA_ROLES) as LumaRole[];

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lumaUsers, invites, removeLumaUser, togglePermCell, toggleLampCell, sendInvite, cancelInvite, resendInvite } = useLuma();

  const [tab, setTab] = useState<TabT>("Members");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<LumaRole | "all">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<LumaRole>("member");

  const filtered = useMemo(() => {
    return lumaUsers.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [lumaUsers, search, roleFilter]);

  const stats = {
    total: lumaUsers.length,
    online: lumaUsers.filter(u => u.online).length,
    admins: lumaUsers.filter(u => u.role === "owner" || u.role === "admin").length,
    guests: lumaUsers.filter(u => u.role === "guest").length,
  };

  function handleRemove(id: number, name: string) {
    if (Platform.OS === "web") {
      removeLumaUser(id);
      return;
    }
    Alert.alert("Remove Member", `Remove ${name} from this home?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeLumaUser(id) },
    ]);
  }

  function handleSendInvite() {
    if (!inviteEmail.trim()) return;
    sendInvite(inviteEmail.trim(), inviteRole);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setInviteEmail(""); setInviteRole("member"); setInviteOpen(false);
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.sub}>{lumaUsers.length} member{lumaUsers.length !== 1 ? "s" : ""} · {invites.length} pending</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setInviteOpen(true)}>
          <LinearGradient colors={GRAD.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtnGrad}>
            <Feather name="user-plus" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Invite</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t && <LinearGradient colors={GRAD.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stat cards - always visible */}
        <View style={styles.statGrid}>
          <StatCard label="Total" value={stats.total} color={C.accentL} icon="users" />
          <StatCard label="Online" value={stats.online} color={C.on} icon="wifi" />
          <StatCard label="Admins" value={stats.admins} color={C.warn} icon="shield" />
          <StatCard label="Guests" value={stats.guests} color={C.sec} icon="link" />
        </View>

        {tab === "Members" && (
          <>
            <View style={styles.searchRow}>
              <Feather name="search" size={15} color={C.mute} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search members..."
                placeholderTextColor={C.mute}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8 }}>
              <RoleChip label="All" active={roleFilter === "all"} color={C.accentL} onPress={() => setRoleFilter("all")} />
              {ROLE_KEYS.map(r => (
                <RoleChip key={r} label={LUMA_ROLES[r].label} active={roleFilter === r} color={LUMA_ROLES[r].color} onPress={() => setRoleFilter(r)} />
              ))}
            </ScrollView>

            {filtered.map(u => {
              const rd = LUMA_ROLES[u.role];
              const expanded = expandedId === u.id;
              return (
                <View key={u.id} style={styles.userCard}>
                  <TouchableOpacity style={styles.userTop} onPress={() => setExpandedId(expanded ? null : u.id)} activeOpacity={0.8}>
                    <View style={styles.avatarWrap}>
                      <LinearGradient colors={GRAD.avatars[u.avatarIdx % GRAD.avatars.length] as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                        <Text style={styles.avatarText}>{u.avatarInit}</Text>
                      </LinearGradient>
                      {u.online && <View style={styles.onlineDot} />}
                    </View>
                    <View style={styles.userInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name}>{u.name}</Text>
                        <View style={[styles.rolePill, { backgroundColor: rd.bg, borderColor: rd.color + "50" }]}>
                          <Feather name={rd.icon as any} size={9} color={rd.color} />
                          <Text style={[styles.roleText, { color: rd.color }]}>{rd.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.email}>{u.email}</Text>
                      <Text style={styles.lastLogin}>{u.online ? "Active now" : `Seen ${u.seen}`} · Joined {u.joined}</Text>
                    </View>
                    <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={C.mute} />
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.expandedArea}>
                      <Text style={styles.expandedLabel}>Lamp Access</Text>
                      <View style={styles.chipsWrap}>
                        {ROOMS.map(room => {
                          const has = room.lampIds.some(lid => u.lampIds.includes(lid));
                          return (
                            <View key={room.id} style={[styles.miniChip, has ? { backgroundColor: C.accent + "1c", borderColor: C.accentL + "40" } : {}]}>
                              <Text style={[styles.miniChipText, has && { color: C.accentL }]}>{room.emoji} {room.name}</Text>
                            </View>
                          );
                        })}
                      </View>

                      <Text style={styles.expandedLabel}>Permissions</Text>
                      <View style={styles.chipsWrap}>
                        {PERMS_DEF.map(p => {
                          const has = u.perms[p.key];
                          return (
                            <View key={p.key} style={[styles.miniChip, has ? { backgroundColor: C.on + "1c", borderColor: C.on + "40" } : {}]}>
                              <Feather name={p.icon as any} size={10} color={has ? C.on : C.mute} />
                              <Text style={[styles.miniChipText, has && { color: C.on }]}>{p.label}</Text>
                            </View>
                          );
                        })}
                      </View>

                      <View style={styles.expandedActions}>
                        <Text style={styles.statMeta}>{u.acts} actions logged{u.exp ? ` · Expires ${u.exp}` : ""}</Text>
                        {u.role !== "owner" && (
                          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(u.id, u.name)}>
                            <Feather name="trash-2" size={13} color={C.off} />
                            <Text style={styles.removeBtnText}>Remove</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {tab === "Permissions" && (
          <>
            <Text style={styles.sectionLabel}>Permission Matrix</Text>
            <View style={styles.matrixCard}>
              <View style={styles.matrixHeaderRow}>
                <View style={styles.matrixNameCol} />
                {PERMS_DEF.map(p => (
                  <View key={p.key} style={styles.matrixHeadCell}>
                    <Feather name={p.icon as any} size={12} color={C.sec} />
                  </View>
                ))}
              </View>
              {lumaUsers.map(u => {
                const rd = LUMA_ROLES[u.role];
                return (
                  <View key={u.id} style={styles.matrixRow}>
                    <View style={styles.matrixNameCol}>
                      <View style={[styles.matrixDot, { backgroundColor: rd.color }]} />
                      <Text style={styles.matrixName} numberOfLines={1}>{u.name.split(" ")[0]}</Text>
                    </View>
                    {PERMS_DEF.map(p => {
                      const on = u.perms[p.key];
                      const locked = u.role === "owner";
                      return (
                        <TouchableOpacity
                          key={p.key}
                          style={styles.matrixHeadCell}
                          disabled={locked}
                          onPress={() => togglePermCell(u.id, p.key)}
                        >
                          <View style={[styles.matrixCheck, on && { backgroundColor: locked ? C.warn + "30" : C.on + "25", borderColor: locked ? C.warn : C.on }]}>
                            {on && <Feather name="check" size={11} color={locked ? C.warn : C.on} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Lamp Access Matrix</Text>
            <View style={styles.matrixCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.matrixHeaderRow}>
                    <View style={styles.matrixNameColWide} />
                    {ROOMS.map(r => (
                      <View key={r.id} style={styles.matrixHeadCellWide}>
                        <Text style={styles.roomEmoji}>{r.emoji}</Text>
                      </View>
                    ))}
                  </View>
                  {lumaUsers.map(u => {
                    const rd = LUMA_ROLES[u.role];
                    return (
                      <View key={u.id} style={styles.matrixRow}>
                        <View style={styles.matrixNameColWide}>
                          <View style={[styles.matrixDot, { backgroundColor: rd.color }]} />
                          <Text style={styles.matrixName} numberOfLines={1}>{u.name.split(" ")[0]}</Text>
                        </View>
                        {ROOMS.map(room => {
                          const lampId = room.lampIds[0];
                          const on = u.lampIds.includes(lampId);
                          const locked = u.role === "owner";
                          return (
                            <TouchableOpacity
                              key={room.id}
                              style={styles.matrixHeadCellWide}
                              disabled={locked}
                              onPress={() => toggleLampCell(u.id, lampId)}
                            >
                              <View style={[styles.matrixCheck, on && { backgroundColor: locked ? C.warn + "30" : C.accent + "25", borderColor: locked ? C.warn : C.accentL }]}>
                                {on && <Feather name="check" size={11} color={locked ? C.warn : C.accentL} />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </>
        )}

        {tab === "Activity" && (
          <>
            <Text style={styles.sectionLabel}>Recent Activity</Text>
            {USER_ACTIVITY.map((a, i) => {
              const user = lumaUsers.find(u => u.id === a.uid);
              return (
                <View key={i} style={styles.activityRow}>
                  <View style={[styles.activityIcon, { backgroundColor: a.color + "18" }]}>
                    <Feather name={a.icon as any} size={14} color={a.color} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityUser}>{user?.name ?? "Unknown"}</Text> {a.action} <Text style={styles.activityTarget}>{a.target}</Text>
                    </Text>
                    <Text style={styles.activityTime}>{a.time}</Text>
                  </View>
                </View>
              );
            })}

            <Text style={styles.sectionLabel}>Actions Per User</Text>
            <View style={styles.matrixCard}>
              {lumaUsers.slice().sort((a, b) => b.acts - a.acts).map(u => {
                const max = Math.max(...lumaUsers.map(x => x.acts), 1);
                const rd = LUMA_ROLES[u.role];
                return (
                  <View key={u.id} style={styles.actsRow}>
                    <Text style={styles.actsName} numberOfLines={1}>{u.name}</Text>
                    <View style={styles.actsBarTrack}>
                      <View style={[styles.actsBarFill, { width: `${(u.acts / max) * 100}%`, backgroundColor: rd.color }]} />
                    </View>
                    <Text style={styles.actsCount}>{u.acts}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {tab === "Invites" && (
          <>
            <View style={styles.inviteFormCard}>
              <Text style={styles.expandedLabel}>Invite New Member</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor={C.mute}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={styles.roleRow}>
                {ROLE_KEYS.filter(r => r !== "owner").map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setInviteRole(r)}
                    style={[styles.roleBtn, inviteRole === r && { borderColor: LUMA_ROLES[r].color + "60", backgroundColor: LUMA_ROLES[r].color + "14" }]}
                  >
                    <Text style={[styles.roleBtnText, inviteRole === r && { color: LUMA_ROLES[r].color }]}>{LUMA_ROLES[r].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={handleSendInvite}>
                <LinearGradient colors={GRAD.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                  <Text style={styles.submitText}>Send Invite</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Pending Invites ({invites.length})</Text>
            {invites.length === 0 && <Text style={styles.emptyText}>No pending invites</Text>}
            {invites.map(inv => {
              const rd = LUMA_ROLES[inv.role];
              return (
                <View key={inv.id} style={styles.inviteRow}>
                  <View style={[styles.inviteIcon, { backgroundColor: rd.bg }]}>
                    <Feather name="mail" size={14} color={rd.color} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.name}>{inv.email}</Text>
                    <Text style={styles.lastLogin}>{rd.label} · Sent {inv.sent} · Expires {inv.exp}</Text>
                  </View>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => resendInvite(inv.id)}>
                      <Feather name="refresh-cw" size={14} color={C.accentL} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, { borderColor: C.off + "30", backgroundColor: C.off + "10" }]} onPress={() => cancelInvite(inv.id)}>
                      <Feather name="x" size={14} color={C.off} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Invite Member</Text>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput style={styles.input} placeholder="jane@example.com" placeholderTextColor={C.mute} value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_KEYS.filter(r => r !== "owner").map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setInviteRole(r)}
                  style={[styles.roleBtn, inviteRole === r && { borderColor: LUMA_ROLES[r].color + "60", backgroundColor: LUMA_ROLES[r].color + "14" }]}
                >
                  <Text style={[styles.roleBtnText, inviteRole === r && { color: LUMA_ROLES[r].color }]}>{LUMA_ROLES[r].label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleSendInvite}>
              <LinearGradient colors={GRAD.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                <Text style={styles.submitText}>Send Invite</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setInviteOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RoleChip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.roleChip, active && { backgroundColor: color + "1c", borderColor: color + "50" }]}>
      <Text style={[styles.roleChipText, active && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, color: C.mute, marginTop: 2, fontFamily: "Inter_400Regular" },
  addBtn: { borderRadius: 12, overflow: "hidden" },
  addBtnGrad: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnText: { fontSize: 13, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
  tabBar: { flexDirection: "row", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: C.b0 },
  tabBtn: { paddingVertical: 10, marginRight: 20 },
  tabText: { fontSize: 13, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  tabTextActive: { color: C.txt },
  tabIndicator: { height: 2, borderRadius: 2, marginTop: 8 },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  statGrid: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  statCard: { flexBasis: "23%", flexGrow: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 10, alignItems: "center", gap: 4 },
  statValue: { fontSize: 18, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, color: C.txt, fontSize: 13, fontFamily: "Inter_400Regular" },
  chipRow: { marginBottom: 14 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: C.b0, backgroundColor: C.surface },
  roleChipText: { fontSize: 12, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  userCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 10 },
  userTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatarWrap: { position: "relative" },
  avatar: { width: 48, height: 48, borderRadius: 99, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: "#fff" },
  onlineDot: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 99, backgroundColor: C.on, borderWidth: 2, borderColor: C.bg },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" },
  name: { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  roleText: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  email: { fontSize: 11, color: C.accentL, fontFamily: "Inter_400Regular", marginBottom: 2 },
  lastLogin: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  expandedArea: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.b0 },
  expandedLabel: { fontSize: 10, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "Inter_600SemiBold" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  miniChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  miniChipText: { fontSize: 10, fontWeight: "600" as const, color: C.mute, fontFamily: "Inter_600SemiBold" },
  expandedActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statMeta: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.off + "30", backgroundColor: C.off + "10" },
  removeBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, marginTop: 6, fontFamily: "Inter_600SemiBold" },
  matrixCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 12, marginBottom: 18 },
  matrixHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.b0 },
  matrixNameCol: { width: 70, flexDirection: "row", alignItems: "center", gap: 6 },
  matrixNameColWide: { width: 90, flexDirection: "row", alignItems: "center", gap: 6 },
  matrixHeadCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  matrixHeadCellWide: { width: 52, alignItems: "center", justifyContent: "center" },
  matrixRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.b0 },
  matrixDot: { width: 6, height: 6, borderRadius: 99 },
  matrixName: { fontSize: 11, color: C.txt, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  matrixCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  roomEmoji: { fontSize: 14 },
  activityRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 12 },
  activityIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  activityInfo: { flex: 1 },
  activityText: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular", lineHeight: 17 },
  activityUser: { color: C.txt, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  activityTarget: { color: C.accentL, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  activityTime: { fontSize: 10, color: C.mute, marginTop: 2, fontFamily: "Inter_400Regular" },
  actsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  actsName: { width: 80, fontSize: 11, color: C.txt, fontFamily: "Inter_600SemiBold" },
  actsBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.elevated, overflow: "hidden" },
  actsBarFill: { height: "100%", borderRadius: 3 },
  actsCount: { width: 24, textAlign: "right", fontSize: 11, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  inviteFormCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, marginBottom: 20 },
  emptyText: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 20 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 10 },
  inviteIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionBtns: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.bgMid, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.b0, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 99, backgroundColor: C.b0, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", marginBottom: 18 },
  inputLabel: { fontSize: 10, color: C.mute, fontWeight: "700" as const, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "Inter_600SemiBold" },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.b0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: C.txt, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 14 },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  roleBtn: { flex: 1, minWidth: 80, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: C.b0, alignItems: "center" },
  roleBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  submitBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  submitText: { color: "#fff", fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  cancelBtn: { paddingVertical: 12, borderRadius: 14, backgroundColor: C.b1, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  cancelText: { color: C.mute, fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_600SemiBold" },
});
