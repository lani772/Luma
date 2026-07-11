import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import {
  DeviceFeatureAccess,
  DeviceFeature,
  MC_ROLE_DEF,
  MCUserRole,
  INITIAL_LAMPS,
  timeAgo,
} from "@/data/luma-data";

const TABS = ["requests", "users", "guests"] as const;
type Tab = typeof TABS[number];

const ROLE_OPTIONS: { role: MCUserRole; label: string; color: string }[] = [
  { role: "full_access",    label: "Full Access",    color: "#06B6D4" },
  { role: "partial_access", label: "Partial Access", color: "#10B981" },
  { role: "guest",          label: "Guest",          color: "#9CA3AF" },
];

const DEFAULT_FEATURES: DeviceFeature[] = ["toggle", "view_status", "view_energy"];

export default function AccessScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const {
    mcUsers, accessRequests,
    approveAccessRequest, rejectAccessRequest, blockRequester, revokeGuest,
    revokeDeviceAccess,
  } = useLuma();

  const [tab, setTab] = useState<Tab>("requests");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  // Approve flow state
  const [approveModal, setApproveModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<MCUserRole>("full_access");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  const pending = useMemo(() => accessRequests.filter(r => r.status === "pending"), [accessRequests]);
  const history = useMemo(() => accessRequests.filter(r => r.status !== "pending"), [accessRequests]);
  const regularUsers = useMemo(() => mcUsers.filter(u => u.role !== "owner" && u.role !== "guest" && u.mcId === "MC001"), [mcUsers]);
  const guests = useMemo(() => mcUsers.filter(u => u.role === "guest" && u.mcId === "MC001"), [mcUsers]);

  function openApproveModal(reqId: number) {
    const req = accessRequests.find(r => r.id === reqId);
    setApproveTarget(reqId);
    setSelectedRole("full_access");
    setSelectedDevices(req?.requestedDeviceIds ?? []);
    setApproveModal(true);
  }

  function confirmApprove() {
    if (approveTarget === null) return;
    const deviceAccess: DeviceFeatureAccess[] = selectedDevices.map(id => ({
      deviceId: id,
      deviceName: INITIAL_LAMPS.find(l => l.id === id)?.name ?? id,
      features: DEFAULT_FEATURES,
    }));
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    approveAccessRequest(approveTarget, deviceAccess, selectedRole);
    setApproveModal(false);
    setApproveTarget(null);
  }

  function handleReject(id: number) {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    rejectAccessRequest(id);
  }

  function handleBlock(id: number) {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    blockRequester(id);
  }

  function fmtExpiry(expiresAt: number): string {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return "Expired";
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    if (h > 23) return `${Math.floor(h / 24)}d left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  }

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Access Control</Text>
          <Text style={s.subtitle}>MCU-centric permission management</Text>
        </View>
      </View>

      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[s.tabBtn, tab === t && { backgroundColor: C.elevated, borderColor: C.b0 }]}>
            <Text style={[s.tabText, tab === t && { color: C.txt }]}>
              {t === "requests" ? "Requests" : t === "users" ? "Users" : "Guests"}
            </Text>
            {t === "requests" && pending.length > 0 && (
              <View style={s.badge}><Text style={s.badgeText}>{pending.length}</Text></View>
            )}
            {t === "guests" && guests.length > 0 && (
              <View style={[s.badge, { backgroundColor: "#9CA3AF" }]}><Text style={s.badgeText}>{guests.length}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── REQUESTS TAB ── */}
        {tab === "requests" && (
          <>
            {/* Discovery flow banner */}
            <View style={s.flowBanner}>
              <View style={s.flowStep}>
                <View style={[s.flowIcon, { backgroundColor: "#7C3AED18" }]}>
                  <Feather name="bluetooth" size={14} color="#7C3AED" />
                </View>
                <Text style={s.flowLabel}>Discover</Text>
              </View>
              <Feather name="chevron-right" size={14} color={C.mute} />
              <View style={s.flowStep}>
                <View style={[s.flowIcon, { backgroundColor: "#F59E0B18" }]}>
                  <Feather name="send" size={14} color="#F59E0B" />
                </View>
                <Text style={s.flowLabel}>Request</Text>
              </View>
              <Feather name="chevron-right" size={14} color={C.mute} />
              <View style={s.flowStep}>
                <View style={[s.flowIcon, { backgroundColor: "#06B6D418" }]}>
                  <Feather name="check-circle" size={14} color="#06B6D4" />
                </View>
                <Text style={s.flowLabel}>Approve</Text>
              </View>
              <Feather name="chevron-right" size={14} color={C.mute} />
              <View style={s.flowStep}>
                <View style={[s.flowIcon, { backgroundColor: "#10B98118" }]}>
                  <Feather name="cpu" size={14} color="#10B981" />
                </View>
                <Text style={s.flowLabel}>Stored</Text>
              </View>
            </View>

            <Text style={s.sectionLabel}>Pending ({pending.length})</Text>
            {pending.length === 0 ? (
              <View style={s.empty}>
                <Feather name="check-circle" size={40} color={C.on} />
                <Text style={s.emptyTitle}>All clear</Text>
                <Text style={s.emptySub}>No pending access requests</Text>
              </View>
            ) : (
              pending.map(r => (
                <View key={r.id} style={s.requestCard}>
                  <View style={s.requestHeader}>
                    <View style={[s.avatar, { backgroundColor: r.requesterColor + "25", borderColor: r.requesterColor + "50" }]}>
                      <Text style={[s.avatarText, { color: r.requesterColor }]}>{r.requesterInit}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.requestName}>{r.requesterName}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <View style={[s.discoveryBadge, { backgroundColor: r.discoveredVia === "bluetooth" ? "#7C3AED18" : "#06B6D418" }]}>
                          <Feather name={r.discoveredVia === "bluetooth" ? "bluetooth" : "wifi"} size={10} color={r.discoveredVia === "bluetooth" ? "#7C3AED" : "#06B6D4"} />
                          <Text style={[s.discoveryText, { color: r.discoveredVia === "bluetooth" ? "#7C3AED" : "#06B6D4" }]}>
                            {r.discoveredVia === "bluetooth" ? "Bluetooth" : "Wi-Fi"}
                          </Text>
                        </View>
                        <Text style={s.requestWhen}>{timeAgo(r.requestedAt)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.requestDevices}>
                    <Text style={s.deviceReqLabel}>Requested devices:</Text>
                    <View style={s.deviceTags}>
                      {r.requestedDeviceIds.map(id => (
                        <View key={id} style={s.deviceTag}>
                          <Feather name="zap" size={9} color={C.gold} />
                          <Text style={s.deviceTagText}>{INITIAL_LAMPS.find(l => l.id === id)?.name ?? id}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={s.requestActions}>
                    <TouchableOpacity style={s.approveBtn} onPress={() => openApproveModal(r.id)}>
                      <Feather name="check" size={13} color={C.on} />
                      <Text style={s.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(r.id)}>
                      <Feather name="x" size={13} color={C.off} />
                      <Text style={s.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.blockBtn} onPress={() => handleBlock(r.id)}>
                      <Feather name="slash" size={13} color={C.mute} />
                      <Text style={s.blockBtnText}>Block</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {history.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 8 }]}>History ({history.length})</Text>
                {history.map(r => {
                  const statusColor = r.status === "approved" ? C.on : r.status === "blocked" ? C.off : C.mute;
                  return (
                    <View key={r.id} style={s.historyRow}>
                      <View style={[s.avatar, { backgroundColor: r.requesterColor + "25", borderColor: r.requesterColor + "50", width: 38, height: 38 }]}>
                        <Text style={[s.avatarText, { color: r.requesterColor, fontSize: 12 }]}>{r.requesterInit}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.requestName}>{r.requesterName}</Text>
                        <Text style={s.requestWhen}>{timeAgo(r.requestedAt)} · via {r.discoveredVia}</Text>
                      </View>
                      <View style={[s.statusPill, { backgroundColor: statusColor + "18", borderColor: statusColor + "30" }]}>
                        <Text style={[s.statusText, { color: statusColor }]}>{r.status}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <>
            <Text style={s.sectionLabel}>Members ({regularUsers.length})</Text>
            {regularUsers.map(u => {
              const def = MC_ROLE_DEF[u.role];
              const isExpanded = expandedUser === u.id;
              return (
                <View key={u.id} style={s.userCard}>
                  <TouchableOpacity style={s.userHeader} onPress={() => setExpandedUser(isExpanded ? null : u.id)} activeOpacity={0.75}>
                    <View style={[s.avatar, { backgroundColor: def.color + "20", borderColor: def.color + "40" }]}>
                      <Text style={[s.avatarText, { color: def.color }]}>{u.avatarInit}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.requestName}>{u.name}</Text>
                      <Text style={s.requestWhen}>{u.email}</Text>
                    </View>
                    <View style={[s.rolePill, { backgroundColor: def.color + "18", borderColor: def.color + "30" }]}>
                      <Text style={[s.rolePillText, { color: def.color }]}>{def.label}</Text>
                    </View>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={15} color={C.mute} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={s.deviceList}>
                      <Text style={s.deviceListHeader}>{u.deviceAccess.length} device{u.deviceAccess.length !== 1 ? "s" : ""} accessible</Text>
                      {u.deviceAccess.map(da => (
                        <View key={da.deviceId} style={s.deviceAccessRow}>
                          <View style={s.deviceAccessIcon}>
                            <Feather name="zap" size={12} color={C.gold} />
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={s.deviceAccessName}>{da.deviceName}</Text>
                            <View style={s.featureTags}>
                              {da.features.slice(0, 5).map(f => (
                                <View key={f} style={s.featureTag}>
                                  <Text style={s.featureTagText}>{f.replace(/_/g, " ")}</Text>
                                </View>
                              ))}
                              {da.features.length > 5 && (
                                <View style={s.featureTag}>
                                  <Text style={s.featureTagText}>+{da.features.length - 5} more</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity onPress={() => revokeDeviceAccess(u.id, da.deviceId)} style={s.revokeDeviceBtn}>
                            <Feather name="x" size={12} color={C.mute} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {u.deviceAccess.length === 0 && (
                        <Text style={s.noDevicesText}>No devices assigned</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── GUESTS TAB ── */}
        {tab === "guests" && (
          <>
            <Text style={s.sectionLabel}>Active Guests ({guests.length})</Text>
            {guests.length === 0 ? (
              <View style={s.empty}>
                <Feather name="link" size={36} color={C.mute} />
                <Text style={s.emptyTitle}>No active guests</Text>
                <Text style={s.emptySub}>Create a temporary guest access link to share with visitors</Text>
              </View>
            ) : (
              guests.map(g => {
                const gc = g.guestConfig;
                const expiry = gc ? fmtExpiry(gc.expiresAt) : "—";
                const isExpired = gc ? gc.expiresAt < Date.now() : false;
                const expiryColor = isExpired ? C.off : gc && gc.expiresAt - Date.now() < 3600000 ? "#F59E0B" : C.on;
                return (
                  <View key={g.id} style={[s.guestCard, isExpired && { opacity: 0.6 }]}>
                    <View style={s.guestHeader}>
                      <View style={[s.avatar, { backgroundColor: "#9CA3AF25", borderColor: "#9CA3AF50" }]}>
                        <Text style={[s.avatarText, { color: "#9CA3AF" }]}>{g.avatarInit}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.requestName}>{g.name}</Text>
                        <Text style={s.requestWhen}>{g.email}</Text>
                      </View>
                      <TouchableOpacity style={s.revokeBtn} onPress={() => {
                        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        revokeGuest(g.id);
                      }}>
                        <Text style={s.revokeBtnText}>Revoke</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={s.guestStats}>
                      <View style={s.guestStat}>
                        <Feather name="clock" size={13} color={expiryColor} />
                        <Text style={[s.guestStatValue, { color: expiryColor }]}>{expiry}</Text>
                      </View>
                      {gc?.maxUses != null && (
                        <View style={s.guestStat}>
                          <Feather name="activity" size={13} color={C.sec} />
                          <Text style={s.guestStatValue}>{gc.usedCount}/{gc.maxUses} uses</Text>
                        </View>
                      )}
                      <View style={s.guestStat}>
                        <Feather name="zap" size={13} color={C.gold} />
                        <Text style={s.guestStatValue}>{g.deviceAccess.length} device{g.deviceAccess.length !== 1 ? "s" : ""}</Text>
                      </View>
                    </View>

                    <View style={s.guestFeatures}>
                      {g.deviceAccess[0]?.features.slice(0, 4).map(f => (
                        <View key={f} style={s.featureTag}>
                          <Text style={s.featureTagText}>{f.replace(/_/g, " ")}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })
            )}

            <View style={s.guestInfoCard}>
              <Feather name="info" size={14} color={C.mute} />
              <View style={{ flex: 1 }}>
                <Text style={s.guestInfoTitle}>About Guest Access</Text>
                <Text style={s.guestInfoText}>Guests get time-limited, feature-restricted access stored on the MCU. They auto-expire and cannot manage users or settings.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Approve Modal */}
      <Modal visible={approveModal} transparent animationType="slide" onRequestClose={() => setApproveModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Approve Access Request</Text>
              <TouchableOpacity onPress={() => setApproveModal(false)}>
                <Feather name="x" size={20} color={C.sec} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalSectionLabel}>Assign Role</Text>
            <View style={s.roleOptions}>
              {ROLE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.role}
                  style={[s.roleOption, selectedRole === opt.role && { borderColor: opt.color, backgroundColor: opt.color + "15" }]}
                  onPress={() => setSelectedRole(opt.role)}>
                  <View style={[s.roleOptionDot, { backgroundColor: opt.color }]} />
                  <Text style={[s.roleOptionText, { color: selectedRole === opt.role ? opt.color : C.sec }]}>{opt.label}</Text>
                  {selectedRole === opt.role && <Feather name="check" size={13} color={opt.color} />}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.modalSectionLabel}>Grant Device Access</Text>
            <View style={s.deviceCheckList}>
              {INITIAL_LAMPS.map(lamp => {
                const selected = selectedDevices.includes(lamp.id);
                return (
                  <TouchableOpacity
                    key={lamp.id}
                    style={s.deviceCheckRow}
                    onPress={() => setSelectedDevices(prev =>
                      selected ? prev.filter(id => id !== lamp.id) : [...prev, lamp.id]
                    )}>
                    <View style={[s.checkbox, selected && { backgroundColor: C.on, borderColor: C.on }]}>
                      {selected && <Feather name="check" size={10} color="#fff" />}
                    </View>
                    <Feather name="zap" size={13} color={C.gold} />
                    <Text style={[s.deviceCheckName, selected && { color: C.txt }]}>{lamp.name}</Text>
                    <Text style={s.deviceCheckRoom}>{lamp.room}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setApproveModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confirmBtn, selectedDevices.length === 0 && { opacity: 0.4 }]}
                disabled={selectedDevices.length === 0}
                onPress={confirmApprove}>
                <Feather name="check" size={14} color="#fff" />
                <Text style={s.confirmBtnText}>Approve Access</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "transparent", flexDirection: "row", justifyContent: "center", gap: 5 },
  tabText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  badge: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.off, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 9, color: "#fff", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },

  flowBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 16 },
  flowStep: { alignItems: "center", gap: 6 },
  flowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  flowLabel: { fontSize: 10, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },

  avatar: { width: 44, height: 44, borderRadius: 99, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },

  requestCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 12, gap: 12 },
  requestHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  requestName: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  requestWhen: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  discoveryBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  discoveryText: { fontSize: 10, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  requestDevices: { gap: 6 },
  deviceReqLabel: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  deviceTags: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  deviceTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.gold + "15", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  deviceTagText: { fontSize: 10, color: C.gold, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  requestActions: { flexDirection: "row", gap: 8 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: C.on + "14", borderWidth: 1, borderColor: C.on + "30" },
  approveBtnText: { fontSize: 12, fontWeight: "700" as const, color: C.on, fontFamily: "Inter_700Bold" },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: C.off + "14", borderWidth: 1, borderColor: C.off + "30" },
  rejectBtnText: { fontSize: 12, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },
  blockBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, flexDirection: "row", alignItems: "center", gap: 5 },
  blockBtnText: { fontSize: 12, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },

  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },

  userCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 10, overflow: "hidden" },
  userHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  rolePillText: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  deviceList: { borderTopWidth: 1, borderTopColor: C.b0, backgroundColor: C.bg + "88", padding: 12, gap: 8 },
  deviceListHeader: { fontSize: 10, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontFamily: "Inter_600SemiBold" },
  deviceAccessRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.surface, borderRadius: 10, padding: 10 },
  deviceAccessIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.gold + "15", alignItems: "center", justifyContent: "center" },
  deviceAccessName: { fontSize: 12, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  featureTags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  featureTag: { backgroundColor: C.elevated, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: C.b0 },
  featureTagText: { fontSize: 9, color: C.sec, fontFamily: "Inter_400Regular" },
  revokeDeviceBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.b0 },
  noDevicesText: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular", padding: 8 },

  empty: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center" },

  guestCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 10, gap: 12 },
  guestHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  guestStats: { flexDirection: "row", gap: 14 },
  guestStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  guestStatValue: { fontSize: 12, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  guestFeatures: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.off + "14", borderRadius: 8, borderWidth: 1, borderColor: C.off + "25" },
  revokeBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },
  guestInfoCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.elevated, borderRadius: 12, padding: 14, marginTop: 4, borderWidth: 1, borderColor: C.b0 },
  guestInfoTitle: { fontSize: 12, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  guestInfoText: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 16 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  modalSectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 4, fontFamily: "Inter_600SemiBold" },
  roleOptions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleOption: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  roleOptionDot: { width: 8, height: 8, borderRadius: 4 },
  roleOptionText: { fontSize: 12, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  deviceCheckList: { gap: 4, maxHeight: 240 },
  deviceCheckRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.b0 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  deviceCheckName: { flex: 1, fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  deviceCheckRoom: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  modalActions: { flexDirection: "row", gap: 10, paddingTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: "center", backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0 },
  cancelBtnText: { fontSize: 14, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  confirmBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14, backgroundColor: C.on },
  confirmBtnText: { fontSize: 14, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
});
