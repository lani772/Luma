import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useConnectivity } from "@/context/ConnectivityContext";
import type { MeshPeer, GatewayInfo, OfflineQueueEntry, RouteType } from "@/engines/p2p-engine";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROUTE_COLORS: Record<RouteType, string> = {
  direct_wifi: C.teal,
  direct_bluetooth: C.purple,
  bluetooth_mesh: C.indigo,
  local_mqtt: C.on,
  internet_mqtt: C.gold,
  backend_relay: C.rose,
};

const ROUTE_ICONS: Record<RouteType, string> = {
  direct_wifi: "wifi",
  direct_bluetooth: "bluetooth",
  bluetooth_mesh: "share-2",
  local_mqtt: "radio",
  internet_mqtt: "cloud",
  backend_relay: "server",
};

const TRANSPORT_COLOR: Record<string, string> = {
  bluetooth: C.purple,
  wifi_direct: C.teal,
  lan: C.indigo,
};

const HOP_TYPE_ICON: Record<string, string> = {
  phone: "smartphone", broker: "server", gateway: "users", device: "cpu", backend: "cloud",
};

function fmtTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function rssiBar(rssi: number | undefined): string {
  if (!rssi) return "—";
  if (rssi >= -60) return "████";
  if (rssi >= -70) return "███░";
  if (rssi >= -80) return "██░░";
  return "█░░░";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PeerCard({ peer, onConnect, onDisconnect }: {
  peer: MeshPeer;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}) {
  const tColor = TRANSPORT_COLOR[peer.transport] ?? C.sec;
  return (
    <View style={[styles.peerCard, peer.trusted && { borderColor: tColor + "30" }]}>
      <View style={[styles.peerAvatar, { backgroundColor: tColor + "18", borderColor: tColor + "35" }]}>
        <Feather name="smartphone" size={16} color={tColor} />
        {peer.online && <View style={styles.peerOnlineDot} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Text style={styles.peerName}>{peer.name}</Text>
          {peer.isGateway && (
            <View style={styles.gatewayBadge}>
              <Feather name="server" size={9} color={C.on} />
              <Text style={styles.gatewayBadgeText}>Gateway</Text>
            </View>
          )}
          {peer.trusted && (
            <View style={styles.trustedBadge}>
              <Feather name="check" size={9} color={C.teal} />
              <Text style={styles.trustedBadgeText}>Trusted</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View style={[styles.transportPill, { backgroundColor: tColor + "15", borderColor: tColor + "35" }]}>
            <Feather name={peer.transport === "bluetooth" ? "bluetooth" : peer.transport === "wifi_direct" ? "wifi" : "server"} size={9} color={tColor} />
            <Text style={[styles.transportText, { color: tColor }]}>{peer.transport.replace("_", " ")}</Text>
          </View>
          {peer.rssi && <Text style={styles.rssiText}>{rssiBar(peer.rssi)} {peer.rssi}dBm</Text>}
          <Text style={styles.peerMeta}>hop {peer.hopCount}</Text>
        </View>
        <Text style={styles.peerAddr} numberOfLines={1}>{peer.address} · {peer.appVersion}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[styles.capBadge, peer.btCapability && { backgroundColor: C.purple + "15" }]}>
            <Feather name="bluetooth" size={9} color={peer.btCapability ? C.purple : C.mute} />
            <Text style={[styles.capText, { color: peer.btCapability ? C.purple : C.mute }]}>BT</Text>
          </View>
          <View style={[styles.capBadge, peer.encryptionCapability && { backgroundColor: C.on + "15" }]}>
            <Feather name="lock" size={9} color={peer.encryptionCapability ? C.on : C.mute} />
            <Text style={[styles.capText, { color: peer.encryptionCapability ? C.on : C.mute }]}>E2E</Text>
          </View>
        </View>
      </View>
      <View style={{ gap: 6, alignItems: "flex-end" }}>
        <Text style={styles.peerSeen}>{fmtTime(peer.lastSeen)}</Text>
        {peer.online && !peer.trusted && (
          <TouchableOpacity style={styles.connectBtn} onPress={() => onConnect(peer.peerId)}>
            <Text style={styles.connectBtnText}>Trust</Text>
          </TouchableOpacity>
        )}
        {peer.trusted && (
          <TouchableOpacity style={[styles.connectBtn, styles.disconnectBtn]} onPress={() => onDisconnect(peer.peerId)}>
            <Text style={[styles.connectBtnText, { color: C.off }]}>Revoke</Text>
          </TouchableOpacity>
        )}
        {!peer.online && <View style={[styles.offlinePill]}><Text style={styles.offlineText}>Offline</Text></View>}
      </View>
    </View>
  );
}

function GatewayCard({ gw }: { gw: GatewayInfo }) {
  const typeColor = gw.type === "wifi" ? C.teal : gw.type === "local_mqtt" ? C.indigo : C.gold;
  return (
    <View style={[styles.gatewayCard, { borderColor: typeColor + "30" }]}>
      <View style={[styles.gwIconWrap, { backgroundColor: typeColor + "18" }]}>
        <Feather name="server" size={16} color={typeColor} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Text style={styles.gwName}>{gw.name}</Text>
          <View style={[styles.gwTypePill, { backgroundColor: typeColor + "15", borderColor: typeColor + "35" }]}>
            <Text style={[styles.gwTypeText, { color: typeColor }]}>{gw.type.replace("_", " ")}</Text>
          </View>
          {gw.maintenanceOnly && (
            <View style={styles.moPill}>
              <Feather name="shield" size={9} color={C.gold} />
              <Text style={styles.moText}>Maintenance only</Text>
            </View>
          )}
        </View>
        <Text style={styles.gwTargets}>Covering {gw.targetDevices.length} device{gw.targetDevices.length !== 1 ? "s" : ""}: {gw.targetDevices.join(", ")}</Text>
        <View style={styles.capRow}>
          {gw.capabilities.map(c => (
            <View key={c} style={styles.gwCapBadge}>
              <Text style={styles.gwCapText}>{c.replace(/_/g, " ")}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.gwOnlineDot, { backgroundColor: gw.online ? C.on : C.off }]} />
    </View>
  );
}

function QueueCard({ entry }: { entry: OfflineQueueEntry }) {
  const statusColor = {
    queued: C.gold, retrying: C.indigo, delivered: C.on, expired: C.mute, failed: C.off,
  }[entry.status] ?? C.sec;
  return (
    <View style={[styles.queueCard, { borderLeftColor: statusColor }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Text style={styles.queueCmd}>{entry.command}</Text>
          <View style={[styles.queueStatusPill, { backgroundColor: statusColor + "18", borderColor: statusColor + "35" }]}>
            <Text style={[styles.queueStatusText, { color: statusColor }]}>{entry.status}</Text>
          </View>
        </View>
        <Text style={styles.queueDevice}>→ {entry.deviceId}</Text>
        <Text style={styles.queueMeta}>
          {entry.attempts}/{entry.maxAttempts} attempts ·{" "}
          expires {fmtTime(entry.expiresAt - (Date.now() - entry.expiresAt))}
          {entry.targetRoute && ` · via ${entry.targetRoute.replace("_", " ")}`}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MeshScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const {
    peers, gateways, activeRoute, offlineQueue, isGatewayMode, meshSynced, isDiscoveringPeers,
    discoverPeers, connectPeer, disconnectPeer, syncMesh, enableGatewayMode, disableGatewayMode,
    discoverGateway, selectBestRoute, requestMaintenanceSync,
  } = useConnectivity();

  const [tab, setTab] = useState<"route" | "peers" | "queue" | "gateways">("route");

  const routeColor = activeRoute ? (ROUTE_COLORS[activeRoute.type] ?? C.accentL) : C.mute;
  const pendingCount = offlineQueue.filter(e => e.status === "queued" || e.status === "retrying").length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>BT Mesh Network</Text>
          <Text style={styles.subtitle}>Peer-to-Peer · Store-and-Forward</Text>
        </View>
        <View style={[styles.encBadge]}>
          <Feather name="lock" size={11} color={C.on} />
          <Text style={styles.encText}>E2E</Text>
        </View>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <SummaryItem icon="users" value={peers.length} label="Peers" color={C.indigo} />
        <SummaryItem icon="server" value={gateways.length} label="Gateways" color={C.on} />
        <SummaryItem icon="inbox" value={pendingCount} label="Queued" color={C.gold} />
        <SummaryItem icon="git-branch" value={activeRoute?.priority ?? 0} label="Priority" color={routeColor} />
      </View>

      {/* Gateway mode toggle */}
      <View style={styles.gwModeBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.gwModeLabel}>Community Gateway Mode</Text>
          <Text style={styles.gwModeSub}>Relay maintenance tasks for nearby devices</Text>
        </View>
        <TouchableOpacity
          style={[styles.gwToggle, isGatewayMode && styles.gwToggleOn]}
          onPress={isGatewayMode ? disableGatewayMode : enableGatewayMode}
        >
          <Text style={[styles.gwToggleText, isGatewayMode && { color: C.on }]}>
            {isGatewayMode ? "ON" : "OFF"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["route", "peers", "queue", "gateways"] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "queue" ? `Queue${pendingCount > 0 ? ` (${pendingCount})` : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Route tab */}
        {tab === "route" && (
          <>
            {activeRoute ? (
              <View style={[styles.card, { borderColor: routeColor + "30" }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: routeColor + "18" }]}>
                    <Feather name={(ROUTE_ICONS[activeRoute.type] ?? "zap") as any} size={16} color={routeColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{activeRoute.label}</Text>
                    <Text style={styles.cardSub}>Priority {activeRoute.priority} · {activeRoute.quality} quality</Text>
                  </View>
                  <View style={{ gap: 4, alignItems: "flex-end" }}>
                    <Text style={[styles.latencyText, { color: routeColor }]}>{Math.round(activeRoute.latency)}ms</Text>
                    <Feather name="lock" size={11} color={C.on} />
                  </View>
                </View>

                {/* Hop visualization */}
                <View style={styles.hopsContainer}>
                  {activeRoute.hops.map((hop, i) => {
                    const hopColor = hop.status === "offline" ? C.off : hop.status === "relay" ? C.gold : routeColor;
                    return (
                      <View key={hop.id} style={styles.hopRow}>
                        {i > 0 && (
                          <View style={styles.hopConnector}>
                            <View style={[styles.hopLine, { backgroundColor: routeColor + "40" }]} />
                            <Feather name="chevron-down" size={12} color={routeColor + "80"} />
                          </View>
                        )}
                        <View style={[styles.hopCard, { borderColor: hopColor + "35", backgroundColor: hopColor + "08" }]}>
                          <View style={[styles.hopIconWrap, { backgroundColor: hopColor + "20" }]}>
                            <Feather name={(HOP_TYPE_ICON[hop.type] ?? "circle") as any} size={16} color={hopColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.hopLabel}>{hop.label}</Text>
                            <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                              {hop.transport && (
                                <View style={[styles.hopTransportBadge, { backgroundColor: hopColor + "18" }]}>
                                  <Text style={[styles.hopTransportText, { color: hopColor }]}>{hop.transport}</Text>
                                </View>
                              )}
                              <View style={[styles.hopStatusBadge, { backgroundColor: (hop.status === "relay" ? C.gold : hop.status === "offline" ? C.off : C.on) + "18" }]}>
                                <Text style={[styles.hopStatusText, { color: hop.status === "relay" ? C.gold : hop.status === "offline" ? C.off : C.on }]}>
                                  {hop.status}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Feather name="git-branch" size={36} color={C.mute} />
                <Text style={styles.emptyTitle}>No active route</Text>
                <Text style={styles.emptyHint}>Discover peers or connect to WiFi to establish a route</Text>
              </View>
            )}

            {/* Route priority reference */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Route Priority (§2.5.2)</Text>
              {ROUTE_PRIORITY_LIST.map(r => (
                <View key={r.type} style={styles.priorityRow}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ROUTE_COLORS[r.type] + "20", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 10, fontWeight: "700" as const, color: ROUTE_COLORS[r.type], fontFamily: "Inter_700Bold" }}>{r.priority}</Text>
                  </View>
                  <Feather name={(ROUTE_ICONS[r.type] ?? "zap") as any} size={13} color={ROUTE_COLORS[r.type]} />
                  <Text style={[styles.priorityLabel, activeRoute?.type === r.type && { color: ROUTE_COLORS[r.type], fontFamily: "Inter_700Bold" }]}>
                    {r.label}
                  </Text>
                  {activeRoute?.type === r.type && (
                    <View style={[styles.activePill, { backgroundColor: ROUTE_COLORS[r.type] + "20", borderColor: ROUTE_COLORS[r.type] + "40" }]}>
                      <Text style={[styles.activePillText, { color: ROUTE_COLORS[r.type] }]}>ACTIVE</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: C.indigo + "35" }]} onPress={() => discoverPeers()}>
                <Feather name="bluetooth" size={16} color={C.indigo} />
                <Text style={[styles.actionText, { color: C.indigo }]}>Discover Peers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: C.teal + "35" }]} onPress={selectBestRoute}>
                <Feather name="git-branch" size={16} color={C.teal} />
                <Text style={[styles.actionText, { color: C.teal }]}>Best Route</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: C.on + "35" }]} onPress={syncMesh}>
                <Feather name="refresh-cw" size={16} color={C.on} />
                <Text style={[styles.actionText, { color: C.on }]}>Sync Mesh</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: C.gold + "35" }]} onPress={discoverGateway}>
                <Feather name="server" size={16} color={C.gold} />
                <Text style={[styles.actionText, { color: C.gold }]}>Find Gateway</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Peers tab */}
        {tab === "peers" && (
          <>
            <View style={styles.tabActionRow}>
              <TouchableOpacity style={[styles.scanBtn, isDiscoveringPeers && { opacity: 0.6 }]}
                onPress={() => discoverPeers()} disabled={isDiscoveringPeers}>
                <Feather name={isDiscoveringPeers ? "loader" : "bluetooth"} size={14} color={C.indigo} />
                <Text style={styles.scanBtnText}>{isDiscoveringPeers ? "Scanning…" : "Scan for Peers"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanBtn} onPress={() => discoverPeers("wifi_direct")}>
                <Feather name="wifi" size={14} color={C.teal} />
                <Text style={[styles.scanBtnText, { color: C.teal }]}>WiFi Direct</Text>
              </TouchableOpacity>
            </View>
            {peers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="bluetooth" size={36} color={C.mute} />
                <Text style={styles.emptyTitle}>No peers found</Text>
                <Text style={styles.emptyHint}>Tap "Scan for Peers" to discover nearby phones running LUMA</Text>
              </View>
            ) : (
              peers.map(peer => (
                <PeerCard
                  key={peer.peerId}
                  peer={peer}
                  onConnect={connectPeer}
                  onDisconnect={disconnectPeer}
                />
              ))
            )}
            <View style={[styles.card, { marginTop: 8 }]}>
              <Text style={styles.sectionLabel}>Peer Discovery Info (§2.2.1)</Text>
              <Text style={styles.infoText}>Each peer exchange includes: Peer ID · User ID · Device ID · Bluetooth capability · App version · Encryption capability · Last sync time</Text>
            </View>
          </>
        )}

        {/* Queue tab */}
        {tab === "queue" && (
          <>
            <View style={styles.tabActionRow}>
              <TouchableOpacity style={[styles.scanBtn, { borderColor: C.on + "35" }]} onPress={syncMesh}>
                <Feather name="refresh-cw" size={14} color={C.on} />
                <Text style={[styles.scanBtnText, { color: C.on }]}>Sync Now</Text>
              </TouchableOpacity>
              {meshSynced && (
                <View style={[styles.syncedBadge]}>
                  <Feather name="check-circle" size={13} color={C.on} />
                  <Text style={styles.syncedText}>Mesh synced</Text>
                </View>
              )}
            </View>
            {offlineQueue.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="check-circle" size={36} color={C.on} />
                <Text style={styles.emptyTitle}>Queue is clear</Text>
                <Text style={styles.emptyHint}>All commands have been delivered</Text>
              </View>
            ) : (
              offlineQueue.map(entry => (
                <QueueCard key={entry.id} entry={entry} />
              ))
            )}
            {pendingCount > 0 && (
              <View style={styles.offlineInfo}>
                <Feather name="info" size={14} color={C.gold} />
                <Text style={styles.offlineInfoText}>
                  {pendingCount} command{pendingCount !== 1 ? "s" : ""} waiting for a valid route. They will deliver automatically when connectivity is restored.
                </Text>
              </View>
            )}
            <View style={[styles.card, { marginTop: 8 }]}>
              <Text style={styles.sectionLabel}>Offline Queue (§2.5.7)</Text>
              <Text style={styles.infoText}>Commands are encrypted, stored locally, and retried automatically. Messages expire after 1 hour if undelivered. Delivery is attempted across all available routes.</Text>
            </View>
          </>
        )}

        {/* Gateways tab */}
        {tab === "gateways" && (
          <>
            <View style={styles.tabActionRow}>
              <TouchableOpacity style={styles.scanBtn} onPress={discoverGateway}>
                <Feather name="search" size={14} color={C.gold} />
                <Text style={[styles.scanBtnText, { color: C.gold }]}>Find Gateways</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanBtn} onPress={() => requestMaintenanceSync("L001")}>
                <Feather name="refresh-cw" size={14} color={C.teal} />
                <Text style={[styles.scanBtnText, { color: C.teal }]}>Maintenance Sync</Text>
              </TouchableOpacity>
            </View>
            {gateways.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="server" size={36} color={C.mute} />
                <Text style={styles.emptyTitle}>No gateways found</Text>
                <Text style={styles.emptyHint}>Enable gateway mode or discover nearby gateway phones</Text>
              </View>
            ) : (
              gateways.map(gw => <GatewayCard key={gw.peerId} gw={gw} />)
            )}
            <View style={[styles.card, { marginTop: 8 }]}>
              <Text style={styles.sectionLabel}>Community Gateway Mode (§2.5.4)</Text>
              <Text style={styles.infoText}>
                Gateways can: discover offline ESP32 devices, report reachability, sync time/schedules/automations, deliver firmware notifications, report device health.{"\n\n"}
                Gateways CANNOT: control devices, modify settings, add users, or change permissions. Only maintenance tasks authorized by the backend are permitted.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Tiny components ──────────────────────────────────────────────────────────

function SummaryItem({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Feather name={icon as any} size={14} color={color} />
      <Text style={[styles.summaryVal, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE_PRIORITY_LIST: { type: RouteType; priority: number; label: string }[] = [
  { type: "direct_wifi",     priority: 1, label: "Direct Wi-Fi" },
  { type: "direct_bluetooth",priority: 2, label: "Direct Bluetooth" },
  { type: "bluetooth_mesh",  priority: 3, label: "Bluetooth Mesh (multi-hop)" },
  { type: "local_mqtt",      priority: 4, label: "Local MQTT Broker" },
  { type: "internet_mqtt",   priority: 5, label: "Internet MQTT Broker" },
  { type: "backend_relay",   priority: 6, label: "Backend Relay" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  encBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: C.on + "18", borderWidth: 1, borderColor: C.on + "35" },
  encText: { fontSize: 11, fontWeight: "700" as const, color: C.on, fontFamily: "Inter_700Bold" },
  summaryStrip: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.b0 },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 3 },
  summaryVal: { fontSize: 18, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular", textTransform: "uppercase" },
  gwModeBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 12, backgroundColor: C.elevated, borderBottomWidth: 1, borderBottomColor: C.b0 },
  gwModeLabel: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  gwModeSub: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  gwToggle: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: C.surface, borderWidth: 1, borderColor: C.b0 },
  gwToggleOn: { backgroundColor: C.on + "20", borderColor: C.on + "50" },
  gwToggleText: { fontSize: 11, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.b0 },
  tab: { flex: 1, paddingVertical: 11, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.accentL },
  tabText: { fontSize: 11, color: C.mute, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  tabTextActive: { color: C.accentL },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 50, gap: 12 },
  card: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  latencyText: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  hopsContainer: { gap: 0 },
  hopRow: { gap: 0 },
  hopConnector: { alignItems: "center", paddingVertical: 2 },
  hopLine: { width: 1, height: 10 },
  hopCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  hopIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  hopLabel: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  hopTransportBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  hopTransportText: { fontSize: 9, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  hopStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  hopStatusText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 10, fontWeight: "700" as const, color: C.mute, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, fontFamily: "Inter_600SemiBold" },
  infoText: { fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular", lineHeight: 18 },
  priorityRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.b0 },
  priorityLabel: { flex: 1, fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  activePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  activePillText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { flex: 1, minWidth: "44%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, padding: 12 },
  actionText: { fontSize: 12, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  tabActionRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.indigo + "35" },
  scanBtnText: { fontSize: 12, color: C.indigo, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  syncedBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.on + "18" },
  syncedText: { fontSize: 12, color: C.on, fontFamily: "Inter_600SemiBold" },
  peerCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14 },
  peerAvatar: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center", position: "relative" },
  peerOnlineDot: { position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: C.on, borderWidth: 2, borderColor: C.bg },
  peerName: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  gatewayBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: C.on + "18" },
  gatewayBadgeText: { fontSize: 9, fontWeight: "700" as const, color: C.on, fontFamily: "Inter_700Bold" },
  trustedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: C.teal + "18" },
  trustedBadgeText: { fontSize: 9, fontWeight: "700" as const, color: C.teal, fontFamily: "Inter_700Bold" },
  transportPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  transportText: { fontSize: 9, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  rssiText: { fontSize: 10, color: C.sec, fontFamily: "Inter_400Regular" },
  peerMeta: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  peerAddr: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  capBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: C.elevated },
  capText: { fontSize: 8, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  peerSeen: { fontSize: 9, color: C.mute, fontFamily: "Inter_400Regular" },
  connectBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: C.teal + "20", borderWidth: 1, borderColor: C.teal + "40" },
  disconnectBtn: { backgroundColor: C.off + "15", borderColor: C.off + "35" },
  connectBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.teal, fontFamily: "Inter_700Bold" },
  offlinePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: C.mute + "20" },
  offlineText: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  queueCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.b0, borderLeftWidth: 3, padding: 12, marginBottom: 8 },
  queueCmd: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  queueStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  queueStatusText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  queueDevice: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular", marginTop: 2 },
  queueMeta: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 2 },
  offlineInfo: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.gold + "15", borderRadius: 12, borderWidth: 1, borderColor: C.gold + "30", padding: 12 },
  offlineInfoText: { flex: 1, fontSize: 12, color: C.sec, fontFamily: "Inter_400Regular", lineHeight: 18 },
  gatewayCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 8 },
  gwIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  gwName: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  gwTypePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  gwTypeText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  moPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: C.gold + "18" },
  moText: { fontSize: 9, fontWeight: "600" as const, color: C.gold, fontFamily: "Inter_600SemiBold" },
  gwTargets: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular", marginTop: 3 },
  capRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  gwCapBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: C.elevated },
  gwCapText: { fontSize: 9, color: C.sec, fontFamily: "Inter_400Regular" },
  gwOnlineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  emptyCard: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.b0, padding: 36, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptyHint: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular", textAlign: "center" },
});
