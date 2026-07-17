import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, GRAD } from "@/constants/colors";
import { useCloudAuth } from "@/context/CloudAuthContext";
import { CloudAPI } from "@/services/cloud-api";
import { LinearGradient } from "expo-linear-gradient";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user, username, refreshProfile, isSyncing, triggerSync } = useCloudAuth();

  const [fullName, setFullName]   = useState(user?.fullName ?? "");
  const [uname, setUname]         = useState(username ?? user?.username ?? "");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [editing, setEditing]     = useState(false);

  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setUname(username ?? user?.username ?? "");
  }, [user, username]);

  const initials = user?.fullName
    ? user.fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "LU";

  async function handleSave() {
    if (!fullName.trim()) { setError("Full name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      await CloudAPI.updateProfile({ fullName: fullName.trim(), username: uname.trim() || undefined });
      await refreshProfile();
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setFullName(user?.fullName ?? "");
    setUname(username ?? user?.username ?? "");
    setEditing(false);
    setError(null);
  }

  const ROW_ITEMS = [
    { label: "Email",           value: user?.email ?? "—",                  icon: "mail" as const },
    { label: "Role",            value: user?.role ?? "—",                   icon: "shield" as const },
    { label: "Plan",            value: user?.subscriptionTier ?? "Free",    icon: "star" as const },
    { label: "Email Verified",  value: user?.emailVerified ? "Yes ✓" : "Not verified", icon: "check-circle" as const },
    { label: "Member Since",    value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—", icon: "calendar" as const },
  ];

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        {editing ? (
          <TouchableOpacity onPress={cancelEdit}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Feather name="edit-2" size={18} color={C.accentL} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <LinearGradient colors={GRAD.primary} style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initials}</Text>
          </LinearGradient>
          <Text style={styles.displayName}>{user?.fullName ?? "LUMA User"}</Text>
          {(username ?? user?.username) && (
            <Text style={styles.usernameLabel}>@{username ?? user?.username}</Text>
          )}
          <View style={styles.rolePill}>
            <Text style={styles.roleTxt}>{user?.subscriptionTier ?? "Free"} · {user?.role ?? "User"}</Text>
          </View>
          {isSyncing && (
            <View style={styles.syncingRow}>
              <ActivityIndicator size="small" color={C.accentL} />
              <Text style={styles.syncingTxt}>Syncing…</Text>
            </View>
          )}
        </View>

        {/* Edit form */}
        {editing && (
          <View style={styles.editCard}>
            <Text style={styles.sectionLabel}>Edit Profile</Text>

            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={13} color={C.off} />
                <Text style={styles.errorTxt}>{error}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor={C.mute}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.unameWrap}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  value={uname}
                  onChangeText={t => setUname(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="your_username"
                  placeholderTextColor={C.mute}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={C.txt} size="small" />
                : <Text style={styles.saveTxt}>{saved ? "Saved ✓" : "Save Changes"}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Account info */}
        <Text style={styles.sectionLabel}>Account Details</Text>
        <View style={styles.infoCard}>
          {ROW_ITEMS.map((item, i) => (
            <View
              key={item.label}
              style={[styles.infoRow, i < ROW_ITEMS.length - 1 && styles.rowDivider]}
            >
              <View style={styles.infoIconWrap}>
                <Feather name={item.icon} size={14} color={C.accentL} />
              </View>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionLabel}>Account Actions</Text>
        <View style={styles.dangerCard}>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={() => router.push("/security-settings")}
          >
            <View style={[styles.dangerIcon, { backgroundColor: C.gold + "18" }]}>
              <Feather name="lock" size={16} color={C.gold} />
            </View>
            <View style={styles.dangerText}>
              <Text style={styles.dangerTitle}>Security Settings</Text>
              <Text style={styles.dangerDesc}>Password, sessions, 2FA</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.mute} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.dangerRow}
            onPress={() => router.push("/delete-account")}
          >
            <View style={[styles.dangerIcon, { backgroundColor: C.off + "18" }]}>
              <Feather name="trash-2" size={16} color={C.off} />
            </View>
            <View style={styles.dangerText}>
              <Text style={[styles.dangerTitle, { color: C.off }]}>Delete Account</Text>
              <Text style={styles.dangerDesc}>Permanently remove your account</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.mute} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  topBar:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center", marginRight: 12 },
  title:        { flex: 1, fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  cancelTxt:    { fontSize: 14, color: C.sec, fontFamily: "Inter_500Medium" },
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: 18, paddingTop: 20, gap: 0 },
  avatarCard:   { alignItems: "center", gap: 8, marginBottom: 28 },
  avatar:       { width: 88, height: 88, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarTxt:    { fontSize: 30, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
  displayName:  { fontSize: 22, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  usernameLabel:{ fontSize: 14, color: C.accentL, fontFamily: "Inter_500Medium" },
  rolePill:     { backgroundColor: C.accent + "22", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: C.accent + "40" },
  roleTxt:      { fontSize: 12, color: C.accentL, fontFamily: "Inter_600SemiBold" },
  syncingRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  syncingTxt:   { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.mute, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "Inter_700Bold", marginBottom: 10, marginTop: 6 },
  editCard:     { backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 16, gap: 14, marginBottom: 20 },
  errorBox:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.off + "15", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.off + "30" },
  errorTxt:     { fontSize: 12, color: C.off, flex: 1, fontFamily: "Inter_400Regular" },
  field:        { gap: 6 },
  fieldLabel:   { fontSize: 12, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  input:        { backgroundColor: C.card2, borderWidth: 1, borderColor: C.b0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  unameWrap:    { flexDirection: "row", alignItems: "center", backgroundColor: C.card2, borderWidth: 1, borderColor: C.b0, borderRadius: 10, overflow: "hidden" },
  atSign:       { paddingLeft: 12, fontSize: 14, color: C.accentL, fontFamily: "Inter_600SemiBold" },
  saveBtn:      { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  saveTxt:      { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  infoCard:     { backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 20 },
  infoRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 10 },
  rowDivider:   { borderBottomWidth: 1, borderBottomColor: C.b0 },
  infoIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.accent + "15", alignItems: "center", justifyContent: "center" },
  infoLabel:    { fontSize: 13, color: C.sec, flex: 1, fontFamily: "Inter_400Regular" },
  infoValue:    { fontSize: 13, color: C.txt, fontFamily: "Inter_500Medium", maxWidth: "50%" },
  dangerCard:   { backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 20 },
  dangerRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  dangerIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dangerText:   { flex: 1, gap: 2 },
  dangerTitle:  { fontSize: 14, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  dangerDesc:   { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
});
