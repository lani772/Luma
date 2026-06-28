import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import { timeAgo } from "@/data/luma-data";

export default function MQTTScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lamps } = useLuma();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const connected = lamps.filter(l => l.mqttStatus === "connected").length;
  const total = lamps.length;
  const uplinkMs = 28 + Math.floor(Math.random() * 12);
  const msgRate = 42 + Math.floor(Math.random() * 8);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <Text style={styles.title}>MQTT Monitor</Text>
        <View style={[styles.statusPill, { backgroundColor: connected === total ? C.on + "18" : C.warn + "18", borderColor: connected === total ? C.on + "40" : C.warn + "40" }]}>
          <View style={[styles.statusDot, { backgroundColor: connected === total ? C.on : C.warn }]} />
          <Text style={[styles.statusText, { color: connected === total ? C.on : C.warn }]}>
            {connected === total ? "Connected" : "Partial"}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Broker card */}
        <View style={styles.brokerCard}>
          <View style={styles.brokerHeader}>
            <Feather name="radio" size={20} color={C.teal} />
            <Text style={styles.brokerTitle}>mqtt.luma.local</Text>
          </View>
          <View style={styles.brokerStats}>
            <BrokerStat label="Devices" value={`${connected}/${total}`} color={connected === total ? C.on : C.warn} />
            <BrokerStat label="Uplink" value={`${uplinkMs}ms`} color={C.teal} />
            <BrokerStat label="Msg/min" value={String(msgRate)} color={C.accentL} />
            <BrokerStat label="Port" value="1883" color={C.mute} />
          </View>
          <View style={styles.brokerFooter}>
            <Text style={styles.brokerMeta}>QoS Level 1 · Retain: Yes · Keep-alive: 60s</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Device Topics</Text>

        {lamps.map(lamp => {
          const ok = lamp.mqttStatus === "connected";
          const payload = JSON.stringify({
            state: lamp.on ? "ON" : "OFF",
            brightness: lamp.brightness,
            color_temp: lamp.colorTemp,
            power: lamp.power,
            voltage: lamp.voltage,
            current: lamp.current,
            energy: lamp.energyToday,
            rssi: lamp.health.rssi,
          }, null, 0);

          return (
            <View key={lamp.id} style={[styles.topicCard, { borderColor: ok ? C.on + "25" : C.off + "25" }]}>
              <View style={styles.topicHeader}>
                <View style={[styles.mqttIcon, { backgroundColor: ok ? C.on + "18" : C.off + "18", borderColor: ok ? C.on + "30" : C.off + "30" }]}>
                  <Feather name={ok ? "radio" : "wifi-off"} size={14} color={ok ? C.on : C.off} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName} numberOfLines={1}>{lamp.name}</Text>
                  <Text style={styles.topicPath}>luma/device/{lamp.id}/state</Text>
                </View>
                <Text style={styles.lastPub}>{timeAgo(lamp.lastSeen)}</Text>
              </View>

              <View style={styles.payloadBox}>
                <Text style={styles.payloadText} numberOfLines={2}>{payload}</Text>
              </View>

              <View style={styles.topicStats}>
                <View style={[styles.badge, ok ? { backgroundColor: C.on + "12", borderColor: C.on + "30" } : {}]}>
                  <Text style={[styles.badgeText, { color: ok ? C.on : C.mute }]}>{ok ? "● Connected" : "○ Disconnected"}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>RSSI {lamp.health.rssi} dBm</Text>
                </View>
                {lamp.online && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>IP {lamp.health.ip}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function BrokerStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.brokerStat}>
      <Text style={[styles.brokerStatValue, { color }]}>{value}</Text>
      <Text style={styles.brokerStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  brokerCard: { backgroundColor: C.teal + "10", borderRadius: 18, borderWidth: 1, borderColor: C.teal + "30", padding: 16, marginBottom: 18 },
  brokerHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  brokerTitle: { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  brokerStats: { flexDirection: "row", marginBottom: 12 },
  brokerStat: { flex: 1, alignItems: "center" },
  brokerStatValue: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  brokerStatLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  brokerFooter: {},
  brokerMeta: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  topicCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, gap: 10 },
  topicHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  mqttIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  deviceName: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  topicPath: { fontSize: 10, color: C.teal, fontFamily: "Inter_400Regular" },
  lastPub: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  payloadBox: { backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.b0, padding: 8 },
  payloadText: { fontSize: 10, color: C.on, fontFamily: "Inter_400Regular", lineHeight: 15 },
  topicStats: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  badgeText: { fontSize: 9, color: C.mute, fontWeight: "700" as const, fontFamily: "Inter_600SemiBold" },
});
