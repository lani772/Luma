import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { CloudAPI } from "@/services/cloud-api";
import { useCloudAuth } from "@/context/CloudAuthContext";

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useCloudAuth();

  const [resending, setResending] = useState(false);
  const [resent, setResent]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function resendEmail() {
    setResending(true);
    setError(null);
    try {
      await CloudAPI.resendVerificationEmail();
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send verification email");
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Feather name="chevron-left" size={22} color={C.sec} />
      </TouchableOpacity>

      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Feather name="mail" size={36} color={C.accentL} />
        </View>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.sub}>
          We sent a verification link to{"\n"}
          <Text style={styles.email}>{user?.email ?? "your email address"}</Text>
        </Text>

        <View style={styles.steps}>
          {[
            "Open the email from LUMA",
            "Click the verification link",
            "Return to the app",
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumTxt}>{i + 1}</Text>
              </View>
              <Text style={styles.stepTxt}>{step}</Text>
            </View>
          ))}
        </View>

        {error && (
          <View style={styles.errBox}>
            <Feather name="alert-circle" size={13} color={C.off} />
            <Text style={styles.errTxt}>{error}</Text>
          </View>
        )}

        {resent && (
          <View style={[styles.errBox, { backgroundColor: C.on + "15", borderColor: C.on + "30" }]}>
            <Feather name="check" size={13} color={C.on} />
            <Text style={[styles.errTxt, { color: C.on }]}>Verification email sent!</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.resendBtn, resending && { opacity: 0.6 }]}
          onPress={resendEmail}
          disabled={resending}
        >
          {resending
            ? <ActivityIndicator size="small" color={C.txt} />
            : <Text style={styles.resendTxt}>Resend Verification Email</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace("/")}>
          <Text style={styles.skipTxt}>Continue to App →</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Check your spam folder if you don't see it within a few minutes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 },
  backBtn:    { width: 40, height: 40, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 16 },
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingBottom: 40 },
  iconWrap:   { width: 88, height: 88, borderRadius: 26, backgroundColor: C.accent + "20", borderWidth: 1.5, borderColor: C.accent + "50", alignItems: "center", justifyContent: "center" },
  title:      { fontSize: 26, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub:        { fontSize: 15, color: C.sec, textAlign: "center", lineHeight: 24, fontFamily: "Inter_400Regular" },
  email:      { color: C.accentL, fontFamily: "Inter_600SemiBold" },
  steps:      { gap: 12, alignSelf: "stretch" },
  stepRow:    { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 14 },
  stepNum:    { width: 28, height: 28, borderRadius: 8, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  stepNumTxt: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  stepTxt:    { fontSize: 14, color: C.txt, flex: 1, fontFamily: "Inter_500Medium" },
  errBox:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.off + "15", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.off + "30", alignSelf: "stretch" },
  errTxt:     { fontSize: 13, color: C.off, flex: 1, fontFamily: "Inter_400Regular" },
  resendBtn:  { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: "center", alignSelf: "stretch" },
  resendTxt:  { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  skipBtn:    { paddingVertical: 10 },
  skipTxt:    { fontSize: 14, color: C.accentL, fontFamily: "Inter_500Medium" },
  note:       { fontSize: 12, color: C.mute, textAlign: "center", fontFamily: "Inter_400Regular" },
});
