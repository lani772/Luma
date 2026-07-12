import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "@/constants/colors";
import { useCloudAuth } from "@/context/CloudAuthContext";

type Mode = "login" | "register";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useCloudAuth();

  const [mode, setMode]           = useState<Mode>("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [fullName, setFullName]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && !fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, fullName.trim());
      }
      router.replace("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "An error occurred.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={C.sec} />
        </TouchableOpacity>

        {/* Logo / brand */}
        <View style={styles.brandRow}>
          <View style={styles.logoCircle}>
            <Feather name="sun" size={28} color={C.accentL} />
          </View>
          <Text style={styles.brandTitle}>LUMA</Text>
          <Text style={styles.brandSub}>Smart Home Cloud</Text>
        </View>

        {/* Mode tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === "login" && styles.tabActive]}
            onPress={() => { setMode("login"); setError(null); }}
          >
            <Text style={[styles.tabTxt, mode === "login" && styles.tabTxtActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === "register" && styles.tabActive]}
            onPress={() => { setMode("register"); setError(null); }}
          >
            <Text style={[styles.tabTxt, mode === "register" && styles.tabTxtActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === "register" && (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={C.mute}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={C.mute}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passWrap}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
                placeholder="••••••••"
                placeholderTextColor={C.mute}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPass(v => !v)}
              >
                <Feather
                  name={showPass ? "eye-off" : "eye"}
                  size={18}
                  color={C.sec}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error != null && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={C.off} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.txt} size="small" />
            ) : (
              <Text style={styles.btnTxt}>
                {mode === "login" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {mode === "login"
            ? "Don't have an account? Tap Create Account above."
            : "Already have an account? Tap Sign In above."}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flexGrow: 1, paddingHorizontal: 24 },
  backBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center", marginBottom: 32 },
  brandRow:    { alignItems: "center", marginBottom: 36 },
  logoCircle:  { width: 72, height: 72, borderRadius: 22, backgroundColor: C.accent + "25", borderWidth: 1.5, borderColor: C.accent + "60", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  brandTitle:  { fontSize: 30, fontWeight: "700" as const, color: C.txt, letterSpacing: 3, fontFamily: "Inter_700Bold" },
  brandSub:    { fontSize: 13, color: C.sec, marginTop: 4, fontFamily: "Inter_400Regular" },
  tabRow:      { flexDirection: "row", backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, marginBottom: 28, padding: 4 },
  tab:         { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11 },
  tabActive:   { backgroundColor: C.accent },
  tabTxt:      { fontSize: 14, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  tabTxtActive:{ color: C.txt },
  form:        { gap: 18 },
  field:       { gap: 6 },
  label:       { fontSize: 13, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  input:       { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.txt, fontFamily: "Inter_400Regular" },
  passWrap:    { flexDirection: "row", alignItems: "center", backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 12, overflow: "hidden" },
  eyeBtn:      { paddingHorizontal: 14, paddingVertical: 13 },
  errorBox:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.off + "18", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.off + "40" },
  errorTxt:    { fontSize: 13, color: C.off, flex: 1, fontFamily: "Inter_400Regular" },
  btn:         { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  btnTxt:      { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  hint:        { marginTop: 28, textAlign: "center", fontSize: 13, color: C.mute, fontFamily: "Inter_400Regular" },
});
