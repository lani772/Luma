import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useConnectivity } from "@/context/ConnectivityContext";

// ─── Route hop icon map ───────────────────────────────────────────────────────
const HOP_ICON: Record<string, string> = {
  phone: "smartphone", broker: "server", gateway: "users",
  device: "cpu", backend: "cloud",
};

const ROUTE_COLORS: Record<string, string> = {
  direct_wifi: C.teal,
  direct_bluetooth: C.purple,
  bluetooth_mesh: C.indigo,
  local_mqtt: C.on,
  internet_mqtt: C.gold,
  backend_relay: C.rose,
};

const SIGNAL_BARS = [[-90, 1], [-80, 2], [-70, 3], [-60, 4], [-50, 5]];

function signalBars(rssi: number): number {
  for (const [threshold, bars] of SIGNAL_BARS) {
    if (rssi >= threshold) return bars as number;
  }
  return 0;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.4, duration: 900, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.2, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, [opacity, scale]);
  return (
    <Animated.View
      style={{
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: color,
        transform: [{ scale }], opacity,
      }}
    />
  );
}

function RouteViz({ route }: { route: NonNullable<ReturnType<typeof useConnectivity>["activeRoute"]> }) {
  const accent = ROUTE_COLORS[route.type] ?? C.accentL;
  return (
    <View style={styles.routeVizRow}>
      {route.hops.map((hop, i) => (
        <React.Fragment key={hop.id}>
          <View style={styles.routeHop}>
            <View style={[styles.routeHopIcon, {
              backgroundColor: hop.status === "offline" ? C.off + "20" : accent + "20",
              borderColor: hop.status === "offline" ? C.off + "40" : accent + "40",
            }]}>
              <Feather name={(HOP_ICON[hop.type] ?? "circle") as any} size={14} color={hop.status === "offline" ? C.off : accent} />
            </View>
            <Text style={[styles.routeHopLabel, { color: hop.status === "offline" ? C.mute : C.sec }]} numberOfLines={1}>{hop.label}</Text>
            {hop.transport && <Text style={styles.routeHopTransport}>{hop.transport}</Text>}
          </View>
          {i < route.hops.length - 1 && (
            <View style={styles.routeArrowWrap}>
              <View style={[styles.routeArrowLine, { backgroundColor: accent + "50" }]} />
              <Feather name="chevron-right" size={10} color={accent + "80"} />
            </View>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function SignalBar({ rssi }: { rssi: number }) {
  const bars = signalBars(rssi);
  const colors = [C.off, C.gold, C.gold, C.on, C.on];
  return (
    <View style={{ flexDirection: "row", gap: 2, alignItems: "flex-end", height: 16 }}>
      {[1, 2, 3, 4, 5].map(b => (
        <View key={b} style={{
          width: 4,
          height: 4 + b * 2,
          borderRadius: 1,
          backgroundColor: b <= bars ? colors[Math.min(bars - 1, 4)] : C.elevated,
        }} />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ConnectivityScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const {
    wifiConnected, currentSSID, localIP, networkStats, hotspot,
    registeredDevices, activeRoute, provisioning, recovery, eventLog,
    peers, gateways, offlineQueue,
    startDiscovery, toggleHotspot, provisionDevice, refreshDeviceList, triggerRecovery,
    discoverPeers, syncMesh,
  } = useConnectivity();

  const [activeTab, setActiveTab] = useState<"overview" | "devices" | "log">("overview");

  const routeColor = activeRoute ? (ROUTE_COLORS[activeRoute.type] ?? C.accentL) : C.mute;
  const signalQualityColor = {
    excellent: C.on, good: C.on, fair: C.gold, poor: C.off, none: C.mute,
  }[networkStats.signalQuality] ?? C.mute;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Connectivity Hub</Text>
          <Text style={styles.subtitle}>WiFi · Bluetooth · Mesh</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: (wifiConnected ? C.on : C.off) + "20", borderColor: (wifiConnected ? C.on : C.off) + "40" }]}>
          <PulsingDot color={wifiConnected ? C.on : C.off} />
          <Text style={[styles.statusPillText, { color: wifiConnected ? C.on : C.off }]}>
            {wifiConnected ? "Online" : "Offline"}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["overview", "devices", "log"] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setActiveTab(t)}
            style={[styles.tab, activeTab === t && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
            {t === "devices" && registeredDevices.length > 0 && (
              <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{registeredDevices.length}</Text></View>
            )}
            {t === "log" && eventLog.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: C.indigo }]}><Text style={styles.tabBadgeText}>{Math.min(eventLog.length, 9)}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === "overview" && (
          <>
            {/* Active Route */}
            <View style={[styles.card, { borderColor: routeColor + "30" }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: routeColor + "18" }]}>
                  <Feather name="git-branch" size={16} color={routeColor} />
                </View>
                <Text style={styles.cardTitle}>Active Route</Text>
                <TouchableOpacity onPress={syncMesh} style={styles.cardAction}>
                  <Feather name="refresh-cw" size={13} color={C.mute} />
                </TouchableOpacity>
              </View>
              {activeRoute ? (
                <>
                  <View style={[styles.routeTypePill, { backgroundColor: routeColor + "18", borderColor: routeColor + "40" }]}>
                    <Text style={[styles.routeTypeText, { color: routeColor }]}>{activeRoute.label}</Text>
                    <View style={styles.routeTypeDot}><PulsingDot color={routeColor} /></View>
                  </View>
                  <RouteViz route={activeRoute} />
                  <View style={styles.routeStats}>
                    <View style={styles.routeStat}>
                      <Feather name="clock" size={11} color={C.mute} />
                      <Text style={styles.routeStatVal}>{Math.round(activeRoute.latency)}ms</Text>
                    </View>
                    <View style={styles.routeStat}>
                      <Feather name="lock" size={11} color={C.on} />
                      <Text style={styles.routeStatVal}>E2E Encrypted</Text>
                    </View>
                    <View style={styles.routeStat}>
                      <Feather name="star" size={11} color={C.gold} />
                      <Text style={styles.routeStatVal}>Priority {activeRoute.priority}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyHint}>No active route — tap Scan to discover</Text>
              )}
            </View>

            {/* WiFi Status */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: C.teal + "18" }]}>
                  <Feather name="wifi" size={16} color={C.teal} />
                </View>
                <Text style={styles.cardTitle}>Wi-Fi</Text>
                <View style={[styles.connDot, { backgroundColor: wifiConnected ? C.on : C.off }]} />
              </View>
              {wifiConnected ? (
                <View style={styles.statGrid}>
                  <StatItem icon="wifi" label="Network" value={currentSSID} color={C.teal} />
                  <StatItem icon="map-pin" label="Local IP" value={localIP} color={C.sec} />
                  <StatItem icon="activity" label="Latency" value={`${networkStats.latency}ms`} color={C.gold} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Signal</Text>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 4 }}>
                      <SignalBar rssi={networkStats.rssi} />
                      <Text style={[styles.statValue, { color: signalQualityColor, fontSize: 11 }]}>
                        {networkStats.rssi}dBm
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyHint}>Not connected to Wi-Fi</Text>
              )}
            </View>

            {/* Hotspot */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: C.purple + "18" }]}>
                  <Feather name="radio" size={16} color={C.purple} />
                </View>
                <Text style={styles.cardTitle}>Mobile Hotspot</Text>
                <TouchableOpacity
                  style={[styles.toggleBtn, hotspot.active && styles.toggleBtnOn]}
                  onPress={toggleHotspot}
                >
                  <Text style={[styles.toggleBtnText, hotspot.active && styles.toggleBtnTextOn]}>
                    {hotspot.active ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>
              {hotspot.active ? (
                <View style={styles.statGrid}>
                  <StatItem icon="wifi" label="SSID" value={hotspot.ssid} color={C.purple} />
                  <StatItem icon="cpu" label="Connected" value={`${hotspot.connectedDevices.length} device${hotspot.connectedDevices.length !== 1 ? "s" : ""}`} color={C.on} />
                  <StatItem icon="radio" label="Band" value={hotspot.band} color={C.sec} />
                  <StatItem icon="hash" label="Channel" value={`ch ${hotspot.channel}`} color={C.mute} />
                </View>
              ) : (
                <Text style={styles.emptyHint}>Enable hotspot for ESP32 auto-connect</Text>
              )}
            </View>

            {/* Provisioning status */}
            {provisioning.step !== "idle" && (
              <View style={[styles.card, { borderColor: C.gold + "30" }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: C.gold + "18" }]}>
                    <Feather name="bluetooth" size={16} color={C.gold} />
                  </View>
                  <Text style={styles.cardTitle}>Provisioning</Text>
                  {provisioning.step === "complete" && <Feather name="check-circle" size={16} color={C.on} />}
                  {provisioning.step === "failed" && <Feather name="x-circle" size={16} color={C.off} />}
                </View>
                <View style={styles.provisionRow}>
                  <Text style={styles.provisionStep}>{PROVISION_LABELS[provisioning.step]}</Text>
                  <Text style={styles.provisionPct}>{provisioning.progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, {
                    width: `${provisioning.progress}%` as any,
                    backgroundColor: provisioning.step === "failed" ? C.off : C.gold,
                  }]} />
                </View>
              </View>
            )}

            {/* Network quality */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: C.indigo + "18" }]}>
                  <Feather name="activity" size={16} color={C.indigo} />
                </View>
                <Text style={styles.cardTitle}>Network Quality</Text>
              </View>
              <View style={styles.qualityGrid}>
                <QualityItem label="Internet" ok={networkStats.internetAvailable} icon="globe" />
                <QualityItem label="Local Net" ok={networkStats.localNetAvailable} icon="home" />
                <QualityItem label="ESP32" ok={networkStats.esp32Connected} icon="cpu" />
                <QualityItem label={networkStats.signalQuality} ok={["excellent","good"].includes(networkStats.signalQuality)} icon="wifi" />
              </View>
              {networkStats.esp32Connected && (
                <View style={styles.esp32LatRow}>
                  <Feather name="cpu" size={12} color={C.teal} />
                  <Text style={styles.esp32LatText}>ESP32 latency: {networkStats.esp32Latency}ms</Text>
                </View>
              )}
            </View>

            {/* Mesh summary */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: C.indigo + "18" }]}>
                  <Feather name="share-2" size={16} color={C.indigo} />
                </View>
                <Text style={styles.cardTitle}>BT Mesh</Text>
                <TouchableOpacity onPress={() => router.push("/mesh")} style={styles.cardAction}>
                  <Text style={styles.cardActionText}>View →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.meshSummaryRow}>
                <MeshStat label="Peers" value={peers.length} color={C.indigo} icon="users" />
                <MeshStat label="Gateways" value={gateways.length} color={C.on} icon="server" />
                <MeshStat label="Queued" value={offlineQueue.filter(e=>e.status==="queued").length} color={C.gold} icon="inbox" />
              </View>
            </View>

            {/* Recovery */}
            {(recovery.active || recovery.phase === "failed") && (
              <View style={[styles.card, { borderColor: C.off + "30" }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: C.off + "18" }]}>
                    <Feather name="alert-triangle" size={16} color={C.off} />
                  </View>
                  <Text style={styles.cardTitle}>Auto Recovery</Text>
                  <Text style={[styles.recoveryPhase, { color: recovery.phase === "failed" ? C.off : C.gold }]}>
                    {recovery.phase.replace(/_/g, " ")}
                  </Text>
                </View>
                {recovery.active && (
                  <Text style={styles.recoveryDetail}>
                    Attempt {recovery.attempt}/{recovery.maxAttempts}{recovery.nextRetryIn > 0 ? ` · retry in ${recovery.nextRetryIn}s` : ""}
                  </Text>
                )}
              </View>
            )}

            {/* Quick actions */}
            <View style={styles.actionsRow}>
              <ActionBtn icon="search" label="Scan Network" onPress={() => { startDiscovery(); discoverPeers(); }} color={C.teal} />
              <ActionBtn icon="bluetooth" label="Provision" onPress={() => provisionDevice()} color={C.purple} />
              <ActionBtn icon="refresh-cw" label="Refresh" onPress={refreshDeviceList} color={C.indigo} />
              <ActionBtn icon="zap" label="Recovery" onPress={() => triggerRecovery("ESP32-L001")} color={C.gold} />
            </View>
          </>
        )}

        {activeTab === "devices" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Registered Devices</Text>
              <TouchableOpacity onPress={refreshDeviceList}>
                <Feather name="refresh-cw" size={15} color={C.mute} />
              </TouchableOpacity>
            </View>
            {registeredDevices.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="cpu" size={40} color={C.mute} />
                <Text style={styles.emptyTitle}>No devices found</Text>
                <Text style={styles.emptyHint}>Tap "Scan Network" to discover ESP32 devices</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={startDiscovery}>
                  <Text style={styles.emptyBtnText}>Scan Now</Text>
                </TouchableOpacity>
              </View>
            ) : (
              registeredDevices.map(dev => (
                <View key={dev.id} style={styles.deviceCard}>
                  <View style={[styles.deviceStatus, { backgroundColor: dev.status === "online" ? C.on + "20" : C.off + "20" }]}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dev.status === "online" ? C.on : C.off }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <Text style={styles.deviceId}>{dev.id}</Text>
                      <View style={[styles.discoveryPill, { backgroundColor: C.teal + "15", borderColor: C.teal + "35" }]}>
                        <Text style={[styles.discoveryPillText, { color: C.teal }]}>{dev.discoveryMethod}</Text>
                      </View>
                    </View>
                    <Text style={styles.deviceHost}>{dev.hostname}</Text>
                    <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
                      <Text style={styles.deviceMeta}>IP: {dev.ip}</Text>
                      <Text style={styles.deviceMeta}>FW: {dev.firmwareVersion}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deviceAction}
                    onPress={() => dev.status === "online" ? undefined : startDiscovery()}
                  >
                    <Feather name={dev.status === "online" ? "link" : "link-2"} size={16} color={dev.status === "online" ? C.on : C.mute} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === "log" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Event Log</Text>
              <Text style={styles.sectionSub}>{eventLog.length} events</Text>
            </View>
            {eventLog.length === 0 ? (
              <Text style={styles.emptyHint}>No events yet</Text>
            ) : (
              eventLog.slice(0, 40).map((e, i) => (
                <View key={i} style={styles.logRow}>
                  <View style={[styles.logDot, { backgroundColor: e.source === "wifi" ? C.teal + "60" : C.indigo + "60" }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <View style={[styles.logSourcePill, { backgroundColor: e.source === "wifi" ? C.teal + "15" : C.indigo + "15" }]}>
                        <Text style={[styles.logSourceText, { color: e.source === "wifi" ? C.teal : C.indigo }]}>{e.source}</Text>
                      </View>
                      <Text style={styles.logEvent}>{e.event}</Text>
                    </View>
                    <Text style={styles.logDetail}>{e.detail}</Text>
                  </View>
                  <Text style={styles.logTime}>{fmtTime(e.time)}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Tiny components ──────────────────────────────────────────────────────────

function StatItem({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
        <Feather name={icon as any} size={11} color={color} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function QualityItem({ label, ok, icon }: { label: string; ok: boolean; icon: string }) {
  return (
    <View style={[styles.qualityItem, { backgroundColor: (ok ? C.on : C.off) + "12", borderColor: (ok ? C.on : C.off) + "30" }]}>
      <Feather name={icon as any} size={14} color={ok ? C.on : C.off} />
      <Text style={[styles.qualityLabel, { color: ok ? C.on : C.off }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function MeshStat({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={styles.meshStat}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={[styles.meshStatVal, { color }]}>{value}</Text>
      <Text style={styles.meshStatLabel}>{label}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color + "35" }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionBtnIcon, { backgroundColor: color + "18" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.actionBtnLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROVISION_LABELS: Record<string, string> = {
  idle: "Ready",
  bt_pairing: "Pairing via Bluetooth...",
  credential_transfer: "Transferring credentials...",
  esp32_connecting: "ESP32 connecting to network...",
  discovering: "Discovering device...",
  complete: "Device provisioned!",
  failed: "Provisioning failed",
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.b0 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.accentL },
  tabText: { fontSize: 12, color: C.mute, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  tabTextActive: { color: C.accentL },
  tabBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.off, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  tabBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 50, gap: 12 },
  card: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  cardIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  cardAction: { paddingHorizontal: 8, paddingVertical: 4 },
  cardActionText: { fontSize: 12, color: C.accentL, fontFamily: "Inter_600SemiBold" },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  routeTypePill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1, marginBottom: 14 },
  routeTypeText: { fontSize: 12, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  routeTypeDot: { marginLeft: 2 },
  routeVizRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  routeHop: { alignItems: "center", gap: 4, minWidth: 52 },
  routeHopIcon: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  routeHopLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  routeHopTransport: { fontSize: 8, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center" },
  routeArrowWrap: { flexDirection: "row", alignItems: "center", gap: 0, paddingBottom: 12 },
  routeArrowLine: { width: 12, height: 1 },
  routeStats: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  routeStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeStatVal: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statItem: { width: "45%", minWidth: 100 },
  statLabel: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", marginBottom: 2 },
  statValue: { fontSize: 12, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  qualityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qualityItem: { flex: 1, minWidth: 70, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: "center", gap: 4 },
  qualityLabel: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold", textAlign: "center", textTransform: "capitalize" },
  esp32LatRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.b0 },
  esp32LatText: { fontSize: 11, color: C.teal, fontFamily: "Inter_400Regular" },
  meshSummaryRow: { flexDirection: "row", gap: 10 },
  meshStat: { flex: 1, backgroundColor: C.elevated, borderRadius: 12, padding: 12, alignItems: "center", gap: 4 },
  meshStatVal: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  meshStatLabel: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0 },
  toggleBtnOn: { backgroundColor: C.purple + "25", borderColor: C.purple + "60" },
  toggleBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  toggleBtnTextOn: { color: C.purple },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { flex: 1, minWidth: "44%", backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", gap: 8 },
  actionBtnIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionBtnLabel: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold", textAlign: "center" },
  provisionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  provisionStep: { fontSize: 13, color: C.txt, fontFamily: "Inter_600SemiBold", flex: 1 },
  provisionPct: { fontSize: 13, color: C.gold, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: C.elevated, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  recoveryPhase: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold", textTransform: "capitalize" },
  recoveryDetail: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  deviceCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 8 },
  deviceStatus: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  deviceId: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  deviceHost: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  deviceMeta: { fontSize: 10, color: C.sec, fontFamily: "Inter_400Regular" },
  discoveryPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, borderWidth: 1 },
  discoveryPillText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  deviceAction: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  logSourcePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  logSourceText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  logEvent: { fontSize: 12, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  logDetail: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular", marginTop: 1 },
  logTime: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 4 },
  emptyState: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptyHint: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 4 },
  emptyBtn: { marginTop: 8, backgroundColor: C.accentL + "20", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: C.accentL + "40" },
  emptyBtnText: { fontSize: 13, color: C.accentL, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
});
