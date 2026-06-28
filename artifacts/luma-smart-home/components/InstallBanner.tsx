import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { C } from "@/constants/colors";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallBanner() {
  const { state, promptInstall, dismiss } = useInstallPrompt();
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === "available") {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else if (state === "dismissed" || state === "installed") {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 120, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  if (Platform.OS !== "web") return null;
  if (state !== "available") return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }], opacity }]}>
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>💡</Text>
        </View>
        <View>
          <Text style={styles.title}>Install LUMA</Text>
          <Text style={styles.sub}>Add to home screen for the full experience</Text>
        </View>
      </View>
      <View style={styles.right}>
        <TouchableOpacity style={styles.installBtn} onPress={promptInstall} activeOpacity={0.85}>
          <Feather name="download" size={13} color="#fff" />
          <Text style={styles.installText}>Install</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
          <Feather name="x" size={16} color={C.mute} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: C.elevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.accentL + "40",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.accent + "20", borderWidth: 1, borderColor: C.accent + "40", alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 18 },
  title: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  installBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  installText: { color: "#fff", fontSize: 12, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  closeBtn: { width: 28, height: 28, borderRadius: 99, backgroundColor: C.b1, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
});
