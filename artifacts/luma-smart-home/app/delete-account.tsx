import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useCloudAuth } from "@/context/CloudAuthContext";

type Step = "confirm" | "verify" | "deleting";

const CONSEQUENCES = [
  { icon: "user-x",      text: "Your account and profile will be permanently deleted" },
  { icon: "shield-off",  text: "All authentication tokens and sessions will be revoked" },
  { icon: "mail",        text: "Pending invitations you sent or received will be cancelled" },
  { icon: "cpu",         text: "If you own microcontrollers, you must transfer or delete them first" },
  { icon: "database",    text: "All cloud backups tied to your account will be removed" },
  { icon: "alert-triangle", text: "This action is permanent and cannot be undone" },
];

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user, deleteAccount } = useCloudAuth();

  const [step, setStep]       = useState<Step>("confirm");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped]     = useState("");

  const CONFIRM_PHRASE = "DELETE MY ACCOUNT";

  async function handleDelete() {
    if (typed.trim() !== CONFIRM_PHRASE) {
      setError(`Type "${CONFIRM_PHRASE}" exactly to confirm`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await deleteAccount(password || undefined);
      router.replace("/login");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Deletion failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Delete Account</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning header */}
        <View style={styles.warnCard}>
          <View style={styles.warnIcon}>
            <Feather name="alert-triangle" size={28} color={C.off} />
          </View>
          <Text style={styles.warnTitle}>Permanent Account Deletion</Text>
          <Text style={styles.warnSub}>
            You are about to permanently delete{" "}
            <Text style={{ color: C.accentL }}>{user?.email}</Text>.
            This cannot be reversed.
          </Text>
        </View>

        {/* Consequences */}
        <Text style={styles.sectionLabel}>What Will Be Deleted</Text>
        <View style={styles.consequenceCard}>
          {CONSEQUENCES.map((c, i) => (
            <View key={i} style={[styles.consequenceRow, i < CONSEQUENCES.length - 1 && styles.divider]}>
              <View style={styles.cIcon}>
                <Feather name={c.icon as any} size={14} color={C.off} />
              </View>
              <Text style={styles.cText}>{c.text}</Text>
            </View>
          ))}
        </View>

        {/* Confirmation phrase */}
        <Text style={styles.sectionLabel}>Confirm Deletion</Text>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmInstr}>
            Type <Text style={{ color: C.off, fontFamily: "Inter_700Bold" }}>{CONFIRM_PHRASE}</Text> to proceed:
          </Text>
          <TextInput
            style={[styles.input, typed === CONFIRM_PHRASE && styles.inputMatch]}
            value={typed}
            onChangeText={t => { setTyped(t); setError(null); }}
            placeholder={CONFIRM_PHRASE}
            placeholderTextColor={C.mute}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text style={[styles.confirmInstr, { marginTop: 4 }]}>
            Enter your password to confirm (optional but recommended):
          </Text>
          <View style={styles.pwWrap}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0 }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              placeholder="Your password"
              placeholderTextColor={C.mute}
              autoComplete="current-password"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
              <Feather name={showPw ? "eye-off" : "eye"} size={16} color={C.sec} />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errBox}>
              <Feather name="alert-circle" size={12} color={C.off} />
              <Text style={styles.errTxt}>{error}</Text>
            </View>
          )}
        </View>

        {/* Delete button */}
        <TouchableOpacity
          style={[
            styles.deleteBtn,
            (typed !== CONFIRM_PHRASE || loading) && { opacity: 0.4 },
          ]}
          onPress={handleDelete}
          disabled={typed !== CONFIRM_PHRASE || loading}
        >
          {loading
            ? <ActivityIndicator color={C.txt} size="small" />
            : (
              <>
                <Feather name="trash-2" size={16} color={C.txt} />
                <Text style={styles.deleteTxt}>Permanently Delete My Account</Text>
              </>
            )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelTxt}>Cancel — Keep My Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.bg },
  topBar:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.b0, gap: 12 },
  backBtn:         { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title:           { fontSize: 18, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold", flex: 1 },
  scroll:          { flex: 1 },
  content:         { paddingHorizontal: 18, paddingTop: 20, gap: 0 },
  warnCard:        { backgroundColor: C.off + "10", borderRadius: 16, borderWidth: 1, borderColor: C.off + "35", padding: 20, alignItems: "center", gap: 10, marginBottom: 24 },
  warnIcon:        { width: 60, height: 60, borderRadius: 18, backgroundColor: C.off + "18", alignItems: "center", justifyContent: "center" },
  warnTitle:       { fontSize: 18, fontWeight: "700" as const, color: C.off, textAlign: "center", fontFamily: "Inter_700Bold" },
  warnSub:         { fontSize: 13, color: C.sec, textAlign: "center", lineHeight: 20, fontFamily: "Inter_400Regular" },
  sectionLabel:    { fontSize: 11, fontWeight: "700" as const, color: C.mute, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "Inter_700Bold", marginBottom: 10, marginTop: 4 },
  consequenceCard: { backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.b0, marginBottom: 20 },
  consequenceRow:  { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
  divider:         { borderBottomWidth: 1, borderBottomColor: C.b0 },
  cIcon:           { width: 28, height: 28, borderRadius: 8, backgroundColor: C.off + "15", alignItems: "center", justifyContent: "center" },
  cText:           { fontSize: 13, color: C.sec, flex: 1, lineHeight: 19, fontFamily: "Inter_400Regular" },
  confirmCard:     { backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 16, gap: 10, marginBottom: 24 },
  confirmInstr:    { fontSize: 13, color: C.sec, lineHeight: 20, fontFamily: "Inter_400Regular" },
  input:           { backgroundColor: C.card2, borderWidth: 1, borderColor: C.b0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  inputMatch:      { borderColor: C.on + "60" },
  pwWrap:          { flexDirection: "row", alignItems: "center", backgroundColor: C.card2, borderWidth: 1, borderColor: C.b0, borderRadius: 10, overflow: "hidden" },
  eyeBtn:          { paddingHorizontal: 12, paddingVertical: 11 },
  errBox:          { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.off + "15", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.off + "30" },
  errTxt:          { fontSize: 12, color: C.off, flex: 1, fontFamily: "Inter_400Regular" },
  deleteBtn:       { backgroundColor: C.off, borderRadius: 14, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  deleteTxt:       { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  cancelBtn:       { marginTop: 14, alignItems: "center", paddingVertical: 12 },
  cancelTxt:       { fontSize: 14, color: C.sec, fontFamily: "Inter_500Medium" },
});
