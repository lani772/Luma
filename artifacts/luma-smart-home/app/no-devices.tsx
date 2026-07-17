import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, GRAD } from "@/constants/colors";
import { useCloudAuth } from "@/context/CloudAuthContext";

const ACTIONS = [
  {
    id: "register",
    icon: "cpu" as const,
    title: "Register a Microcontroller",
    desc: "Add your ESP32 hub to LUMA and start controlling smart devices.",
    color: "#f97316",
    route: "/microcontroller-register",
  },
  {
    id: "invitations",
    icon: "mail" as const,
    title: "Accept an Invitation",
    desc: "A family member or admin may have invited you to an existing home.",
    color: C.accentL,
    route: "/invitations",
  },
  {
    id: "access",
    icon: "shield" as const,
    title: "Request Device Access",
    desc: "Search by username or email to request access to someone's smart home.",
    color: C.teal,
    route: "/access",
  },
  {
    id: "learn",
    icon: "book-open" as const,
    title: "How LUMA Works",
    desc: "Learn about microcontrollers, permissions, and the LUMA ecosystem.",
    color: C.gold,
    route: "/settings",
  },
] as const;

export default function NoDevicesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user, logout } = useCloudAuth();

  const initials = user?.fullName
    ? user.fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "LU";

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initials}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Feather name="log-out" size={16} color={C.sec} />
            <Text style={styles.logoutTxt}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Welcome illustration */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={["rgba(124,58,237,0.15)", "rgba(99,102,241,0.08)"]}
            style={styles.heroGrad}
          >
            <View style={styles.heroIcon}>
              <Feather name="home" size={48} color={C.accentL} />
            </View>
            <Text style={styles.heroTitle}>Welcome to LUMA Smart Home</Text>
            <Text style={styles.heroSub}>
              Hi{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}! Your account is ready.
              No devices or invitations are linked yet — choose how to get started below.
            </Text>
          </LinearGradient>
        </View>

        {/* Action cards */}
        <Text style={styles.sectionLabel}>Get Started</Text>
        <View style={styles.actions}>
          {ACTIONS.map(a => (
            <TouchableOpacity
              key={a.id}
              style={styles.actionCard}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.78}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + "18", borderColor: a.color + "35" }]}>
                <Feather name={a.icon} size={22} color={a.color} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{a.title}</Text>
                <Text style={styles.actionDesc}>{a.desc}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.mute} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Continue to app */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.skipTxt}>Explore the app anyway →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  content:      { paddingHorizontal: 18, gap: 0 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  avatar:       { width: 44, height: 44, borderRadius: 14, backgroundColor: C.accent + "30", borderWidth: 1.5, borderColor: C.accent + "55", alignItems: "center", justifyContent: "center" },
  avatarTxt:    { fontSize: 16, fontWeight: "700" as const, color: C.accentL, fontFamily: "Inter_700Bold" },
  logoutBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0 },
  logoutTxt:    { fontSize: 13, color: C.sec, fontFamily: "Inter_500Medium" },
  heroCard:     { borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: C.b2, marginBottom: 28 },
  heroGrad:     { padding: 28, alignItems: "center", gap: 14 },
  heroIcon:     { width: 88, height: 88, borderRadius: 24, backgroundColor: C.accent + "22", borderWidth: 1.5, borderColor: C.accent + "40", alignItems: "center", justifyContent: "center" },
  heroTitle:    { fontSize: 20, fontWeight: "700" as const, color: C.txt, textAlign: "center", fontFamily: "Inter_700Bold" },
  heroSub:      { fontSize: 14, color: C.sec, textAlign: "center", lineHeight: 22, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 12, fontWeight: "700" as const, color: C.mute, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12, fontFamily: "Inter_700Bold" },
  actions:      { gap: 10, marginBottom: 28 },
  actionCard:   { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 16 },
  actionIcon:   { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionText:   { flex: 1, gap: 3 },
  actionTitle:  { fontSize: 15, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  actionDesc:   { fontSize: 12, color: C.sec, lineHeight: 18, fontFamily: "Inter_400Regular" },
  skipBtn:      { alignItems: "center", paddingVertical: 14 },
  skipTxt:      { fontSize: 14, color: C.accentL, fontFamily: "Inter_500Medium" },
});
