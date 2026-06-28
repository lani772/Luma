import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { C } from "@/constants/colors";
import { Lamp } from "@/data/luma-data";

interface TimerSheetProps {
  lamp: Lamp;
  visible: boolean;
  onClose: () => void;
  onSet: (ms: number, action: "on" | "off") => void;
}

const PRESETS = [
  { label: "15 min", ms: 900000 },
  { label: "30 min", ms: 1800000 },
  { label: "1 hour", ms: 3600000 },
  { label: "2 hours", ms: 7200000 },
];

export default function TimerSheet({ lamp, visible, onClose, onSet }: TimerSheetProps) {
  const [action, setAction] = useState<"on" | "off">("off");
  const [showCustom, setShowCustom] = useState(false);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");

  function handlePreset(ms: number) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSet(ms, action);
  }

  function handleCustom() {
    const ms = (parseInt(hours || "0") * 3600 + parseInt(minutes || "0") * 60) * 1000;
    if (ms <= 0) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSet(ms, action);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Set Timer</Text>
          <Text style={styles.sub}>{lamp.name}</Text>

          <Text style={styles.sectionLabel}>Action after timer</Text>
          <View style={styles.row}>
            {(["off", "on"] as const).map(a => (
              <TouchableOpacity key={a} style={[styles.actionBtn, action === a && { borderColor: a === "on" ? C.on : C.off, backgroundColor: a === "on" ? C.on + "18" : C.off + "18" }]} onPress={() => setAction(a)}>
                <Text style={[styles.actionBtnText, action === a && { color: a === "on" ? C.on : C.off }]}>
                  Turn {a.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.presetsGrid}>
            {PRESETS.map(p => (
              <TouchableOpacity key={p.ms} style={styles.presetBtn} onPress={() => handlePreset(p.ms)}>
                <Text style={styles.presetText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.customToggle} onPress={() => setShowCustom(!showCustom)}>
            <Text style={styles.customToggleText}>Custom time {showCustom ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {showCustom && (
            <View style={styles.customRow}>
              <View style={styles.customInput}>
                <Text style={styles.customLabel}>Hours</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="numeric"
                  value={hours}
                  onChangeText={setHours}
                  maxLength={2}
                  placeholderTextColor={C.mute}
                />
              </View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.customInput}>
                <Text style={styles.customLabel}>Minutes</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="numeric"
                  value={minutes}
                  onChangeText={setMinutes}
                  maxLength={2}
                  placeholderTextColor={C.mute}
                />
              </View>
              <TouchableOpacity style={styles.setBtn} onPress={handleCustom}>
                <Text style={styles.setBtnText}>SET</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.elevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.b0, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 99, backgroundColor: C.b0, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sub: { fontSize: 12, color: C.mute, marginBottom: 18, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 10, color: C.mute, fontWeight: "700" as const, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", gap: 10, marginBottom: 18 },
  actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: C.b0, alignItems: "center" },
  actionBtnText: { color: C.mute, fontWeight: "700" as const, fontSize: 13, fontFamily: "Inter_700Bold" },
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  presetBtn: { width: "47%", paddingVertical: 12, borderRadius: 12, backgroundColor: C.warn + "12", borderWidth: 1, borderColor: C.warn + "30", alignItems: "center" },
  presetText: { color: "#fde68a", fontWeight: "700" as const, fontSize: 13, fontFamily: "Inter_700Bold" },
  customToggle: { paddingVertical: 10, borderRadius: 12, backgroundColor: C.accentL + "10", borderWidth: 1, borderColor: C.accentL + "25", alignItems: "center", marginBottom: 10 },
  customToggleText: { color: C.accentL, fontWeight: "700" as const, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  customRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginBottom: 16 },
  customInput: { flex: 1 },
  customLabel: { fontSize: 10, color: C.mute, marginBottom: 4, fontFamily: "Inter_400Regular" },
  numInput: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.b0, borderRadius: 10, padding: 10, color: C.txt, fontSize: 20, fontWeight: "700" as const, textAlign: "center", fontFamily: "Inter_700Bold" },
  colon: { fontSize: 24, color: C.mute, paddingBottom: 10 },
  setBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: C.on, alignItems: "center", justifyContent: "center" },
  setBtnText: { color: "#fff", fontWeight: "800" as const, fontSize: 13, fontFamily: "Inter_700Bold" },
  cancelBtn: { paddingVertical: 13, borderRadius: 12, backgroundColor: C.b1, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  cancelText: { color: C.mute, fontWeight: "700" as const, fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
