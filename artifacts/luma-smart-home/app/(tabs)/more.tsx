import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { useCloudAuth } from "@/context/CloudAuthContext";

const MODULES = [
  { id: "microcontrollers",  label: "Microcontrollers",   icon: "cpu",        desc: "ESP32 hubs & GPIO devices",          color: "#f97316" },
  { id: "lamps-manager",     label: "Lamp Manager",        icon: "zap",        desc: "Add & manage smart lamps",           color: "#FBBF24" },
  { id: "mqtt",              label: "MQTT Monitor",        icon: "radio",      desc: "Broker, topics & device states",     color: C.teal },
  { id: "health",            label: "Device Health",       icon: "activity",   desc: "RSSI, CPU, memory & uptime",         color: C.on },
  { id: "connectivity",      label: "Connectivity Hub",    icon: "wifi",       desc: "WiFi · Hotspot · Route · Recovery",  color: C.indigo },
  { id: "wifi-setup",        label: "Device Setup",        icon: "bluetooth",  desc: "First-time ESP32 provisioning",      color: C.purple },
  { id: "mesh",              label: "BT Mesh Network",     icon: "share-2",    desc: "Peers · Routes · Offline Queue",     color: "#7C3AED" },
  { id: "network-monitor",   label: "Network Monitor",     icon: "bar-chart-2",desc: "Signal · Latency · Connectivity",    color: C.teal },
  { id: "scenes",            label: "Scenes",              icon: "sun",        desc: "Lighting presets & custom",          color: C.purple },
  { id: "rooms",             label: "Rooms",               icon: "grid",       desc: "Multi-room dashboard",               color: C.accentL },
  { id: "notifications",     label: "Notifications",       icon: "bell",       desc: "Alerts & history",                   color: C.off },
  { id: "activity",          label: "Activity Log",        icon: "list",       desc: "Full audit trail",                   color: C.gold },
  { id: "access",            label: "Access Control",      icon: "shield",     desc: "Permissions & approvals",            color: C.rose },
  { id: "roles",             label: "Role Manager",        icon: "sliders",    desc: "Permission matrix",                  color: "#A78BFA" },
  { id: "settings",          label: "Settings",            icon: "settings",   desc: "Profile & preferences",              color: C.sec },
] as const;

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { notifications, pendingRequests } = useLuma();
  const { user, username, logout } = useCloudAuth();
  const unread = notifications.filter(n => !n.read && !n.archived).length;

  const displayName = user?.fullName ?? "LUMA User";
  const displayEmail = user?.email ?? "";
  const displayRole = [user?.role, user?.subscriptionTier].filter(Boolean).join(" · ") || "Free";
  const initials = displayName
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "LU";

  function getBadge(id: string) {
    if (id === "notifications" && unread > 0) return unread;
    if (id === "access" && pendingRequests.length > 0) return pendingRequests.length;
    return 0;
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>All Modules</Text>
        <Text style={styles.sub}>Navigate to any feature</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <TouchableOpacity style={styles.profileCard} onPress={() => router.push("/profile")} activeOpacity={0.85}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileRole}>{displayRole}</Text>
            {displayEmail ? <Text style={styles.profileEmail}>{displayEmail}</Text> : null}
            {(username ?? user?.username) && (
              <Text style={[styles.profileEmail, { color: C.mute }]}>@{username ?? user?.username}</Text>
            )}
          </View>
          <View style={styles.profileActions}>
            <TouchableOpacity
              style={styles.profileActionBtn}
              onPress={() => router.push("/invitations")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="mail" size={17} color={C.accentL} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileActionBtn}
              onPress={() => router.push("/profile")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="user" size={17} color={C.sec} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Quick account links */}
        <View style={styles.quickLinks}>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push("/invitations")}>
            <Feather name="mail" size={14} color={C.accentL} />
            <Text style={styles.quickLinkTxt}>Invitations</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push("/security-settings")}>
            <Feather name="lock" size={14} color={C.gold} />
            <Text style={styles.quickLinkTxt}>Security</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLink} onPress={logout}>
            <Feather name="log-out" size={14} color={C.off} />
            <Text style={[styles.quickLinkTxt, { color: C.off }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Modules</Text>
        <View style={styles.grid}>
          {MODULES.map(m => {
            const badge = getBadge(m.id);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.moduleCard, { borderColor: m.color + "25" }]}
                onPress={() => router.push(`/${m.id}` as any)}
                activeOpacity={0.75}
              >
                {badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
                <View style={[styles.moduleIcon, { backgroundColor: m.color + "18", borderColor: m.color + "30" }]}>
                  <Feather name={m.icon as any} size={20} color={m.color} />
                </View>
                <Text style={styles.moduleLabel}>{m.label}</Text>
                <Text style={styles.moduleDesc} numberOfLines={2}>{m.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* App version */}
        <View style={styles.versionRow}>
          <Text style={styles.version}>LUMA Smart Home v3.2.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  title: { fontSize: 24, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, color: C.mute, marginTop: 2, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  profileCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
  profileAvatar: { width: 52, height: 52, borderRadius: 99, backgroundColor: C.accent + "25", borderWidth: 2, borderColor: C.accent + "50", alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontSize: 18, fontWeight: "700" as const, color: C.accentL, fontFamily: "Inter_700Bold" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  profileRole: { fontSize: 11, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  profileEmail: { fontSize: 11, color: C.accentL, marginTop: 1, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, fontFamily: "Inter_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  moduleCard: { width: "47%", backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, padding: 16, position: "relative" },
  badge: { position: "absolute", top: 10, right: 10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.off, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" as const, fontFamily: "Inter_700Bold" },
  moduleIcon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  moduleLabel: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", marginBottom: 4 },
  moduleDesc: { fontSize: 11, color: C.mute, lineHeight: 16, fontFamily: "Inter_400Regular" },
  versionRow: { alignItems: "center", paddingVertical: 10 },
  version: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  profileActions: { flexDirection: "row", gap: 4, alignItems: "center" },
  profileActionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  quickLinks: { flexDirection: "row", gap: 8, marginBottom: 20, marginTop: -10 },
  quickLink: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.elevated, borderRadius: 12, borderWidth: 1, borderColor: C.b0, paddingVertical: 10 },
  quickLinkTxt: { fontSize: 12, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
});
