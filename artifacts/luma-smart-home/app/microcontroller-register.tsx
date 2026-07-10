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
import { ESP32_MODELS, MC_CONNECTION_METHODS } from "@/data/luma-data";

export default function MicrocontrollerRegisterScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { addMicrocontroller } = useLuma();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [room, setRoom] = useState("");
  const [model, setModel] = useState(ESP32_MODELS[0]);
  const [firmware, setFirmware] = useState("v2.4.1");
  const [mac, setMac] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [connectionMethod, setConnectionMethod] = useState(MC_CONNECTION_METHODS[0]);
  const [wifiSsid, setWifiSsid] = useState("");

  function handleSave() {
    if (!name.trim()) { Alert.alert("Validation", "Module Name is required."); return; }
    if (!mac.trim()) { Alert.alert("Validation", "MAC Address is required."); return; }
    if (!deviceId.trim()) { Alert.alert("Validation", "Device ID is required."); return; }
    if (!secretKey.trim()) { Alert.alert("Validation", "Secret Key is required."); return; }
    if (connectionMethod === "Wi-Fi" && !wifiSsid.trim()) {
      Alert.alert("Validation", "Wi-Fi SSID is required for Wi-Fi connection."); return;
    }

    addMicrocontroller({
      name: name.trim(),
      description: description.trim(),
      room: room.trim(),
      model,
      firmware: firmware.trim() || "v2.4.1",
      mac: mac.trim(),
      deviceId: deviceId.trim(),
      secretKey: secretKey.trim(),
      connectionMethod,
      wifiSsid: wifiSsid.trim(),
      online: false,
      lastConnected: Date.now(),
      ipAddress: "—",
      cpuUsage: 0,
      memoryUsage: 0,
      flashUsage: 0,
      uptime: "—",
      restartCount: 0,
      temperature: 0,
      wifiSignal: -100,
      wifiChannel: 1,
      bluetoothEnabled: false,
      httpEnabled: true,
    });
    router.back();
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Register Microcontroller</Text>
          <Text style={styles.sub}>Add a new ESP32 to your network</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <SectionHeader title="General" icon="info" />
        <Field label="Module Name" required>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="e.g. Living Room Hub" placeholderTextColor={C.mute} />
        </Field>
        <Field label="Description">
          <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription}
            placeholder="Optional description" placeholderTextColor={C.mute} multiline numberOfLines={3} />
        </Field>
        <Field label="Room">
          <TextInput style={styles.input} value={room} onChangeText={setRoom}
            placeholder="e.g. Living Room" placeholderTextColor={C.mute} />
        </Field>

        <SectionHeader title="Hardware" icon="cpu" />
        <Field label="ESP32 Model">
          <View style={styles.chipRow}>
            {ESP32_MODELS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, model === m && styles.chipActive]}
                onPress={() => setModel(m)}
              >
                <Text style={[styles.chipText, model === m && styles.chipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>
        <Field label="Firmware Version">
          <TextInput style={styles.input} value={firmware} onChangeText={setFirmware}
            placeholder="e.g. v2.4.1" placeholderTextColor={C.mute} />
        </Field>
        <Field label="MAC Address" required>
          <TextInput style={styles.input} value={mac} onChangeText={setMac}
            placeholder="AA:BB:CC:DD:EE:FF" placeholderTextColor={C.mute}
            autoCapitalize="characters" />
        </Field>
        <Field label="Device ID" required>
          <TextInput style={styles.input} value={deviceId} onChangeText={setDeviceId}
            placeholder="e.g. MC-LR-001" placeholderTextColor={C.mute} />
        </Field>
        <Field label="Secret Key" required>
          <TextInput style={styles.input} value={secretKey} onChangeText={setSecretKey}
            placeholder="Unique secret for authentication" placeholderTextColor={C.mute}
            secureTextEntry />
        </Field>

        <SectionHeader title="Network" icon="wifi" />
        <Field label="Connection Method">
          <View style={styles.segmentRow}>
            {MC_CONNECTION_METHODS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.segment, connectionMethod === m && styles.segmentActive]}
                onPress={() => setConnectionMethod(m)}
              >
                <Text style={[styles.segmentText, connectionMethod === m && styles.segmentTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>
        {connectionMethod === "Wi-Fi" && (
          <Field label="Wi-Fi SSID" required>
            <TextInput style={styles.input} value={wifiSsid} onChangeText={setWifiSsid}
              placeholder="Network name" placeholderTextColor={C.mute} />
          </Field>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Feather name="check" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>Register Microcontroller</Text>
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
  content: { padding: 16, gap: 0, paddingBottom: 40 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 22, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.b0 },
  sectionHeaderText: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: "Inter_600SemiBold" },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: C.sec, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0 },
  chipActive: { backgroundColor: "#f97316" + "22", borderColor: "#f97316" + "60" },
  chipText: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  chipTextActive: { color: "#f97316", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  segmentRow: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  segmentActive: { backgroundColor: "#f97316" + "22", borderColor: "#f97316" + "60" },
  segmentText: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  segmentTextActive: { color: "#f97316", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#f97316", borderRadius: 14, paddingVertical: 15, marginTop: 24 },
  saveBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
});
