import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useConnectivity } from "@/context/ConnectivityContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
}

function rssiLabel(rssi: number): string {
  if (rssi >= -50) return "Excellent";
  if (rssi >= -65) return "Good";
  if (rssi >= -75) return "Fair";
  if (rssi >= -85) return "Poor";
  return "No Signal";
}

function rssiColor(rssi: number): string {
  if (rssi >= -60) return C.on;
  if (rssi >= -75) return C.gold;
  return C.off;
}

function latencyColor(ms: number): string {
  if (ms <= 30) return C.on;
  if (ms <= 80) return C.gold;
  return C.off;
}

function latencyLabel(ms: number): string {
  if (ms <= 30) return "Excellent";
  if (ms <= 80) return "Good";
  if (ms <= 150) return "Fair";
  return "Poor";
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function RSSIGauge({ rssi }: { rssi: number }) {
  const pct = Math.max(0, Math.min(100, ((rssi + 90) / 60) * 100));
  const color = rssiColor(rssi);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [anim, pct]);
  return (
    <View style={gStyles.gaugeWrap}>
      <View style={gStyles.gaugeTrack}>
        <Animated.View style={[gStyles.gaugeFill, {
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
          backgroundColor: color,
        }]} />
        {/* Threshold lines */}
        <View style={[gStyles.threshLine, { left: "41%" }]} />
        <View style={[gStyles.threshLine, { left: "58%" }]} />
        <View style={[gStyles.threshLine, { left: "75%" }]} />
      </View>
      <View style={gStyles.gaugeLabels}>
        <Text style={gStyles.gaugeMin}>−90</Text>
        <Text style={gStyles.gaugeLabel}>Poor</Text>
        <Text style={gStyles.gaugeLabel}>Fair</Text>
        <Text style={gStyles.gaugeLabel}>Good</Text>
        <Text style={gStyles.gaugeMax}>−30</Text>
      </View>
    </View>
  );
}

function LatencyBar({ ms }: { ms: number }) {
  const pct = Math.max(0, Math.min(100, (1 - ms / 300) * 100));
  const color = latencyColor(ms);
  const anim = useRef(new Animated.Value(100)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [anim, pct]);
  return (
    <View style={gStyles.gaugeTrack}>
      <Animated.View style={[gStyles.gaugeFill, {
        width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        backgroundColor: color,
      }]} />
    </View>
  );
}

