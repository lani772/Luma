import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import {
  DEVICE_FEATURES_DEF,
  FEATURE_CATEGORIES,
  FeatureCategory,
  MC_ROLE_DEF,
  MCUserEntry,
  INITIAL_LAMPS,
  DeviceFeature,
} from "@/data/luma-data";

const CATEGORY_COLORS: Record<FeatureCategory, string> = {
  Control:    "#F59E0B",
  Scheduling: "#7C3AED",
  Timer:      "#06B6D4",
  Automation: "#10B981",
  Monitoring: "#6366F1",
};

export default function DevicePermissionsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { mcUsers, toggleDeviceFeature, grantDeviceAccess, revokeDeviceAccess } = useLuma();

  const [selectedDeviceId, setSelectedDeviceId] = useState(INITIAL_LAMPS[0].id);
  const [expandedCat, setExpandedCat] = useState<FeatureCategory | null>("Control");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const selectedDevice = INITIAL_LAMPS.find(l => l.id === selectedDeviceId);

  // Users that have access to the selected device
  const usersWithAccess = mcUsers.filter(u =>
    u.mcId === "MC001" && u.deviceAccess.some(d => d.deviceId === selectedDeviceId)
  );

  // Users that could be granted access (have no access yet, not owner)
  const usersWithoutAccess = mcUsers.filter(u =>
    u.mcId === "MC001" &&
    u.role !== "owner" &&
    !u.deviceAccess.some(d => d.deviceId === selectedDeviceId)
  );

  const featuresByCategory = FEATURE_CATEGORIES.map(cat => ({
    cat,
    features: DEVICE_FEATURES_DEF.filter(f => f.category === cat),
  }));

  function getUserFeaturesForDevice(user: MCUserEntry): DeviceFeature[] {
    return user.deviceAccess.find(d => d.deviceId === selectedDeviceId)?.features ?? [];
  }

  function handleToggle(userId: number, feature: DeviceFeature) {
    const user = mcUsers.find(u => u.id === userId);
    if (!user || user.role === "owner") return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleDeviceFeature(userId, selectedDeviceId, feature);
  }

  function handleGrantAccess(userId: number) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    grantDeviceAccess(userId, {
      deviceId: selectedDeviceId,
      deviceName: selectedDevice?.name ?? selectedDeviceId,
      features: ["toggle", "view_status"],
    });
  }

  function handleRevokeAll(userId: number) {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    revokeDeviceAccess(userId, selectedDeviceId);
  }

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Device Permissions</Text>
          <Text style={s.subtitle}>Feature matrix per user per device</Text>
        </View>
      </View>

      {/* Device selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.deviceScroll}
        style={s.deviceBar}>
        {INITIAL_LAMPS.map(lamp => {
          const selected = lamp.id === selectedDeviceId;
          const userCount = mcUsers.filter(u => u.deviceAccess.some(d => d.deviceId === lamp.id)).length;
          return (
            <TouchableOpacity
              key={lamp.id}
              style={[s.deviceChip, selected && { backgroundColor: C.gold + "20", borderColor: C.gold + "60" }]}
              onPress={() => { setSelectedDeviceId(lamp.id); setExpandedUser(null); }}>
              <Feather name="zap" size={12} color={selected ? C.gold : C.mute} />
              <View>
                <Text style={[s.deviceChipName, selected && { color: C.gold }]} numberOfLines={1}>{lamp.name}</Text>
                <Text style={s.deviceChipCount}>{userCount} user{userCount !== 1 ? "s" : ""}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Device info header */}
        <View style={s.deviceInfoCard}>
          <View style={[s.deviceInfoIcon, { backgroundColor: selectedDevice?.online ? C.on + "18" : C.mute + "18" }]}>
            <Feather name="zap" size={18} color={selectedDevice?.online ? C.on : C.mute} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.deviceInfoName}>{selectedDevice?.name}</Text>
            <Text style={s.deviceInfoRoom}>{selectedDevice?.room} · {selectedDevice?.online ? "Online" : "Offline"}</Text>
          </View>
          <View style={[s.onlineDot, { backgroundColor: selectedDevice?.online ? C.on : C.mute }]} />
        </View>

        {/* Feature Category Legend */}
        <View style={s.legendRow}>
          {FEATURE_CATEGORIES.map(cat => (
            <View key={cat} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
              <Text style={s.legendText}>{cat}</Text>
            </View>
          ))}
        </View>

        {/* Users with access */}
        <Text style={s.sectionLabel}>Users with Access ({usersWithAccess.length})</Text>

        {usersWithAccess.map(user => {
          const def = MC_ROLE_DEF[user.role];
          const userFeatures = getUserFeaturesForDevice(user);
          const isOwner = user.role === "owner";
          const isExpanded = expandedUser === user.id;

          return (
            <View key={user.id} style={s.userCard}>
              <TouchableOpacity
                style={s.userHeader}
                onPress={() => !isOwner && setExpandedUser(isExpanded ? null : user.id)}
                activeOpacity={isOwner ? 1 : 0.75}>
                <View style={[s.avatar, { backgroundColor: def.color + "20", borderColor: def.color + "40" }]}>
                  <Text style={[s.avatarText, { color: def.color }]}>{user.avatarInit}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{user.name}</Text>
                  <Text style={s.userRole}>{def.label}</Text>
                </View>
                <View style={s.featureCountRow}>
                  {FEATURE_CATEGORIES.map(cat => {
                    const catFeatures = DEVICE_FEATURES_DEF.filter(f => f.category === cat).map(f => f.key);
                    const grantedCount = userFeatures.filter(f => catFeatures.includes(f)).length;
                    const totalCount = catFeatures.length;
                    return (
                      <View key={cat} style={[s.catDot, { backgroundColor: CATEGORY_COLORS[cat] + (grantedCount > 0 ? "FF" : "30") }]}>
                        {grantedCount > 0 && <Text style={s.catDotText}>{grantedCount}</Text>}
                      </View>
                    );
                  })}
                </View>
                {!isOwner && (
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={15} color={C.mute} style={{ marginLeft: 4 }} />
                )}
                {isOwner && (
                  <View style={s.ownerAllBadge}>
                    <Feather name="star" size={10} color="#F59E0B" />
                    <Text style={s.ownerAllText}>All</Text>
                  </View>
                )}
              </TouchableOpacity>

              {isExpanded && !isOwner && (
                <View style={s.featureMatrix}>
                  {featuresByCategory.map(({ cat, features }) => (
                    <View key={cat} style={s.featureCatSection}>
                      <TouchableOpacity
                        style={s.featureCatHeader}
                        onPress={() => setExpandedCat(expandedCat === cat ? null : cat)}>
                        <View style={[s.featureCatDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                        <Text style={[s.featureCatName, { color: CATEGORY_COLORS[cat] }]}>{cat}</Text>
                        <Text style={s.featureCatCount}>
                          {features.filter(f => userFeatures.includes(f.key)).length}/{features.length}
                        </Text>
                        <Feather name={expandedCat === cat ? "chevron-up" : "chevron-down"} size={13} color={C.mute} />
                      </TouchableOpacity>

                      {expandedCat === cat && features.map(f => {
                        const granted = userFeatures.includes(f.key);
                        return (
                          <TouchableOpacity
                            key={f.key}
                            style={s.featureRow}
                            onPress={() => handleToggle(user.id, f.key)}
                            activeOpacity={0.7}>
                            <View style={[s.featureIcon, { backgroundColor: granted ? CATEGORY_COLORS[cat] + "20" : C.elevated }]}>
                              <Feather name={f.icon as "power"} size={12} color={granted ? CATEGORY_COLORS[cat] : C.mute} />
                            </View>
                            <Text style={[s.featureLabel, { color: granted ? C.txt : C.sec }]}>{f.label}</Text>
                            <View style={[s.toggle, { backgroundColor: granted ? CATEGORY_COLORS[cat] : C.elevated, borderColor: granted ? CATEGORY_COLORS[cat] : C.b0 }]}>
                              {granted && <Feather name="check" size={10} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}

                  <TouchableOpacity style={s.revokeAllBtn} onPress={() => handleRevokeAll(user.id)}>
                    <Feather name="x-circle" size={13} color={C.off} />
                    <Text style={s.revokeAllText}>Revoke All Access to this Device</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* Users without access */}
        {usersWithoutAccess.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 8 }]}>No Access ({usersWithoutAccess.length})</Text>
            {usersWithoutAccess.map(user => {
              const def = MC_ROLE_DEF[user.role];
              return (
                <View key={user.id} style={s.noAccessRow}>
                  <View style={[s.avatar, { backgroundColor: def.color + "15", borderColor: def.color + "30", width: 38, height: 38 }]}>
                    <Text style={[s.avatarText, { color: def.color, fontSize: 12 }]}>{user.avatarInit}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.userName, { fontSize: 13 }]}>{user.name}</Text>
                    <Text style={s.userRole}>{def.label}</Text>
                  </View>
                  <TouchableOpacity style={s.grantBtn} onPress={() => handleGrantAccess(user.id)}>
                    <Feather name="plus" size={12} color={C.on} />
                    <Text style={s.grantBtnText}>Grant</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        <View style={s.infoCard}>
          <Feather name="info" size={14} color={C.mute} />
          <Text style={s.infoText}>Tap a user to expand their feature matrix. Toggle each feature on/off. Changes are stored on the MCU immediately.</Text>
        </View>
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

  deviceBar: { borderBottomWidth: 1, borderBottomColor: C.b0, maxHeight: 72 },
  deviceScroll: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  deviceChip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.elevated, borderRadius: 12, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 10, paddingVertical: 7 },
  deviceChipName: { fontSize: 12, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold", maxWidth: 90 },
  deviceChipCount: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },

  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },

  deviceInfoCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 14 },
  deviceInfoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deviceInfoName: { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  deviceInfoRoom: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },

  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },

  avatar: { width: 44, height: 44, borderRadius: 99, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },

  userCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 10, overflow: "hidden" },
  userHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  userName: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  userRole: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  featureCountRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  catDot: { width: 20, height: 20, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  catDotText: { fontSize: 9, color: "#fff", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  ownerAllBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F59E0B18", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  ownerAllText: { fontSize: 10, fontWeight: "700" as const, color: "#F59E0B", fontFamily: "Inter_700Bold" },

  featureMatrix: { borderTopWidth: 1, borderTopColor: C.b0, backgroundColor: C.bg + "88", padding: 12, gap: 6 },
  featureCatSection: { gap: 2 },
  featureCatHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  featureCatDot: { width: 8, height: 8, borderRadius: 4 },
  featureCatName: { flex: 1, fontSize: 12, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  featureCatCount: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingLeft: 16, borderRadius: 10 },
  featureIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  featureLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  toggle: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  revokeAllBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: C.b0 },
  revokeAllText: { fontSize: 12, fontWeight: "600" as const, color: C.off, fontFamily: "Inter_600SemiBold" },

  noAccessRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.b0, padding: 12, marginBottom: 8, opacity: 0.7 },
  grantBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.on + "15", borderRadius: 8, borderWidth: 1, borderColor: C.on + "30" },
  grantBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.on, fontFamily: "Inter_700Bold" },

  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.elevated, borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1, borderColor: C.b0 },
  infoText: { flex: 1, fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
