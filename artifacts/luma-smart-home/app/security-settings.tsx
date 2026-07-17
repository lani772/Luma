import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { CloudAPI, type CloudSession } from "@/services/cloud-api";

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Row({
  icon, iconColor = C.accentL, title, sub, onPress, danger = false, rightEl,
}: {
  icon: string; iconColor?: string; title: string; sub?: string;
  onPress?: () => void; danger?: boolean; rightEl?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <View style={[styles.rowIcon, { backgroundColor: iconColor + "18" }]}>
        <Feather name={icon as any} size={16} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, danger && { color: C.off }]}>{title}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {rightEl ?? (onPress ? <Feather name="chevron-right" size={16} color={C.mute} /> : null)}
    </TouchableOpacity>
  );
}

export default function SecuritySettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [sessions, setSessions]       = useState<CloudSession[]>([]);
  const [loadSess, setLoadSess]       = useState(true);
  const [revoking, setRevoking]       = useState<string | null>(null);

  // Change password state
  const [showPwForm, setShowPwForm]   = useState(false);
  const [currPw, setCurrPw]           = useState("");
  const [newPw, setNewPw]             = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [pwSaving, setPwSaving]       = useState(false);
  const [pwError, setPwError]         = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]     = useState(false);

  useEffect(() => {
    CloudAPI.getSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadSess(false));
  }, []);

  async function revokeSession(id: string) {
    setRevoking(id);
    try {
      await CloudAPI.revokeSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {
      Alert.alert("Error", "Could not revoke session. Please try again.");
    } finally {
      setRevoking(null);
    }
  }

  async function revokeAll() {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Sign Out All Devices",
        "This will sign you out of every device except this one.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Out All", style: "destructive", onPress: doRevokeAll },
        ],
      );
    } else {
      doRevokeAll();
    }
  }

  async function doRevokeAll() {
    setRevoking("all");
    try {
      await CloudAPI.revokeAllOtherSessions();
      setSessions(prev => prev.filter(s => s.current));
    } catch {
      Alert.alert("Error", "Could not revoke sessions.");
    } finally {
      setRevoking(null);
    }
  }

  async function changePassword() {
    setPwError(null);
    if (!currPw) { setPwError("Current password is required"); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    setPwSaving(true);
    try {
      await CloudAPI.changePassword(currPw, newPw);
      setPwSuccess(true);
      setCurrPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setPwSuccess(false); setShowPwForm(false); }, 2000);
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  }

  const otherSessions = sessions.filter(s => !s.current);
  const currentSession = sessions.find(s => s.current);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Security</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Password */}
        <SectionLabel>Password</SectionLabel>
        <View style={styles.card}>
          <Row
            icon="key"
            title="Change Password"
            sub="Update your account password"
            onPress={() => setShowPwForm(v => !v)}
          />
          {showPwForm && (
            <View style={styles.pwForm}>
              {pwError && (
                <View style={styles.errBox}>
                  <Feather name="alert-circle" size={12} color={C.off} />
                  <Text style={styles.errTxt}>{pwError}</Text>
                </View>
              )}
              {pwSuccess && (
                <View style={[styles.errBox, { backgroundColor: C.on + "15", borderColor: C.on + "30" }]}>
                  <Feather name="check" size={12} color={C.on} />
                  <Text style={[styles.errTxt, { color: C.on }]}>Password changed successfully</Text>
                </View>
              )}
              {[
                { label: "Current Password", value: currPw, setter: setCurrPw, complete: "current-password" },
                { label: "New Password",     value: newPw,  setter: setNewPw,  complete: "new-password" },
                { label: "Confirm New Password", value: confirmPw, setter: setConfirmPw, complete: "new-password" },
              ].map(f => (
                <View key={f.label} style={styles.pwField}>
                  <Text style={styles.pwLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={f.value}
                    onChangeText={f.setter}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor={C.mute}
                    autoComplete={f.complete as any}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveBtn, pwSaving && { opacity: 0.6 }]}
                onPress={changePassword}
                disabled={pwSaving}
              >
                {pwSaving
                  ? <ActivityIndicator color={C.txt} size="small" />
                  : <Text style={styles.saveTxt}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sessions */}
        <SectionLabel>Active Sessions</SectionLabel>
        <View style={styles.card}>
          {loadSess ? (
            <View style={styles.loadRow}>
              <ActivityIndicator size="small" color={C.accentL} />
              <Text style={styles.loadTxt}>Loading sessions…</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyTxt}>No session data available</Text>
            </View>
          ) : (
            <>
              {currentSession && (
                <View style={styles.sessionRow}>
                  <View style={[styles.sessionIcon, { backgroundColor: C.on + "18" }]}>
                    <Feather name="smartphone" size={15} color={C.on} />
                  </View>
                  <View style={styles.sessionText}>
                    <Text style={styles.sessionDevice}>{currentSession.deviceName} <Text style={styles.currentBadge}> This device </Text></Text>
                    <Text style={styles.sessionTime}>{currentSession.platform} · Active now</Text>
                  </View>
                </View>
              )}
              {otherSessions.map(s => (
                <View key={s.id} style={styles.sessionRow}>
                  <View style={styles.sessionIcon}>
                    <Feather name="monitor" size={15} color={C.sec} />
                  </View>
                  <View style={styles.sessionText}>
                    <Text style={styles.sessionDevice}>{s.deviceName}</Text>
                    <Text style={styles.sessionTime}>
                      {s.platform} · Last active {new Date(s.lastUsedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => revokeSession(s.id)}
                    disabled={revoking === s.id}
                    style={styles.revokeBtn}
                  >
                    {revoking === s.id
                      ? <ActivityIndicator size="small" color={C.off} />
                      : <Text style={styles.revokeTxt}>Revoke</Text>}
                  </TouchableOpacity>
                </View>
              ))}
              {otherSessions.length > 0 && (
                <TouchableOpacity
                  style={styles.revokeAllBtn}
                  onPress={revokeAll}
                  disabled={revoking === "all"}
                >
                  {revoking === "all"
                    ? <ActivityIndicator size="small" color={C.off} />
                    : <Text style={styles.revokeAllTxt}>Sign out all other devices</Text>}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Danger */}
        <SectionLabel>Danger Zone</SectionLabel>
        <View style={styles.card}>
          <Row
            icon="trash-2"
            iconColor={C.off}
            title="Delete Account"
            sub="Permanently remove all your data"
            onPress={() => router.push("/delete-account")}
            danger
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  topBar:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.b0, gap: 12 },
  backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title:         { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", flex: 1 },
  scroll:        { flex: 1 },
  content:       { paddingHorizontal: 18, paddingTop: 20, gap: 0 },
  sectionLabel:  { fontSize: 11, fontWeight: "700" as const, color: C.mute, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "Inter_700Bold", marginBottom: 10, marginTop: 8 },
  card:          { backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 16, overflow: "hidden" },
  row:           { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rowIcon:       { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText:       { flex: 1, gap: 2 },
  rowTitle:      { fontSize: 14, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  rowSub:        { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  pwForm:        { borderTopWidth: 1, borderTopColor: C.b0, padding: 14, gap: 12 },
  errBox:        { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.off + "15", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.off + "30" },
  errTxt:        { fontSize: 12, color: C.off, flex: 1, fontFamily: "Inter_400Regular" },
  pwField:       { gap: 5 },
  pwLabel:       { fontSize: 12, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  input:         { backgroundColor: C.card2, borderWidth: 1, borderColor: C.b0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  saveBtn:       { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveTxt:       { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  loadRow:       { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  loadTxt:       { fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  emptyRow:      { padding: 16 },
  emptyTxt:      { fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  sessionRow:    { flexDirection: "row", alignItems: "center", padding: 14, borderTopWidth: 1, borderTopColor: C.b0, gap: 12 },
  sessionIcon:   { width: 34, height: 34, borderRadius: 10, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.b0 },
  sessionText:   { flex: 1, gap: 2 },
  sessionDevice: { fontSize: 13, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  sessionTime:   { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  currentBadge:  { fontSize: 10, color: C.on, fontFamily: "Inter_600SemiBold", backgroundColor: C.on + "20" },
  revokeBtn:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.off + "15", borderWidth: 1, borderColor: C.off + "30" },
  revokeTxt:     { fontSize: 12, color: C.off, fontFamily: "Inter_600SemiBold" },
  revokeAllBtn:  { margin: 14, marginTop: 0, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.off + "35", alignItems: "center" },
  revokeAllTxt:  { fontSize: 13, color: C.off, fontFamily: "Inter_600SemiBold" },
});