const gStyles = StyleSheet.create({
  gaugeWrap: { gap: 6 },
  gaugeTrack: { height: 10, borderRadius: 5, backgroundColor: C.elevated, overflow: "hidden", position: "relative" },
  gaugeFill: { height: 10, borderRadius: 5 },
  threshLine: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: C.bg + "80" },
  gaugeLabels: { flexDirection: "row", justifyContent: "space-between" },
  gaugeMin: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
  gaugeMax: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
  gaugeLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NetworkMonitorScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const {
    networkStats, wifiConnected, currentSSID, localIP,
    hotspot, registeredDevices, recovery,
    activeRoute, peers, gateways,
    eventLog,
    startDiscovery, triggerRecovery, discoverPeers, refreshDeviceList,
  } = useConnectivity();

  const [tab, setTab] = useState<"stats" | "log" | "recovery">("stats");
  const [historyPoints, setHistoryPoints] = useState<{ rssi: number; latency: number; time: number }[]>([]);

  // Build mini history
  useEffect(() => {
    if (!wifiConnected) return;
    setHistoryPoints(prev => {
      const updated = [...prev, { rssi: networkStats.rssi, latency: networkStats.latency, time: Date.now() }];
      return updated.slice(-20);
    });
  }, [networkStats.rssi, networkStats.latency, wifiConnected]);

  const statusOk = wifiConnected && networkStats.internetAvailable && networkStats.localNetAvailable;
  const statusColor = statusOk ? C.on : wifiConnected ? C.gold : C.off;
  const statusLabel = !wifiConnected ? "Disconnected" : !networkStats.localNetAvailable ? "Local Net Down" : !networkStats.internetAvailable ? "Internet Down" : "All Systems Online";

  const wifiEvents = eventLog.filter(e => e.source === "wifi");
  const meshEvents = eventLog.filter(e => e.source === "mesh");

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Network Monitor</Text>
          <Text style={styles.subtitle}>Real-time connectivity health</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20", borderColor: statusColor + "40" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Quick stats */}
      <View style={styles.quickStats}>
        <QuickStat icon="wifi" label="RSSI" value={`${Math.round(networkStats.rssi)}dBm`} sub={rssiLabel(networkStats.rssi)} color={rssiColor(networkStats.rssi)} />
        <QuickStat icon="clock" label="Latency" value={`${networkStats.latency}ms`} sub={latencyLabel(networkStats.latency)} color={latencyColor(networkStats.latency)} />
        <QuickStat icon="users" label="Peers" value={`${peers.filter(p => p.online).length}/${peers.length}`} sub="mesh nodes" color={C.indigo} />
        <QuickStat icon="cpu" label="Devices" value={String(registeredDevices.filter(d => d.status === "online").length)} sub="online" color={C.teal} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["stats", "log", "recovery"] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {tab === "stats" && (
          <>
            {/* WiFi signal */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: C.teal + "18" }]}>
                  <Feather name="wifi" size={15} color={C.teal} />
                </View>
                <Text style={styles.cardTitle}>Signal Strength</Text>
                <Text style={[styles.bigVal, { color: rssiColor(networkStats.rssi) }]}>
                  {Math.round(networkStats.rssi)} dBm
                </Text>
              </View>
              <RSSIGauge rssi={networkStats.rssi} />
              <View style={styles.statsRow}>
                <LabelVal label="Quality" value={rssiLabel(networkStats.rssi)} color={rssiColor(networkStats.rssi)} />
                <LabelVal label="Channel" value={networkStats.channel ? `Ch ${networkStats.channel}` : "—"} color={C.sec} />
                <LabelVal label="Band" value={networkStats.frequency >= 5000 ? "5 GHz" : networkStats.frequency >= 2400 ? "2.4 GHz" : "—"} color={C.sec} />
                <LabelVal label="Link" value={networkStats.linkSpeed ? `${networkStats.linkSpeed}Mbps` : "—"} color={C.sec} />
              </View>
            </View>

            {/* Latency */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: C.indigo + "18" }]}>
                  <Feather name="clock" size={15} color={C.indigo} />
                </View>
                <Text style={styles.cardTitle}>Latency</Text>
                <Text style={[styles.bigVal, { color: latencyColor(networkStats.latency) }]}>
                  {networkStats.latency}ms
                </Text>
              </View>
              <LatencyBar ms={networkStats.latency} />
              <View style={styles.statsRow}>
                <LabelVal label="Internet" value={networkStats.latency > 0 ? `~${networkStats.latency}ms` : "—"} color={latencyColor(networkStats.latency)} />
                <LabelVal label="ESP32" value={networkStats.esp32Latency > 0 ? `${networkStats.esp32Latency}ms` : "—"} color={latencyColor(networkStats.esp32Latency)} />
                <LabelVal label="Route" value={activeRoute ? `${Math.round(activeRoute.latency)}ms` : "—"} color={C.sec} />
              </View>
            </View>

            {/* Signal history mini chart */}
            {historyPoints.length > 1 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: C.purple + "18" }]}>
                    <Feather name="trending-up" size={15} color={C.purple} />
                  </View>
                  <Text style={styles.cardTitle}>Signal History</Text>
                  <Text style={styles.historyPoints}>{historyPoints.length} pts</Text>
                </View>
                <View style={styles.miniChart}>
                  {historyPoints.map((pt, i) => {
                    const h = Math.max(4, Math.min(48, ((pt.rssi + 90) / 60) * 48));
                    return (
                      <View key={i} style={styles.miniChartBar}>
                        <View style={[styles.miniChartFill, {
                          height: h,
                          backgroundColor: rssiColor(pt.rssi),
                          opacity: 0.4 + (i / historyPoints.length) * 0.6,
                        }]} />
                      </View>
                    );
                  })}
                </View>
                <View style={styles.chartLegend}>
                  <Text style={styles.chartLegendText}>← older</Text>
                  <Text style={styles.chartLegendText}>newer →</Text>
                </View>
              </View>
            )}

            {/* Connectivity matrix */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: C.gold + "18" }]}>
                  <Feather name="grid" size={15} color={C.gold} />
                </View>
                <Text style={styles.cardTitle}>Connectivity Status</Text>
              </View>
              <View style={styles.matrixGrid}>
                <MatrixItem label="Internet" ok={networkStats.internetAvailable} icon="globe" />
                <MatrixItem label="Local Network" ok={networkStats.localNetAvailable} icon="home" />
                <MatrixItem label="ESP32" ok={networkStats.esp32Connected} icon="cpu" />
                <MatrixItem label="Wi-Fi" ok={wifiConnected} icon="wifi" />
                <MatrixItem label="Hotspot" ok={hotspot.active} icon="radio" />
                <MatrixItem label="Mesh" ok={peers.some(p => p.trusted && p.online)} icon="share-2" />
                <MatrixItem label="Gateway" ok={gateways.length > 0} icon="server" />
                <MatrixItem label="Route" ok={activeRoute !== null} icon="git-branch" />
              </View>
            </View>

            {/* Network details */}
            {wifiConnected && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: C.teal + "18" }]}>
                    <Feather name="info" size={15} color={C.teal} />
                  </View>
                  <Text style={styles.cardTitle}>Network Details</Text>
                </View>
                <View style={styles.detailGrid}>
                  <Detail label="SSID" value={currentSSID} />
                  <Detail label="Local IP" value={localIP} />
                  <Detail label="Channel" value={networkStats.channel ? `${networkStats.channel}` : "—"} />
                  <Detail label="Frequency" value={networkStats.frequency ? `${networkStats.frequency} MHz` : "—"} />
                  <Detail label="Link Speed" value={networkStats.linkSpeed ? `${networkStats.linkSpeed} Mbps` : "—"} />
                  <Detail label="Signal" value={`${Math.round(networkStats.rssi)} dBm (${rssiLabel(networkStats.rssi)})`} />
                </View>
              </View>
            )}

            {/* Quick actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={startDiscovery}>
                <Feather name="search" size={14} color={C.teal} />
                <Text style={[styles.actionText, { color: C.teal }]}>Scan Devices</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => discoverPeers()}>
                <Feather name="bluetooth" size={14} color={C.indigo} />
                <Text style={[styles.actionText, { color: C.indigo }]}>Scan Peers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={refreshDeviceList}>
                <Feather name="refresh-cw" size={14} color={C.purple} />
                <Text style={[styles.actionText, { color: C.purple }]}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {tab === "log" && (
          <>
            <View style={styles.logFilters}>
              <Text style={styles.logFilterLabel}>
                {eventLog.length} total events — {wifiEvents.length} WiFi · {meshEvents.length} Mesh
              </Text>
            </View>
            {eventLog.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="list" size={36} color={C.mute} />
                <Text style={styles.emptyTitle}>No events yet</Text>
                <Text style={styles.emptyHint}>Events appear as the engine detects connectivity changes</Text>
              </View>
            ) : (
              eventLog.map((e, i) => {
                const src = e.source === "wifi" ? { color: C.teal, label: "WiFi" } : { color: C.indigo, label: "Mesh" };
                const isWarning = ["NetworkLost","DeviceDisconnected","RecoveryFailed","PeerDisconnected","GatewayLost","DeliveryFailed"].includes(e.event);
                const isSuccess = ["WiFiConnected","DeviceConnected","ConnectionRecovered","MeshSynchronized","MessageDelivered","PeerConnected"].includes(e.event);
                const rowColor = isWarning ? C.off : isSuccess ? C.on : undefined;
                return (
                  <View key={i} style={[styles.logRow, rowColor && { borderLeftColor: rowColor, borderLeftWidth: 2 }]}>
                    <View style={[styles.logDot, { backgroundColor: src.color + "60" }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <View style={[styles.logSrcBadge, { backgroundColor: src.color + "18" }]}>
                          <Text style={[styles.logSrcText, { color: src.color }]}>{src.label}</Text>
                        </View>
                        <Text style={[styles.logEvent, isWarning && { color: C.off }, isSuccess && { color: C.on }]}>
                          {e.event}
                        </Text>
                      </View>
                      <Text style={styles.logDetail}>{e.detail}</Text>
                    </View>
                    <Text style={styles.logTime}>{fmtTime(e.time)}</Text>
                  </View>
                );
              })
            )}
          </>
        )}

        {tab === "recovery" && (
          <>
            {/* Recovery state */}
            <View style={[styles.card, {
              borderColor: recovery.active ? C.gold + "35" : recovery.phase === "failed" ? C.off + "35" : recovery.phase === "idle" ? C.on + "25" : C.b0
            }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, {
                  backgroundColor: recovery.active ? C.gold + "18" : recovery.phase === "failed" ? C.off + "18" : C.on + "18"
                }]}>
                  <Feather name={recovery.active ? "alert-triangle" : recovery.phase === "failed" ? "x-circle" : "check-circle"} size={15}
                    color={recovery.active ? C.gold : recovery.phase === "failed" ? C.off : C.on} />
                </View>
                <Text style={styles.cardTitle}>Auto Recovery Engine</Text>
                <View style={[styles.recoverPill, {
                  backgroundColor: recovery.active ? C.gold + "18" : recovery.phase === "failed" ? C.off + "18" : C.on + "18",
                  borderColor: recovery.active ? C.gold + "40" : recovery.phase === "failed" ? C.off + "40" : C.on + "40",
                }]}>
                  <Text style={[styles.recoverPillText, {
                    color: recovery.active ? C.gold : recovery.phase === "failed" ? C.off : C.on
                  }]}>
                    {recovery.active ? "Recovering" : recovery.phase === "failed" ? "Failed" : "Idle"}
                  </Text>
                </View>
              </View>
              {recovery.active && (
                <>
                  <View style={styles.recoverStats}>
                    <LabelVal label="Phase" value={recovery.phase.replace(/_/g, " ")} color={C.gold} />
                    <LabelVal label="Attempt" value={`${recovery.attempt}/${recovery.maxAttempts}`} color={C.sec} />
                    {recovery.nextRetryIn > 0 && <LabelVal label="Retry in" value={`${recovery.nextRetryIn}s`} color={C.mute} />}
                  </View>
                  <View style={styles.recoveryPhases}>
                    {RECOVERY_PHASES.map(p => (
                      <View key={p.id} style={styles.recoveryPhaseRow}>
                        <View style={[styles.recoveryPhaseDot, {
                          backgroundColor: p.id === recovery.phase ? C.gold :
                            RECOVERY_PHASE_ORDER.indexOf(p.id) < RECOVERY_PHASE_ORDER.indexOf(recovery.phase as RecoveryPhaseId) ? C.on : C.elevated,
                        }]} />
                        <Text style={[styles.recoveryPhaseLabel, p.id === recovery.phase && { color: C.gold, fontFamily: "Inter_700Bold" }]}>
                          {p.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {!recovery.active && recovery.phase !== "idle" && (
                <Text style={styles.recoverHint}>
                  {recovery.phase === "failed"
                    ? `Auto-recovery failed after ${recovery.maxAttempts} attempts. Manual intervention may be required.`
                    : "No connection issues detected. The recovery engine is monitoring passively."}
                </Text>
              )}
              {!recovery.active && recovery.phase === "idle" && (
                <Text style={styles.recoverHint}>
                  Monitoring active. Recovery will trigger automatically if communication is interrupted. Uses exponential backoff (2^n seconds, max 30s).
                </Text>
              )}
            </View>

            {/* Manual trigger */}
            <TouchableOpacity
              style={[styles.triggerBtn, recovery.active && { opacity: 0.5 }]}
              onPress={() => !recovery.active && triggerRecovery("ESP32-L001")}
              disabled={recovery.active}
            >
              <Feather name="zap" size={18} color={C.gold} />
              <Text style={styles.triggerBtnText}>Trigger Manual Recovery</Text>
            </TouchableOpacity>

            {/* Recovery sequence reference */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Recovery Sequence (§1.8)</Text>
              {RECOVERY_PHASES.map((p, i) => (
                <View key={p.id} style={styles.seqRow}>
                  <View style={styles.seqNum}>
                    <Text style={styles.seqNumText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.seqLabel}>{p.label}</Text>
                    <Text style={styles.seqDesc}>{p.desc}</Text>
                  </View>
                </View>
              ))}
              <View style={[styles.infoNote, { marginTop: 14 }]}>
                <Feather name="info" size={13} color={C.indigo} />
                <Text style={styles.infoNoteText}>Exponential backoff: 2^n seconds between retries (max 30s). After {recovery.maxAttempts} failed attempts, the app is notified.</Text>
              </View>
            </View>

            {/* Design principles */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Design Principles (§1.10)</Text>
              {DESIGN_PRINCIPLES.map((p, i) => (
                <View key={i} style={styles.principleRow}>
                  <Feather name="check" size={13} color={C.on} />
                  <Text style={styles.principleText}>{p}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Tiny components ──────────────────────────────────────────────────────────

function QuickStat({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <View style={styles.quickStat}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={[styles.quickStatVal, { color }]}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
      <Text style={styles.quickStatSub}>{sub}</Text>
    </View>
  );
}

function LabelVal({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.labelVal}>
      <Text style={styles.labelValLabel}>{label}</Text>
      <Text style={[styles.labelValValue, { color }]}>{value}</Text>
    </View>
  );
}

function MatrixItem({ label, ok, icon }: { label: string; ok: boolean; icon: string }) {
  return (
    <View style={[styles.matrixItem, { backgroundColor: (ok ? C.on : C.off) + "12", borderColor: (ok ? C.on : C.off) + "25" }]}>
      <Feather name={icon as any} size={14} color={ok ? C.on : C.off} />
      <Text style={[styles.matrixLabel, { color: ok ? C.on : C.off }]} numberOfLines={1}>{label}</Text>
      <Feather name={ok ? "check" : "x"} size={10} color={ok ? C.on : C.off} />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECOVERY_PHASES = [
  { id: "checking_network",    label: "Check Local Network",       desc: "Verify local network is still available" },
  { id: "searching_device",    label: "Search for ESP32",           desc: "Scan subnet for the device" },
  { id: "rediscovering_ip",   label: "Rediscover IP Address",      desc: "mDNS/UDP broadcast for new IP" },
  { id: "restoring",          label: "Restore Communication",      desc: "Re-establish the connection session" },
] as const;

type RecoveryPhaseId = typeof RECOVERY_PHASES[number]["id"];
const RECOVERY_PHASE_ORDER = RECOVERY_PHASES.map(p => p.id) as RecoveryPhaseId[];

const DESIGN_PRINCIPLES = [
  "Automatic reconnection after first setup — no manual action required",
  "Automatic ESP32 discovery on every reconnect",
  "Dynamic IP address detection — no fixed IP ever needed",
  "Secure end-to-end communication at all times",
  "No manual IP configuration, ever",
  "Fast recovery after network interruptions with exponential backoff",
  "Seamless integration with Device, MQTT, Firmware & P2P Engines",
  "Compatible with Android and iOS platform differences",
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  quickStats: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.b0 },
  quickStat: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  quickStatVal: { fontSize: 15, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  quickStatLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", textTransform: "uppercase" },
  quickStatSub: { fontSize: 8, color: C.mute, fontFamily: "Inter_400Regular" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.b0 },
  tab: { flex: 1, paddingVertical: 11, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.accentL },
  tabText: { fontSize: 12, color: C.mute, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  tabTextActive: { color: C.accentL },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 50, gap: 12 },
  card: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  cardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  bigVal: { fontSize: 18, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 },
  labelVal: {},
  labelValLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", marginBottom: 2 },
  labelValValue: { fontSize: 12, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  historyPoints: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  miniChart: { flexDirection: "row", gap: 2, alignItems: "flex-end", height: 50, backgroundColor: C.elevated, borderRadius: 8, padding: 4 },
  miniChartBar: { flex: 1, justifyContent: "flex-end" },
  miniChartFill: { borderRadius: 2 },
  chartLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  chartLegendText: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
  matrixGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  matrixItem: { width: "47%", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, padding: 10 },
  matrixLabel: { flex: 1, fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  detailGrid: { gap: 10 },
  detail: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.b0 },
  detailLabel: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 12, color: C.txt, fontFamily: "Inter_600SemiBold" },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.b0, paddingVertical: 12 },
  actionText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  logFilters: { paddingBottom: 8 },
  logFilterLabel: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  logRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0, paddingLeft: 4 },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  logSrcBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  logSrcText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  logEvent: { fontSize: 12, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  logDetail: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular", marginTop: 1 },
  logTime: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 4 },
  recoverPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  recoverPillText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  recoverStats: { flexDirection: "row", gap: 20, marginBottom: 12 },
  recoveryPhases: { gap: 8 },
  recoveryPhaseRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recoveryPhaseDot: { width: 10, height: 10, borderRadius: 5 },
  recoveryPhaseLabel: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  recoverHint: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular", lineHeight: 18 },
  triggerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: C.gold + "18", borderRadius: 14, borderWidth: 1, borderColor: C.gold + "40", paddingVertical: 14 },
  triggerBtnText: { fontSize: 14, fontWeight: "700" as const, color: C.gold, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 10, fontWeight: "700" as const, color: C.mute, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14, fontFamily: "Inter_600SemiBold" },
  seqRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  seqNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.indigo + "20", alignItems: "center", justifyContent: "center", marginTop: 1 },
  seqNumText: { fontSize: 11, fontWeight: "700" as const, color: C.indigo, fontFamily: "Inter_700Bold" },
  seqLabel: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", marginBottom: 2 },
  seqDesc: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  infoNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.indigo + "12", borderRadius: 10, borderWidth: 1, borderColor: C.indigo + "25", padding: 12 },
  infoNoteText: { flex: 1, fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular", lineHeight: 17 },
  principleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.b0 },
  principleText: { flex: 1, fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular" },
  emptyCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 36, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptyHint: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center" },
});
