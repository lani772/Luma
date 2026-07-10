import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { ESP32_GPIO_PINS, MC_LAMP_ICONS, MC_STARTUP_STATES } from "@/data/luma-data";

export default function MCDeviceRegisterScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { mcId, gpio } = useLocalSearchParams<{ mcId: string; gpio?: string }>();
  const { microcontrollers, mcDevices, addMCDevice } = useLuma();

  const mc = microcontrollers.find(m => m.id === mcId);
  const assignedPins = mcDevices.filter(d => d.mcId === mcId).map(d => d.gpioPin);
  const availablePins = ESP32_GPIO_PINS.filter(p => !assignedPins.includes(p));

  function parsePinParam(raw: string | undefined): number | null {
    if (!raw) return availablePins[0] ?? null;
    const n = parseInt(raw, 10);
    if (isNaN(n) || !ESP32_GPIO_PINS.includes(n)) return availablePins[0] ?? null;
    return n;
  }

  const [lampName, setLampName] = useState("");
  const [description, setDescription] = useState("");
  const [room, setRoom] = useState(mc?.room ?? "");
  const [icon, setIcon] = useState("sun");
  const [gpioPin, setGpioPin] = useState<number | null>(parsePinParam(gpio));
  const [activeHigh, setActiveHigh] = useState(true);
  const [startupState, setStartupState] = useState<"on" | "off" | "restore">("off");

  function handleSave() {
    if (!lampName.trim()) { Alert.alert("Validation", "Lamp Name is required."); return; }
    if (gpioPin === null || !ESP32_GPIO_PINS.includes(gpioPin)) {
      Alert.alert("Validation", "Please select a valid GPIO pin.");
      return;
    }

    // Re-check availability at save time
    const stillAvailable = !mcDevices.some(d => d.mcId === mcId && d.gpioPin === gpioPin);
    if (!stillAvailable) {
      Alert.alert("GPIO Conflict", `GPIO ${gpioPin} is already assigned to another device.`);
      return;
    }

    addMCDevice({
      mcId: mcId!,
      name: lampName.trim(),
      description: description.trim(),
      room: room.trim(),
      icon,
      gpioPin,
      activeHigh,
      startupState,
      on: startupState === "on",
    });
    router.back();
  }

  if (!mc) {
    return (
      <View style={[styles.root, { paddingTop: topPad, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: C.mute }}>Microcontroller not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Register Device</Text>
          <Text style={styles.sub}>{mc.name}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <SectionHeader title="Lamp Info" icon="sun" />
        <Field label="Lamp Name" required>
          <TextInput style={styles.input} value={lampName} onChangeText={setLampName}
            placeholder="e.g. Ceiling Light" placeholderTextColor={C.mute} />
        </Field>
        <Field label="Description">
          <TextInput style={[styles.input, styles.textarea]} value={description}
            onChangeText={setDescription} placeholder="Optional description"
            placeholderTextColor={C.mute} multiline numberOfLines={2} />
        </Field>
        <Field label="Room">
          <TextInput style={styles.input} value={room} onChangeText={setRoom}
            placeholder="e.g. Living Room" placeholderTextColor={C.mute} />
        </Field>

        <SectionHeader title="Icon" icon="image" />
        <View style={styles.iconGrid}>
          {MC_LAMP_ICONS.map(ic => (
            <TouchableOpacity
              key={ic}
              style={[styles.iconOption, icon === ic && styles.iconOptionActive]}
              onPress={() => setIcon(ic)}
            >
              <Feather name={ic as any} size={20} color={icon === ic ? "#f97316" : C.mute} />
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title="GPIO Configuration" icon="sliders" />
        <Field label="GPIO Pin" required>
          {availablePins.length === 0 ? (
            <View style={styles.warnBox}>
              <Feather name="alert-circle" size={14} color={C.warn} />
              <Text style={{ fontSize: 12, color: C.warn, fontFamily: "Inter_400Regular" }}>
                All GPIO pins are already assigned.
              </Text>
            </View>
          ) : (
            <View style={styles.chipRow}>
              {availablePins.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pinChip, gpioPin === p && styles.pinChipActive]}
                  onPress={() => setGpioPin(p)}
                >
                  <Text style={[styles.pinChipText, gpioPin === p && styles.pinChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Field>
        {gpioPin !== null && assignedPins.includes(gpioPin) && (
          <View style={styles.warnBox}>
            <Feather name="alert-triangle" size={14} color={C.off} />
            <Text style={{ fontSize: 12, color: C.off, fontFamily: "Inter_400Regular" }}>
              GPIO {gpioPin} is already in use.
            </Text>
          </View>
        )}

        <SectionHeader title="Logic & Behavior" icon="settings" />
        <Field label="Active State">
          <View style={styles.segRow}>
            {[{ label: "Active HIGH", val: true }, { label: "Active LOW", val: false }].map(opt => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.seg, activeHigh === opt.val && styles.segActive]}
                onPress={() => setActiveHigh(opt.val)}
              >
                <Text style={[styles.segText, activeHigh === opt.val && styles.segTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helpText}>
            {activeHigh
              ? "GPIO HIGH = ON · GPIO LOW = OFF"
              : "GPIO LOW = ON · GPIO HIGH = OFF (relay default)"}
          </Text>
        </Field>
        <Field label="Startup State">
          <View style={styles.segRow}>
            {MC_STARTUP_STATES.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.seg, startupState === opt.value && styles.segActive]}
                onPress={() => setStartupState(opt.value)}
              >
                <Text style={[styles.segText, startupState === opt.value && styles.segTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Feather name="check" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>Register Device</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon as any} size={13} color={C.sec} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={{ color: C.off }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 22, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.b0 },
  sectionHeaderText: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: "Inter_600SemiBold" },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: C.sec, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  textarea: { minHeight: 60, textAlignVertical: "top" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  iconOption: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  iconOptionActive: { backgroundColor: "#f97316" + "20", borderColor: "#f97316" + "60" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pinChip: { width: 50, height: 40, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  pinChipActive: { backgroundColor: "#f97316" + "22", borderColor: "#f97316" + "60" },
  pinChipText: { fontSize: 13, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  pinChipTextActive: { color: "#f97316" },
  segRow: { flexDirection: "row", gap: 8 },
  seg: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  segActive: { backgroundColor: "#f97316" + "22", borderColor: "#f97316" + "60" },
  segText: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  segTextActive: { color: "#f97316", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  helpText: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 6 },
  warnBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.warn + "12", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.warn + "30" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#f97316", borderRadius: 14, paddingVertical: 15, marginTop: 24 },
  saveBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
});
