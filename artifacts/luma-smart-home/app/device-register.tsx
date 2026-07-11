import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { ESP32_GPIO_PINS } from "@/data/luma-data";

export default function DeviceRegisterScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { microcontrollers, mcDevices } = useLuma();

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Register Device</Text>
          <Text style={styles.sub}>Choose a Microcontroller to host this device</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Feather name="info" size={14} color={C.accentL} />
          <Text style={styles.infoText}>
            Devices are GPIO-controlled lamps registered under a Microcontroller.
            Each GPIO pin hosts exactly one device. Select an MC to see its available pins.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Available Microcontrollers</Text>

        {/* Empty state */}
        {microcontrollers.length === 0 && (
          <View style={styles.empty}>
            <Feather name="cpu" size={36} color={C.mute2} />
            <Text style={styles.emptyTitle}>No Microcontrollers</Text>
            <Text style={styles.emptyDesc}>
              Register an ESP32 before adding GPIO devices to it.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push("/microcontroller-register" as any)}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.emptyBtnText}>Register Microcontroller</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MC cards */}
        {microcontrollers.map(mc => {
          const assignedPins  = mcDevices.filter(d => d.mcId === mc.id).map(d => d.gpioPin);
          const freePins      = ESP32_GPIO_PINS.filter(p => !assignedPins.includes(p));
          const isFull        = freePins.length === 0;

          return (
            <TouchableOpacity
              key={mc.id}
              style={[
                styles.mcCard,
                isFull    && styles.mcCardFull,
                !isFull   && mc.online && { borderColor: C.on + "30" },
              ]}
              onPress={() => !isFull && router.push(`/mc-device-register?mcId=${mc.id}` as any)}
              disabled={isFull}
              activeOpacity={0.78}
            >
              {/* Card top */}
              <View style={styles.mcCardTop}>
                <View style={[
                  styles.mcIcon,
                  { backgroundColor: (isFull ? C.mute2 : "#f97316") + "18", borderColor: (isFull ? C.mute2 : "#f97316") + "30" },
                ]}>
                  <Feather name="cpu" size={20} color={isFull ? C.mute2 : "#f97316"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mcName, isFull && { color: C.mute }]}>{mc.name}</Text>
                  <Text style={styles.mcModel}>{mc.model} · {mc.room}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: mc.online ? C.on + "18" : C.off + "18", borderColor: mc.online ? C.on + "40" : C.off + "35" },
                ]}>
                  <View style={[styles.statusDot, { backgroundColor: mc.online ? C.on : C.off }]} />
                  <Text style={[styles.statusText, { color: mc.online ? C.on : C.off }]}>
                    {mc.online ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <StatCell value={`${assignedPins.length}`} label="Devices" color={C.accentL} />
                <View style={styles.statDivider} />
                <StatCell value={`${freePins.length}`} label="GPIO Free" color={isFull ? C.mute : C.on} />
                <View style={styles.statDivider} />
                <StatCell value={`${assignedPins.length}`} label="GPIO Used" color="#f97316" />
                <View style={styles.statDivider} />
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  {isFull ? (
                    <View style={styles.fullBadge}>
                      <Text style={styles.fullBadgeText}>All GPIO Used</Text>
                    </View>
                  ) : (
                    <View style={styles.selectChip}>
                      <Text style={styles.selectChipText}>Select</Text>
                      <Feather name="chevron-right" size={13} color="#f97316" />
                    </View>
                  )}
                </View>
              </View>

              {/* Available GPIO pins preview */}
              {!isFull && (
                <View style={styles.gpioPreviewRow}>
                  <Text style={styles.gpioPreviewLabel}>Available GPIO: </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    <View style={styles.gpioChipRow}>
                      {freePins.slice(0, 10).map(pin => (
                        <View key={pin} style={styles.gpioChip}>
                          <Text style={styles.gpioChipText}>{pin}</Text>
                        </View>
                      ))}
                      {freePins.length > 10 && (
                        <View style={[styles.gpioChip, { backgroundColor: C.elevated }]}>
                          <Text style={[styles.gpioChipText, { color: C.mute }]}>+{freePins.length - 10}</Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Used GPIO summary */}
              {assignedPins.length > 0 && (
                <View style={styles.usedRow}>
                  <Text style={styles.usedLabel}>Used: </Text>
                  {mcDevices.filter(d => d.mcId === mc.id).map(d => (
                    <View key={d.id} style={styles.usedChip}>
                      <Text style={styles.usedChipPin}>GPIO {d.gpioPin}</Text>
                      <Text style={styles.usedChipName} numberOfLines={1}>→ {d.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

function StatCell({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" as const, color, fontFamily: "Inter_700Bold" }}>{value}</Text>
      <Text style={{ fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" }}>{label}</Text>
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
  content: { padding: 16 },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.accentL + "12", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.accentL + "30", marginBottom: 20 },
  infoText: { flex: 1, fontSize: 12, color: C.sec, lineHeight: 18, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12, fontFamily: "Inter_600SemiBold" },
  mcCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16, marginBottom: 12, gap: 12 },
  mcCardFull: { opacity: 0.55 },
  mcCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  mcIcon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  mcName: { fontSize: 15, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  mcModel: { fontSize: 11, color: C.mute, marginTop: 1, fontFamily: "Inter_400Regular" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: C.b0, paddingTop: 12 },
  statDivider: { width: 1, height: 28, backgroundColor: C.b0, marginHorizontal: 4 },
  fullBadge: { backgroundColor: C.off + "15", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.off + "30" },
  fullBadgeText: { fontSize: 10, color: C.off, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  selectChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f97316" + "18", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: "#f97316" + "40" },
  selectChipText: { fontSize: 11, color: "#f97316", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  gpioPreviewRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: C.b0, paddingTop: 10 },
  gpioPreviewLabel: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  gpioChipRow: { flexDirection: "row", gap: 5 },
  gpioChip: { width: 36, height: 26, borderRadius: 7, backgroundColor: C.on + "15", borderWidth: 1, borderColor: C.on + "30", alignItems: "center", justifyContent: "center" },
  gpioChipText: { fontSize: 10, fontWeight: "700" as const, color: C.on, fontFamily: "Inter_700Bold" },
  usedRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: C.b0, paddingTop: 10 },
  usedLabel: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  usedChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f97316" + "12", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#f97316" + "30" },
  usedChipPin: { fontSize: 10, fontWeight: "700" as const, color: "#f97316", fontFamily: "Inter_700Bold" },
  usedChipName: { fontSize: 10, color: C.sec, fontFamily: "Inter_400Regular", maxWidth: 90 },
  empty: { alignItems: "center", paddingVertical: 56, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  emptyDesc: { fontSize: 13, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 30 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#f97316", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { fontSize: 13, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
});
