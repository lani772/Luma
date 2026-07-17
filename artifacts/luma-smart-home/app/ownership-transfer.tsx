import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { CloudAPI, type CloudDevice } from "@/services/cloud-api";

export default function OwnershipTransferScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const params  = useLocalSearchParams<{ deviceId?: string }>();

  const [devices, setDevices]             = useState<CloudDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(params.deviceId ?? "");
  const [toEmail, setToEmail]             = useState("");
  const [keepAdmin, setKeepAdmin]         = useState(true);
  const [loading, setLoading]             = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState(false);

  useEffect(() => {
    CloudAPI.getDevices()
      .then(d => setDevices(d.filter(dev => dev.status === "active")))
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false));
  }, []);

  async function handleTransfer() {
    setError(null);
    if (!selectedDevice) { setError("Select a microcontroller to transfer"); return; }
    if (!toEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim())) {
      setError("Enter a valid email address for the new owner");
      return;
    }

    if (Platform.OS !== "web") {
      Alert.alert(
        "Confirm Ownership Transfer",
        `Transfer "${devices.find(d => d.id === selectedDevice)?.name}" to ${toEmail.trim()}?\n\nThis cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Transfer", style: "destructive", onPress: doTransfer },
        ],
      );
    } else {
      doTransfer();
    }
  }

  async function doTransfer() {
    setLoading(true);
    try {
      await CloudAPI.transferOwnership(selectedDevice, toEmail.trim(), keepAdmin);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transfer failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const device = devices.find(d => d.id === selectedDevice);

  if (success) {
    return (
      <View style={[styles.root, { paddingTop: topPad }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color={C.sec} />
          </TouchableOpacity>
          <Text style={styles.title}>Ownership Transfer</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={48} color={C.on} />
          </View>
          <Text style={styles.successTitle}>Transfer Initiated</Text>
          <Text style={styles.successSub}>
            An invitation has been sent to <Text style={{ color: C.accentL }}>{toEmail}</Text>.
            Ownership will transfer once they accept.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>Transfer Ownership</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Feather name="info" size={14} color={C.gold} />
          <Text style={styles.infoTxt}>
            Transferring ownership gives full control of the microcontroller to the new owner.
            You can choose to remain as an administrator.
          </Text>
        </View>

        {/* Device selector */}
        <Text style={styles.sectionLabel}>Select Microcontroller</Text>
        {loadingDevices ? (
          <View style={styles.loadRow}>
            <ActivityIndicator size="small" color={C.accentL} />
            <Text style={styles.loadTxt}>Loading your devices…</Text>
          </View>
        ) : devices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>No owned microcontrollers found.</Text>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {devices.map(dev => (
              <TouchableOpacity
                key={dev.id}
                style={[
                  styles.deviceCard,
                  selectedDevice === dev.id && styles.deviceCardSelected,
                ]}
                onPress={() => setSelectedDevice(dev.id)}
              >
                <View style={styles.deviceIconWrap}>
                  <Feather name="cpu" size={18} color={selectedDevice === dev.id ? C.accentL : C.sec} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{dev.name}</Text>
                  <Text style={styles.deviceMeta}>{dev.model} · {dev.mac}</Text>
                </View>
                <View style={[
                  styles.radioOuter,
                  selectedDevice === dev.id && styles.radioOuterActive,
                ]}>
                  {selectedDevice === dev.id && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* New owner email */}
        <Text style={styles.sectionLabel}>New Owner Email</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="newowner@example.com"
            placeholderTextColor={C.mute}
            value={toEmail}
            onChangeText={t => { setToEmail(t); setError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Text style={styles.fieldNote}>
            The new owner will receive an email invitation. Ownership transfers upon acceptance.
          </Text>
        </View>

        {/* Keep admin toggle */}
        <Text style={styles.sectionLabel}>Your Role After Transfer</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setKeepAdmin(v => !v)}
          >
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Remain as Administrator</Text>
              <Text style={styles.toggleSub}>
                Keep admin access to this microcontroller after the transfer
              </Text>
            </View>
            <View style={[styles.toggle, keepAdmin && styles.toggleOn]}>
              <View style={[styles.toggleThumb, keepAdmin && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errBox}>
            <Feather name="alert-circle" size={13} color={C.off} />
            <Text style={styles.errTxt}>{error}</Text>
          </View>
        )}

        {/* Transfer button */}
        <TouchableOpacity
          style={[styles.transferBtn, (loading || !selectedDevice || !toEmail) && { opacity: 0.5 }]}
          onPress={handleTransfer}
          disabled={loading || !selectedDevice || !toEmail.trim()}
        >
          {loading
            ? <ActivityIndicator color={C.txt} size="small" />
            : (
              <>
                <Feather name="send" size={16} color={C.txt} />
                <Text style={styles.transferTxt}>Initiate Transfer</Text>
              </>
            )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.bg },
  topBar:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.b0, gap: 12 },
  backBtn:            { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title:              { fontSize: 18, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", flex: 1 },
  scroll:             { flex: 1 },
  content:            { paddingHorizontal: 18, paddingTop: 20, gap: 0 },
  infoBanner:         { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.gold + "15", borderRadius: 12, borderWidth: 1, borderColor: C.gold + "35", padding: 14, marginBottom: 20 },
  infoTxt:            { flex: 1, fontSize: 13, color: C.sec, lineHeight: 20, fontFamily: "Inter_400Regular" },
  sectionLabel:       { fontSize: 11, fontWeight: "700" as const, color: C.mute, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "Inter_700Bold", marginBottom: 10, marginTop: 4 },
  loadRow:            { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, marginBottom: 20 },
  loadTxt:            { fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  emptyCard:          { padding: 16, backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, marginBottom: 20 },
  emptyTxt:           { fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  deviceList:         { gap: 8, marginBottom: 20 },
  deviceCard:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 14 },
  deviceCardSelected: { borderColor: C.accent, backgroundColor: C.accent + "10" },
  deviceIconWrap:     { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card2, alignItems: "center", justifyContent: "center" },
  deviceInfo:         { flex: 1, gap: 2 },
  deviceName:         { fontSize: 14, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  deviceMeta:         { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  radioOuter:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.b1, alignItems: "center", justifyContent: "center" },
  radioOuterActive:   { borderColor: C.accentL },
  radioInner:         { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accentL },
  card:               { backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 14, gap: 10, marginBottom: 20 },
  input:              { backgroundColor: C.card2, borderWidth: 1, borderColor: C.b0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  fieldNote:          { fontSize: 12, color: C.mute, lineHeight: 18, fontFamily: "Inter_400Regular" },
  toggleRow:          { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleText:         { flex: 1, gap: 2 },
  toggleTitle:        { fontSize: 14, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  toggleSub:          { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular", lineHeight: 18 },
  toggle:             { width: 44, height: 24, borderRadius: 12, backgroundColor: C.b1, justifyContent: "center", paddingHorizontal: 2 },
  toggleOn:           { backgroundColor: C.accent },
  toggleThumb:        { width: 20, height: 20, borderRadius: 10, backgroundColor: C.sec },
  toggleThumbOn:      { backgroundColor: C.accentL, alignSelf: "flex-end" },
  errBox:             { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.off + "15", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.off + "30", marginBottom: 16 },
  errTxt:             { fontSize: 13, color: C.off, flex: 1, fontFamily: "Inter_400Regular" },
  transferBtn:        { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  transferTxt:        { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  successContainer:   { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  successIcon:        { width: 88, height: 88, borderRadius: 24, backgroundColor: C.on + "18", alignItems: "center", justifyContent: "center" },
  successTitle:       { fontSize: 22, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  successSub:         { fontSize: 14, color: C.sec, textAlign: "center", lineHeight: 22, fontFamily: "Inter_400Regular" },
  doneBtn:            { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, alignItems: "center", marginTop: 8 },
  doneTxt:            { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
});
