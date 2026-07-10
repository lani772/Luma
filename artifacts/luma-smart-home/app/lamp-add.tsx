import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";

const LAMP_COLOR = "#FBBF24";

const ROOMS = ["Living Room", "Bedroom", "Kitchen", "Entrance", "Study", "Garage", "Bathroom", "Office"];
const FLOORS = ["Ground Floor", "First Floor", "Second Floor", "Basement"];
const COLOR_PRESETS = [
  { label: "Warm White", hex: "#FFB77A" },
  { label: "Soft White", hex: "#FFF4E3" },
  { label: "Daylight", hex: "#FFFFFF" },
  { label: "Cool White", hex: "#CCE8FF" },
  { label: "Coral", hex: "#FF6B6B" },
  { label: "Cyan", hex: "#4ECDC4" },
  { label: "Blue", hex: "#45B7D1" },
  { label: "Green", hex: "#96CEB4" },
];
const COLOR_TEMP_PRESETS = [
  { label: "Candlelight", value: 2200 },
  { label: "Warm", value: 2700 },
  { label: "Neutral", value: 3500 },
  { label: "Cool", value: 4000 },
  { label: "Daylight", value: 5000 },
  { label: "Sunlight", value: 6500 },
];

export default function LampAddScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { addLamp } = useLuma();

  // Identity
  const [name, setName] = useState("");
  const [room, setRoom] = useState("Living Room");
  const [roomCustom, setRoomCustom] = useState("");
  const [useCustomRoom, setUseCustomRoom] = useState(false);
  const [floor, setFloor] = useState("Ground Floor");

  // Device
  const [deviceId, setDeviceId] = useState("");
  const [mac, setMac] = useState("");
  const [firmware, setFirmware] = useState("v2.4.1");
  const [mqttConnected, setMqttConnected] = useState(true);

  // Defaults
  const [initialOn, setInitialOn] = useState(false);
  const [brightness, setBrightness] = useState(80);
  const [colorTemp, setColorTemp] = useState(2700);
  const [rgb, setRgb] = useState("#FFB77A");

  const effectiveRoom = useCustomRoom ? roomCustom : room;

  function handleSave() {
    if (!name.trim()) { Alert.alert("Validation", "Lamp name is required."); return; }
    if (!deviceId.trim()) { Alert.alert("Validation", "Device ID is required."); return; }
    if (!mac.trim()) { Alert.alert("Validation", "MAC Address is required."); return; }
    if (useCustomRoom && !roomCustom.trim()) { Alert.alert("Validation", "Room name is required."); return; }

    addLamp({
      name: name.trim(),
      room: effectiveRoom.trim(),
      floor,
      deviceId: deviceId.trim(),
      mac: mac.trim(),
      mqttStatus: mqttConnected ? "connected" : "disconnected",
      online: false,
      lastSeen: Date.now(),
      firmware: firmware.trim() || "v2.4.1",
      on: initialOn,
      brightness,
      colorTemp,
      rgb,
      voltage: 0,
      current: 0,
      power: 0,
      energyToday: 0,
      costToday: 0,
      energyMonth: 0,
      costMonth: 0,
      schedules: [],
      activeTimer: null,
      lastCommand: initialOn ? "on" : "off",
      lastUpdate: Date.now(),
      health: {
        rssi: 0,
        signalQuality: 0,
        ip: "—",
        uptime: "—",
        restartCount: 0,
        cpu: 0,
        memory: 0,
      },
    });

    router.back();
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Add Lamp</Text>
          <Text style={styles.sub}>Register a new smart lamp to your home</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Identity ─────────────────────────────── */}
        <SectionHeader icon="tag" title="Identity" />

        <Field label="Lamp Name" required>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Living Room Ceiling"
            placeholderTextColor={C.mute}
          />
        </Field>

        <Field label="Room">
          <View style={styles.chipWrap}>
            {ROOMS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, !useCustomRoom && room === r && styles.chipActive]}
                onPress={() => { setRoom(r); setUseCustomRoom(false); }}
              >
                <Text style={[styles.chipText, !useCustomRoom && room === r && styles.chipTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, useCustomRoom && styles.chipActive]}
              onPress={() => setUseCustomRoom(true)}
            >
              <Feather name="edit-2" size={11} color={useCustomRoom ? LAMP_COLOR : C.mute} />
              <Text style={[styles.chipText, useCustomRoom && styles.chipTextActive]}>Custom</Text>
            </TouchableOpacity>
          </View>
          {useCustomRoom && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={roomCustom}
              onChangeText={setRoomCustom}
              placeholder="Enter room name"
              placeholderTextColor={C.mute}
              autoFocus
            />
          )}
        </Field>

        <Field label="Floor">
          <View style={styles.segRow}>
            {FLOORS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.seg, floor === f && styles.segActive]}
                onPress={() => setFloor(f)}
              >
                <Text style={[styles.segText, floor === f && styles.segTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        {/* ── Device ───────────────────────────────── */}
        <SectionHeader icon="cpu" title="Device" />

        <Field label="Device ID" required>
          <TextInput
            style={styles.input}
            value={deviceId}
            onChangeText={setDeviceId}
            placeholder="e.g. DEV-0A1B2C"
            placeholderTextColor={C.mute}
            autoCapitalize="characters"
          />
        </Field>

        <Field label="MAC Address" required>
          <TextInput
            style={styles.input}
            value={mac}
            onChangeText={setMac}
            placeholder="AA:BB:CC:DD:EE:FF"
            placeholderTextColor={C.mute}
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Firmware Version">
          <TextInput
            style={styles.input}
            value={firmware}
            onChangeText={setFirmware}
            placeholder="v2.4.1"
            placeholderTextColor={C.mute}
          />
        </Field>

        <Field label="MQTT Connection">
          <View style={styles.segRow}>
            {[{ label: "Connected", val: true }, { label: "Disconnected", val: false }].map(opt => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.seg, mqttConnected === opt.val && styles.segActive]}
                onPress={() => setMqttConnected(opt.val)}
              >
                <Text style={[styles.segText, mqttConnected === opt.val && styles.segTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        {/* ── Defaults ─────────────────────────────── */}
        <SectionHeader icon="sliders" title="Default Settings" />

        <Field label="Initial State">
          <View style={styles.segRow}>
            {[{ label: "Off", val: false }, { label: "On", val: true }].map(opt => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.seg, initialOn === opt.val && styles.segActive]}
                onPress={() => setInitialOn(opt.val)}
              >
                <Text style={[styles.segText, initialOn === opt.val && styles.segTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label={`Brightness — ${brightness}%`}>
          <View style={styles.sliderRow}>
            <TouchableOpacity
              style={styles.sliderBtn}
              onPress={() => setBrightness(b => Math.max(0, b - 10))}
            >
              <Feather name="minus" size={16} color={C.sec} />
            </TouchableOpacity>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${brightness}%`, backgroundColor: LAMP_COLOR }]} />
            </View>
            <TouchableOpacity
              style={styles.sliderBtn}
              onPress={() => setBrightness(b => Math.min(100, b + 10))}
            >
              <Feather name="plus" size={16} color={C.sec} />
            </TouchableOpacity>
          </View>
          <View style={styles.brightnessPresets}>
            {[10, 25, 50, 75, 100].map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.presetChip, brightness === v && styles.presetChipActive]}
                onPress={() => setBrightness(v)}
              >
                <Text style={[styles.presetChipText, brightness === v && styles.presetChipTextActive]}>{v}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Color Temperature">
          <View style={styles.colorTempRow}>
            {COLOR_TEMP_PRESETS.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[styles.ctChip, colorTemp === p.value && styles.ctChipActive]}
                onPress={() => setColorTemp(p.value)}
              >
                <Text style={[styles.ctLabel, colorTemp === p.value && styles.ctLabelActive]}>{p.label}</Text>
                <Text style={[styles.ctValue, colorTemp === p.value && { color: LAMP_COLOR }]}>{p.value}K</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Light Color">
          <View style={styles.colorGrid}>
            {COLOR_PRESETS.map(p => (
              <TouchableOpacity
                key={p.hex}
                style={[
                  styles.colorOption,
                  { backgroundColor: p.hex + "EE" },
                  rgb === p.hex && styles.colorOptionActive,
                ]}
                onPress={() => setRgb(p.hex)}
              >
                {rgb === p.hex && (
                  <View style={styles.colorCheck}>
                    <Feather name="check" size={10} color="#000" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.selectedColorRow}>
            <View style={[styles.selectedColorSwatch, { backgroundColor: rgb }]} />
            <Text style={styles.selectedColorLabel}>
              {COLOR_PRESETS.find(p => p.hex === rgb)?.label ?? "Custom"} · {rgb}
            </Text>
          </View>
        </Field>

        {/* Preview card */}
        <View style={styles.previewCard}>
          <View style={[styles.previewIcon, { backgroundColor: initialOn ? rgb + "30" : C.mute2 + "20", borderColor: initialOn ? rgb + "60" : C.mute2 + "30" }]}>
            <Feather name="zap" size={22} color={initialOn ? LAMP_COLOR : C.mute2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.previewName}>{name || "Lamp Name"}</Text>
            <Text style={styles.previewRoom}>{effectiveRoom} · {floor}</Text>
            <Text style={styles.previewStats}>{brightness}% · {colorTemp}K</Text>
          </View>
          <View style={[styles.previewBadge, { backgroundColor: initialOn ? C.on + "20" : C.mute2 + "20", borderColor: initialOn ? C.on + "40" : C.mute2 + "30" }]}>
            <Text style={[styles.previewBadgeText, { color: initialOn ? C.on : C.mute }]}>
              {initialOn ? "ON" : "OFF"}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Feather name="plus-circle" size={18} color="#000" />
          <Text style={styles.saveBtnText}>Add Lamp to Home</Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
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
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.b0 },
  sectionHeaderText: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: "Inter_600SemiBold" },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: C.sec, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  input: { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0 },
  chipActive: { backgroundColor: LAMP_COLOR + "20", borderColor: LAMP_COLOR + "55" },
  chipText: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  chipTextActive: { color: LAMP_COLOR, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  segRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seg: { flex: 1, minWidth: "22%", paddingVertical: 9, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  segActive: { backgroundColor: LAMP_COLOR + "20", borderColor: LAMP_COLOR + "55" },
  segText: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  segTextActive: { color: LAMP_COLOR, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sliderBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  sliderTrack: { flex: 1, height: 8, backgroundColor: C.elevated, borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: C.b0 },
  sliderFill: { height: "100%", borderRadius: 4 },
  brightnessPresets: { flexDirection: "row", gap: 6, marginTop: 10 },
  presetChip: { flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  presetChipActive: { backgroundColor: LAMP_COLOR + "20", borderColor: LAMP_COLOR + "50" },
  presetChipText: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  presetChipTextActive: { color: LAMP_COLOR, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  colorTempRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ctChip: { flex: 1, minWidth: "30%", alignItems: "center", gap: 2, paddingVertical: 8, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0 },
  ctChipActive: { backgroundColor: LAMP_COLOR + "18", borderColor: LAMP_COLOR + "50" },
  ctLabel: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  ctLabelActive: { color: LAMP_COLOR },
  ctValue: { fontSize: 12, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  colorOption: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  colorOptionActive: { borderWidth: 2.5, borderColor: "#fff" },
  colorCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  selectedColorRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.elevated, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.b0 },
  selectedColorSwatch: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: "#ffffff20" },
  selectedColorLabel: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  previewCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: LAMP_COLOR + "28", padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, marginBottom: 16 },
  previewIcon: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  previewName: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  previewRoom: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  previewStats: { fontSize: 11, color: C.mute2, fontFamily: "Inter_400Regular", marginTop: 1 },
  previewBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  previewBadgeText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: LAMP_COLOR, borderRadius: 14, paddingVertical: 15 },
  saveBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#000", fontFamily: "Inter_700Bold" },
});
