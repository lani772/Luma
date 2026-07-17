import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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

type Mode = "signin" | "signup";

// ── Validators ───────────────────────────────────────────────────────────────

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    ? null
    : "Enter a valid email address";
}

function validateUsername(v: string) {
  if (v.length < 3) return "Username must be at least 3 characters";
  if (v.length > 20) return "Username must be 20 characters or fewer";
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return "Only letters, numbers and _ allowed";
  return null;
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))   score++;
  const map = [
    { label: "Too short",   color: C.off },
    { label: "Weak",        color: C.off },
    { label: "Fair",        color: C.warn },
    { label: "Good",        color: C.on },
    { label: "Strong",      color: C.on },
  ] as const;
  return { score, ...map[score] };
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label, error, children,
}: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <View style={fld.wrap}>
      <Text style={fld.label}>{label}</Text>
      {children}
      {error != null && (
        <View style={fld.errRow}>
          <Feather name="alert-circle" size={12} color={C.off} />
          <Text style={fld.errTxt}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const fld = StyleSheet.create({
  wrap:   { gap: 5 },
  label:  { fontSize: 13, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  errRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5 },
  errTxt: { fontSize: 12, color: C.off, fontFamily: "Inter_400Regular" },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useCloudAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading]   = useState(false);
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Sign-in fields
  const [identifier, setIdentifier] = useState("");
  const [siPass, setSiPass]         = useState("");
  const [showSiPass, setShowSiPass] = useState(false);

  // Sign-up fields
  const [fullName, setFullName]     = useState("");
  const [username, setUsername]     = useState("");
  const [email, setEmail]           = useState("");
  const [suPass, setSuPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showSuPass, setShowSuPass]   = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // ── Derived state ─────────────────────────────────────────────────────────

  const siIdentErr  = submitted && !identifier.trim() ? "Email or username is required" : null;
  const siPassErr   = submitted && !siPass ? "Password is required" : null;

  const suNameErr   = submitted && !fullName.trim() ? "Full name is required" : null;
  const suUserErr   = submitted ? validateUsername(username) : null;
  const suEmailErr  = submitted ? validateEmail(email) : null;
  const strength    = passwordStrength(suPass);
  const suPassErr   = submitted && suPass.length < 8
    ? "Password must be at least 8 characters" : null;
  const suConfErr   = submitted && confirmPass !== suPass
    ? "Passwords do not match" : null;

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submit() {
    setSubmitted(true);
    setGlobalErr(null);

    if (mode === "signin") {
      if (!identifier.trim() || !siPass) return;
      setLoading(true);
      try {
        await login(identifier.trim(), siPass);
        router.replace("/");
      } catch (e: unknown) {
        setGlobalErr(e instanceof Error ? e.message : "Sign in failed. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      if (
        !fullName.trim() ||
        validateUsername(username) ||
        validateEmail(email) ||
        suPass.length < 8 ||
        confirmPass !== suPass
      ) return;
      setLoading(true);
      try {
        await register(email.trim(), suPass, fullName.trim(), username.trim().toLowerCase());
        router.replace("/no-devices");
      } catch (e: unknown) {
        setGlobalErr(e instanceof Error ? e.message : "Registration failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setSubmitted(false);
    setGlobalErr(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brandRow}>
          <View style={styles.logoCircle}>
            <Feather name="sun" size={30} color={C.accentL} />
          </View>
          <Text style={styles.brandTitle}>LUMA</Text>
          <Text style={styles.brandSub}>Smart Home Platform</Text>
        </View>

        {/* Mode tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === "signin" && styles.tabActive]}
            onPress={() => switchMode("signin")}
          >
            <Text style={[styles.tabTxt, mode === "signin" && styles.tabTxtActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === "signup" && styles.tabActive]}
            onPress={() => switchMode("signup")}
          >
            <Text style={[styles.tabTxt, mode === "signup" && styles.tabTxtActive]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Global error */}
        {globalErr != null && (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={C.off} />
            <Text style={styles.errorTxt}>{globalErr}</Text>
          </View>
        )}

        {/* ── SIGN IN FORM ── */}
        {mode === "signin" && (
          <View style={styles.form}>
            <Field label="Email or Username" error={siIdentErr}>
              <TextInput
                style={[styles.input, siIdentErr && styles.inputErr]}
                placeholder="you@example.com or username"
                placeholderTextColor={C.mute}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </Field>

            <Field label="Password" error={siPassErr}>
              <View style={[styles.passWrap, siPassErr && styles.inputErr]}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="••••••••"
                  placeholderTextColor={C.mute}
                  value={siPass}
                  onChangeText={setSiPass}
                  secureTextEntry={!showSiPass}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowSiPass(v => !v)}>
                  <Feather name={showSiPass ? "eye-off" : "eye"} size={17} color={C.sec} />
                </TouchableOpacity>
              </View>
            </Field>

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push("/forgot-password")}
            >
              <Text style={styles.forgotTxt}>Forgot your password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.txt} size="small" />
                : <Text style={styles.btnTxt}>Sign In</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── SIGN UP FORM ── */}
        {mode === "signup" && (
          <View style={styles.form}>
            <Field label="Full Name" error={suNameErr}>
              <TextInput
                style={[styles.input, suNameErr && styles.inputErr]}
                placeholder="Your full name"
                placeholderTextColor={C.mute}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </Field>

            <Field label="Username" error={suUserErr}>
              <View style={[styles.passWrap, suUserErr && styles.inputErr]}>
                <Text style={styles.prefix}>@</Text>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="your_username"
                  placeholderTextColor={C.mute}
                  value={username}
                  onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                {username.length >= 3 && !validateUsername(username) && (
                  <View style={styles.eyeBtn}>
                    <Feather name="check" size={15} color={C.on} />
                  </View>
                )}
              </View>
              <Text style={styles.hint}>Letters, numbers and _ · 3–20 characters</Text>
            </Field>

            <Field label="Email Address" error={suEmailErr}>
              <TextInput
                style={[styles.input, suEmailErr && styles.inputErr]}
                placeholder="you@example.com"
                placeholderTextColor={C.mute}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
            </Field>

            <Field label="Password" error={suPassErr}>
              <View style={[styles.passWrap, suPassErr && styles.inputErr]}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={C.mute}
                  value={suPass}
                  onChangeText={setSuPass}
                  secureTextEntry={!showSuPass}
                  returnKeyType="next"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowSuPass(v => !v)}>
                  <Feather name={showSuPass ? "eye-off" : "eye"} size={17} color={C.sec} />
                </TouchableOpacity>
              </View>
              {suPass.length > 0 && (
                <View style={styles.strengthRow}>
                  {[0, 1, 2, 3].map(i => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        { backgroundColor: i < strength.score ? strength.color : C.b1 },
                      ]}
                    />
                  ))}
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              )}
            </Field>

            <Field label="Confirm Password" error={suConfErr}>
              <View style={[styles.passWrap, suConfErr && styles.inputErr]}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  placeholder="Repeat password"
                  placeholderTextColor={C.mute}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry={!showConfirmPass}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPass(v => !v)}>
                  <Feather name={showConfirmPass ? "eye-off" : "eye"} size={17} color={C.sec} />
                </TouchableOpacity>
              </View>
            </Field>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.txt} size="small" />
                : <Text style={styles.btnTxt}>Create Account</Text>}
            </TouchableOpacity>

            <Text style={styles.legalTxt}>
              By creating an account you agree to LUMA's Terms of Service and Privacy Policy.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, paddingHorizontal: 24 },
  brandRow:       { alignItems: "center", marginBottom: 32 },
  logoCircle:     { width: 76, height: 76, borderRadius: 22, backgroundColor: C.accent + "22", borderWidth: 1.5, borderColor: C.accent + "55", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  brandTitle:     { fontSize: 32, fontWeight: "700" as const, color: C.txt, letterSpacing: 3, fontFamily: "Inter_700Bold" },
  brandSub:       { fontSize: 13, color: C.sec, marginTop: 4, fontFamily: "Inter_400Regular" },
  tabRow:         { flexDirection: "row", backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, marginBottom: 24, padding: 4 },
  tab:            { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11 },
  tabActive:      { backgroundColor: C.accent },
  tabTxt:         { fontSize: 14, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  tabTxtActive:   { color: C.txt },
  errorBox:       { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.off + "15", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.off + "35", marginBottom: 16 },
  errorTxt:       { fontSize: 13, color: C.off, flex: 1, fontFamily: "Inter_400Regular" },
  form:           { gap: 16 },
  input:          { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.txt, fontFamily: "Inter_400Regular" },
  inputErr:       { borderColor: C.off + "70" },
  passWrap:       { flexDirection: "row", alignItems: "center", backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 12, overflow: "hidden" },
  eyeBtn:         { paddingHorizontal: 13, paddingVertical: 13 },
  prefix:         { paddingLeft: 14, fontSize: 15, color: C.accentL, fontFamily: "Inter_600SemiBold" },
  forgotRow:      { alignSelf: "flex-end", marginTop: -4 },
  forgotTxt:      { fontSize: 13, color: C.accentL, fontFamily: "Inter_500Medium" },
  btn:            { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  btnTxt:         { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  strengthRow:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  strengthBar:    { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel:  { fontSize: 11, fontFamily: "Inter_500Medium", marginLeft: 4 },
  hint:           { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  legalTxt:       { fontSize: 11, color: C.mute, textAlign: "center", lineHeight: 16, fontFamily: "Inter_400Regular" },
});
