import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { CloudAPI } from "@/services/cloud-api";

type Step = "request" | "sent";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail]     = useState("");
  const [step, setStep]       = useState<Step>("request");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await CloudAPI.requestPasswordReset(trimmed);
      setStep("sent");
    } catch (e: unknown) {
      // Always show "sent" to avoid email enumeration
      setStep("sent");
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
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>

        {step === "request" ? (
          <>
            {/* Header */}
            <View style={styles.iconWrap}>
              <Feather name="lock" size={30} color={C.accentL} />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.sub}>
              Enter the email address linked to your LUMA account. We'll send you a reset link.
            </Text>

            {/* Email field */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, error && styles.inputErr]}
                placeholder="you@example.com"
                placeholderTextColor={C.mute}
                value={email}
                onChangeText={t => { setEmail(t); setError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              {error && (
                <View style={styles.errRow}>
                  <Feather name="alert-circle" size={12} color={C.off} />
                  <Text style={styles.errTxt}>{error}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.txt} size="small" />
                : <Text style={styles.btnTxt}>Send Reset Link</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Success state */}
            <View style={[styles.iconWrap, { backgroundColor: C.on + "18", borderColor: C.on + "40" }]}>
              <Feather name="mail" size={30} color={C.on} />
            </View>
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.sub}>
              If an account exists for <Text style={{ color: C.accentL }}>{email}</Text>, you'll receive
              a password reset link within a few minutes.
            </Text>

            <View style={styles.infoCard}>
              {[
                "Check your spam or junk folder",
                "The link expires in 30 minutes",
                "You can request a new link if needed",
              ].map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipDot} />
                  <Text style={styles.tipTxt}>{tip}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.btnTxt}>Back to Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep("request")}
            >
              <Text style={styles.secondaryTxt}>Try a different email</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flexGrow: 1, paddingHorizontal: 24 },
  backBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center", marginBottom: 32 },
  iconWrap:     { width: 72, height: 72, borderRadius: 22, backgroundColor: C.accent + "22", borderWidth: 1.5, borderColor: C.accent + "55", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title:        { fontSize: 24, fontWeight: "700" as const, color: C.txt, textAlign: "center", fontFamily: "Inter_700Bold", marginBottom: 10 },
  sub:          { fontSize: 14, color: C.sec, textAlign: "center", lineHeight: 22, fontFamily: "Inter_400Regular", marginBottom: 28 },
  fieldWrap:    { gap: 6, marginBottom: 20 },
  label:        { fontSize: 13, fontWeight: "600" as const, color: C.sec, fontFamily: "Inter_600SemiBold" },
  input:        { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.txt, fontFamily: "Inter_400Regular" },
  inputErr:     { borderColor: C.off + "70" },
  errRow:       { flexDirection: "row", alignItems: "center", gap: 5 },
  errTxt:       { fontSize: 12, color: C.off, fontFamily: "Inter_400Regular" },
  btn:          { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  btnTxt:       { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  secondaryBtn: { marginTop: 14, alignItems: "center", paddingVertical: 10 },
  secondaryTxt: { fontSize: 14, color: C.accentL, fontFamily: "Inter_500Medium" },
  infoCard:     { backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 16, gap: 10, marginBottom: 24 },
  tipRow:       { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tipDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accentL, marginTop: 6 },
  tipTxt:       { fontSize: 13, color: C.sec, flex: 1, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
