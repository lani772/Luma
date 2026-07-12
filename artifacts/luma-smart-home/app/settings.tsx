import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import LumaToggle from "@/components/LumaToggle";
import { useCloudAuth } from "@/context/CloudAuthContext";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [s, setS] = useState({ notifs: true, guests: false, energy: true, biometric: true, autolock: true, darkMode: true });
  const tog = (k: keyof typeof s) => setS(x => ({ ...x, [k]: !x[k] }));
  const { user, isAuthenticated, logout } = useCloudAuth();

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {isAuthenticated && user
                ? user.fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
                : "LU"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {isAuthenticated && user ? user.fullName : "Local User"}
            </Text>
            <Text style={styles.profileRole}>
              {isAuthenticated && user
                ? `${user.role} · ${user.subscriptionTier}`
                : "Not signed in to cloud"}
            </Text>
            {isAuthenticated && user && (
              <Text style={styles.profileEmail}>{user.email}</Text>
            )}
          </View>
          {!isAuthenticated && (
            <TouchableOpacity style={styles.editBtn} onPress={() => router.push("/login")}>
              <Feather name="log-in" size={15} color={C.accentL} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionLabel}>Cloud Account</Text>
        <View style={styles.infoCard}>
          {isAuthenticated && user ? (
            <>
              <View style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: C.b0 }]}>
                <Text style={styles.infoLabel}>Status</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.on }} />
                  <Text style={[styles.infoValue, { color: C.on }]}>Connected</Text>
                </View>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 1, borderBottomColor: C.b0 }]}>
                <Text style={styles.infoLabel}>Account</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Plan</Text>
                <Text style={styles.infoValue}>{user.subscriptionTier}</Text>
              </View>
            </>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={[styles.infoValue, { color: C.accentL }]}>Sign in →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.settingsCard}>
          <SettingsRow icon="bell" title="Push Notifications" sub="Device event alerts" value={s.notifs} onToggle={() => tog("notifs")} />
          <SettingsRow icon="users" title="Guest Alerts" sub="When guests arrive or leave" value={s.guests} onToggle={() => tog("guests")} />
          <SettingsRow icon="zap" title="Energy Alerts" sub="Daily usage summaries" value={s.energy} onToggle={() => tog("energy")} last />
        </View>

        <Text style={styles.sectionLabel}>Security</Text>
        <View style={styles.settingsCard}>
          <SettingsRow icon="eye" title="Biometric Auth" sub="Face ID / fingerprint" value={s.biometric} onToggle={() => tog("biometric")} />
          <SettingsRow icon="lock" title="Auto-Lock" sub="Lock after 5 min away" value={s.autolock} onToggle={() => tog("autolock")} last />
        </View>

        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.settingsCard}>
          <SettingsRow icon="moon" title="Dark Mode" sub="Always use dark theme" value={s.darkMode} onToggle={() => tog("darkMode")} last />
        </View>

        <Text style={styles.sectionLabel}>App Info</Text>
        <View style={styles.infoCard}>
          {[
            { l: "Version", v: "3.2.0" },
            { l: "MQTT Broker", v: "mqtt.luma.local" },
            { l: "Managed Devices", v: "6 smart lamps" },
            { l: "Latest Firmware", v: "v2.4.2" },
            { l: "Build", v: "20261201-prod" },
          ].map((i, idx, arr) => (
            <View key={i.l} style={[styles.infoRow, idx !== arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.b0 }]}>
              <Text style={styles.infoLabel}>{i.l}</Text>
              <Text style={styles.infoValue}>{i.v}</Text>
            </View>
          ))}
        </View>

        {isAuthenticated ? (
          <TouchableOpacity style={styles.signOutBtn} onPress={() => logout()}>
            <Feather name="log-out" size={16} color={C.off} />
            <Text style={styles.signOutText}>Sign Out of Cloud</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.signOutBtn, { borderColor: C.accent + "50", backgroundColor: C.accent + "12" }]} onPress={() => router.push("/login")}>
            <Feather name="cloud" size={16} color={C.accentL} />
            <Text style={[styles.signOutText, { color: C.accentL }]}>Connect to Cloud</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function SettingsRow({ icon, title, sub, value, onToggle, last }: { icon: string; title: string; sub: string; value: boolean; onToggle: () => void; last?: boolean }) {
  return (
    <View style={[styles.settingRow, !last && { borderBottomWidth: 1, borderBottomColor: C.b0 }]}>
      <View style={styles.settingIcon}>
        <Feather name={icon as any} size={16} color={C.sec} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{sub}</Text>
      </View>
      <LumaToggle value={value} onToggle={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 60 },
  profileCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
  avatar: { width: 56, height: 56, borderRadius: 99, backgroundColor: C.accent + "30", borderWidth: 2, borderColor: C.accent + "50", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700" as const, color: C.accentL, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  profileRole: { fontSize: 11, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  profileEmail: { fontSize: 11, color: C.accentL, marginTop: 2, fontFamily: "Inter_400Regular" },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontFamily: "Inter_600SemiBold" },
  settingsCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 14, marginBottom: 18 },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 12 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center" },
  settingTitle: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  settingSub: { fontSize: 11, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  infoCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, paddingHorizontal: 14, marginBottom: 20 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  infoLabel: { fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13, color: C.mute, fontFamily: "Inter_400Regular" },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, backgroundColor: C.off + "12", borderRadius: 14, borderWidth: 1, borderColor: C.off + "30" },
  signOutText: { fontSize: 14, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },
});
