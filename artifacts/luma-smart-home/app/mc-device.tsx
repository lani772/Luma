import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { MC_LAMP_ICONS, MC_STARTUP_STATES, timeAgo } from "@/data/luma-data";

export default function MCDeviceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { mcId, deviceId } = useLocalSearchParams<{ mcId: string; deviceId: string }>();
  const { microcontrollers, mcDevices, toggleMCDevice, updateMCDevice, deleteMCDevice } = useLuma();

  const mc = microcontrollers.find(m => m.id === mcId);
  const device = mcDevices.find(d => d.id === deviceId);

  const [editName, setEditName] = useState(device?.name ?? "");
  const [editDesc, setEditDesc] = useState(device?.description ?? "");
  const [editRoom, setEditRoom] = useState(device?.room ?? "");
  const [editIcon, setEditIcon] = useState(device?.icon ?? "sun");
  const [editActiveHigh, setEditActiveHigh] = useState(device?.activeHigh ?? true);
  const [editStartup, setEditStartup] = useState<"on" | "off" | "restore">(device?.startupState ?? "off");
  const [saved, setSaved] = useState(false);

  if (!mc || !device) {
    return (
      <View style={[styles.root, { paddingTop: topPad, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: C.mute, fontFamily: "Inter_400Regular" }}>Device not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: C.accentL, fontFamily: "Inter_700Bold" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function handleSave() {
    if (!editName.trim()) { Alert.alert("Validation", "Lamp name cannot be empty."); return; }
    updateMCDevice(device!.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      room: editRoom.trim(),
      icon: editIcon,
      activeHigh: editActiveHigh,
      startupState: editStartup,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleDelete() {
    Alert.alert(
      "Delete Device",
      `Remove "${device!.name}" from ${mc!.name}? GPIO ${device!.gpioPin} will be released.`,
      [
        { text: "Cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: () => { deleteMCDevice(device!.id); router.back(); },
        },
      ]
    );
  }

  const gpioCmd = device.activeHigh
    ? { on: `digitalWrite(${device.gpioPin}, HIGH)`, off: `digitalWrite(${device.gpioPin}, LOW)` }
    : { on: `digitalWrite(${device.gpioPin}, LOW)`, off: `digitalWrite(${device.gpioPin}, HIGH)` };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{device.name}</Text>
          <Text style={styles.sub}>{mc.name} · GPIO {device.gpioPin}</Text>
        </View>
        <Switch
          value={device.on}
          onValueChange={() => toggleMCDevice(device.id)}
          trackColor={{ false: C.mute2, true: C.on + "80" }}
          thumbColor={device.on ? C.on : C.sec}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Status card */}
        <View style={[styles.statusCard, { borderColor: device.on ? C.on + "30" : C.b0 }]}>
          <View style={[styles.statusIconBox, { backgroundColor: (device.on ? C.on : C.mute2) + "20", borderColor: (device.on ? C.on : C.mute2) + "40" }]}>
            <Feather name={device.icon as any} size={26} color={device.on ? C.on : C.mute2} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.statusName}>{device.name}</Text>
            <Text style={styles.statusRoom}>{device.room}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, { backgroundColor: device.on ? C.on + "20" : C.mute2 + "20", borderColor: device.on ? C.on + "40" : C.mute2 + "30" }]}>
                <View style={[styles.statusDot, { backgroundColor: device.on ? C.on : C.mute2 }]} />
                <Text style={[styles.statusPillText, { color: device.on ? C.on : C.mute }]}>{device.on ? "ON" : "OFF"}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: mc.online ? C.on + "18" : C.off + "18", borderColor: mc.online ? C.on + "40" : C.off + "35", marginLeft: 6 }]}>
                <View style={[styles.statusDot, { backgroundColor: mc.online ? C.on : C.off }]} />
                <Text style={[styles.statusPillText, { color: mc.online ? C.on : C.off }]}>{mc.online ? "MC Online" : "MC Offline"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* GPIO info */}
        <Text style={styles.sLabel}>GPIO Details</Text>
        <View style={styles.card}>
          <InfoRow icon="sliders" label="GPIO Pin" value={`GPIO ${device.gpioPin}`} />
          <Divider />
          <InfoRow icon="zap" label="Logic" value={device.activeHigh ? "Active HIGH" : "Active LOW"} />
          <Divider />
          <InfoRow icon="terminal" label="ON command" value={gpioCmd.on} mono />
          <Divider />
          <InfoRow icon="terminal" label="OFF command" value={gpioCmd.off} mono />
          <Divider />
          <InfoRow icon="clock" label="Startup State" value={device.startupState === "on" ? "Always ON" : device.startupState === "off" ? "Always OFF" : "Restore Previous"} />
          <Divider />
          <InfoRow icon="cpu" label="Microcontroller" value={device.mcName ?? mc.name} />
          <Divider />
          <InfoRow icon="calendar" label="Registered" value={device.registrationDate ? new Date(device.registrationDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
          <Divider />
          <InfoRow icon="refresh-cw" label="Last Updated" value={device.lastUpdated ? timeAgo(device.lastUpdated) : "—"} />
        </View>

        {/* Edit Settings */}
        <Text style={styles.sLabel}>Settings</Text>
        <View style={styles.card}>
          <FieldLabel label="Lamp Name" />
          <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholderTextColor={C.mute} />

          <FieldLabel label="Description" />
          <TextInput style={[styles.input, { minHeight: 58, textAlignVertical: "top" }]} value={editDesc} onChangeText={setEditDesc} placeholderTextColor={C.mute} multiline />

          <FieldLabel label="Room" />
          <TextInput style={styles.input} value={editRoom} onChangeText={setEditRoom} placeholderTextColor={C.mute} />

          <FieldLabel label="Icon" />
          <View style={styles.iconGrid}>
            {MC_LAMP_ICONS.map(ic => (
              <TouchableOpacity
                key={ic}
                style={[styles.iconOption, editIcon === ic && styles.iconOptionActive]}
                onPress={() => setEditIcon(ic)}
              >
                <Feather name={ic as any} size={18} color={editIcon === ic ? "#f97316" : C.mute} />
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel label="Active State" />
          <View style={styles.segRow}>
            {[{ label: "Active HIGH", val: true }, { label: "Active LOW", val: false }].map(opt => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.seg, editActiveHigh === opt.val && styles.segActive]}
                onPress={() => setEditActiveHigh(opt.val)}
              >
                <Text style={[styles.segText, editActiveHigh === opt.val && styles.segTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FieldLabel label="Startup State" />
          <View style={styles.segRow}>
            {MC_STARTUP_STATES.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.seg, editStartup === opt.value && styles.segActive]}
                onPress={() => setEditStartup(opt.value)}
              >
                <Text style={[styles.segText, editStartup === opt.value && styles.segTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saved && { backgroundColor: C.on }]} onPress={handleSave} activeOpacity={0.8}>
          <Feather name={saved ? "check" : "save"} size={16} color="#fff" />
          <Text style={styles.saveBtnText}>{saved ? "Saved!" : "Save Changes"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
          <Feather name="trash-2" size={16} color={C.off} />
          <Text style={styles.deleteBtnText}>Delete Device</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: string; label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Feather name={icon as any} size={13} color={C.mute} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.mono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.b0 }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10 },
  statusCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  statusIconBox: { width: 58, height: 58, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statusName: { fontSize: 17, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  statusRoom: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular" },
  statusRow: { flexDirection: "row", marginTop: 4 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  sLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.3, marginTop: 6, fontFamily: "Inter_600SemiBold" },
  card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14, gap: 10 },
  infoLabel: { flex: 1, fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", textAlign: "right", maxWidth: "58%" },
  mono: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.teal },
  fieldLabel: { fontSize: 11, color: C.sec, fontFamily: "Inter_600SemiBold", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconOption: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  iconOptionActive: { backgroundColor: "#f97316" + "20", borderColor: "#f97316" + "60" },
  segRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  segActive: { backgroundColor: "#f97316" + "20", borderColor: "#f97316" + "50" },
  segText: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  segTextActive: { color: "#f97316", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#f97316", borderRadius: 13, paddingVertical: 13, marginTop: 6 },
  saveBtnText: { fontSize: 14, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 13, paddingVertical: 13, borderWidth: 1, borderColor: C.off + "40", backgroundColor: C.off + "10", marginTop: 4 },
  deleteBtnText: { fontSize: 14, fontWeight: "700" as const, color: C.off, fontFamily: "Inter_700Bold" },
});
