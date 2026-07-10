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
import { ESP32_GPIO_PINS, MC_FIRMWARE_HISTORY, MCDevice, Microcontroller } from "@/data/luma-data";
import ProgressBar from "@/components/ProgressBar";

const TABS = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "devices", label: "Devices", icon: "zap" },
  { id: "gpio", label: "GPIO", icon: "sliders" },
  { id: "network", label: "Network", icon: "wifi" },
  { id: "firmware", label: "Firmware", icon: "package" },
  { id: "diagnostics", label: "Diagnostics", icon: "activity" },
  { id: "maintenance", label: "Maintenance", icon: "tool" },
  { id: "settings", label: "Settings", icon: "settings" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function MicrocontrollerWorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { microcontrollers, mcDevices, toggleMCDevice, deleteMCDevice, updateMicrocontroller } = useLuma();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const mc = microcontrollers.find(m => m.id === id);
  const devices = mcDevices.filter(d => d.mcId === id);

  if (!mc) {
    return (
      <View style={[styles.root, { paddingTop: topPad, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: C.mute, fontFamily: "Inter_400Regular" }}>Microcontroller not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: C.accentL, fontFamily: "Inter_700Bold" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderSection() {
    switch (activeTab) {
      case "overview":     return <OverviewSection mc={mc!} devices={devices} onRegisterDevice={() => router.push(`/mc-device-register?mcId=${mc!.id}` as any)} onRefresh={() => Alert.alert("Refresh", "Polling device status…")} onRestart={() => Alert.alert("Restart", `Restart "${mc!.name}"?`, [{ text: "Cancel" }, { text: "Restart", style: "destructive", onPress: () => {} }])} />;
      case "devices":      return <DevicesSection mc={mc!} devices={devices} onToggle={toggleMCDevice} onRegister={() => router.push(`/mc-device-register?mcId=${mc!.id}` as any)} onOpenDevice={(d) => router.push(`/mc-device?mcId=${mc!.id}&deviceId=${d.id}` as any)} />;
      case "gpio":         return <GPIOSection mc={mc!} devices={devices} onRelease={deleteMCDevice} onAssign={(pin) => router.push(`/mc-device-register?mcId=${mc!.id}&gpio=${pin}` as any)} />;
      case "network":      return <NetworkSection mc={mc!} />;
      case "firmware":     return <FirmwareSection mc={mc!} />;
      case "diagnostics":  return <DiagnosticsSection mc={mc!} />;
      case "maintenance":  return <MaintenanceSection mc={mc!} />;
      case "settings":     return <SettingsSection mc={mc!} onUpdate={(patch) => updateMicrocontroller(mc!.id, patch)} />;
      default:             return null;
    }
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerName} numberOfLines={1}>{mc.name}</Text>
          <Text style={styles.headerSub}>{mc.model} · {mc.room}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: mc.online ? C.on + "20" : C.off + "20", borderColor: mc.online ? C.on + "40" : C.off + "40" }]}>
          <View style={[styles.statusDot, { backgroundColor: mc.online ? C.on : C.off }]} />
          <Text style={[styles.statusText, { color: mc.online ? C.on : C.off }]}>{mc.online ? "Online" : "Offline"}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Feather name={tab.icon as any} size={13} color={active ? "#f97316" : C.mute} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Section content */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderSection()}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────

function OverviewSection({ mc, devices, onRegisterDevice, onRefresh, onRestart }: {
  mc: Microcontroller; devices: MCDevice[];
  onRegisterDevice: () => void; onRefresh: () => void; onRestart: () => void;
}) {
  return (
    <View style={s.gap}>
      <SLabel>Status</SLabel>
      <View style={s.card}>
        <InfoRow icon="tag" label="Module Name" value={mc.name} />
        <Divider />
        <InfoRow icon="circle" label="Status" value={mc.online ? "Online" : "Offline"} valueColor={mc.online ? C.on : C.off} />
        <Divider />
        <InfoRow icon="package" label="Firmware" value={mc.firmware} />
        <Divider />
        <InfoRow icon="zap" label="Devices" value={`${devices.length}`} />
        <Divider />
        <InfoRow icon="globe" label="IP Address" value={mc.ipAddress} />
        <Divider />
        <InfoRow icon="wifi" label="Wi-Fi Network" value={mc.wifiSsid || "—"} />
      </View>

      <SLabel>Performance</SLabel>
      <View style={s.card}>
        <PerfRow label="CPU Usage" value={mc.cpuUsage} max={100} unit="%" color={mc.cpuUsage > 80 ? C.off : C.on} />
        <Divider />
        <PerfRow label="Memory Usage" value={mc.memoryUsage} max={100} unit="%" color={mc.memoryUsage > 75 ? C.warn : C.teal} />
        <Divider />
        <InfoRow icon="clock" label="Uptime" value={mc.uptime} />
      </View>

      <SLabel>Quick Actions</SLabel>
      <View style={s.row}>
        <ActionBtn icon="plus-circle" label="Register Device" color="#f97316" onPress={onRegisterDevice} />
        <ActionBtn icon="refresh-cw" label="Restart" color={C.warn} onPress={onRestart} />
        <ActionBtn icon="refresh-ccw" label="Refresh" color={C.teal} onPress={onRefresh} />
      </View>
    </View>
  );
}

// ── Devices ─────────────────────────────────────────────────────────────────

function DevicesSection({ mc, devices, onToggle, onRegister, onOpenDevice }: {
  mc: Microcontroller; devices: MCDevice[];
  onToggle: (id: string) => void;
  onRegister: () => void;
  onOpenDevice: (d: MCDevice) => void;
}) {
  return (
    <View style={s.gap}>
      <TouchableOpacity style={s.primaryBtn} onPress={onRegister} activeOpacity={0.8}>
        <Feather name="plus" size={16} color="#fff" />
        <Text style={s.primaryBtnText}>Register Device</Text>
      </TouchableOpacity>

      {devices.length === 0 && (
        <View style={s.empty}>
          <Feather name="zap" size={28} color={C.mute2} />
          <Text style={s.emptyText}>No devices registered yet</Text>
        </View>
      )}

      {devices.map(d => (
        <TouchableOpacity key={d.id} style={s.card} onPress={() => onOpenDevice(d)} activeOpacity={0.8}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[s.iconBox, { backgroundColor: (d.on ? C.on : C.mute2) + "20", borderColor: (d.on ? C.on : C.mute2) + "40" }]}>
              <Feather name={d.icon as any} size={18} color={d.on ? C.on : C.mute2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardName}>{d.name}</Text>
              <Text style={s.cardSub}>{d.room} · GPIO {d.gpioPin}</Text>
            </View>
            <Switch
              value={d.on}
              onValueChange={() => onToggle(d.id)}
              trackColor={{ false: C.mute2, true: C.on + "80" }}
              thumbColor={d.on ? C.on : C.sec}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.b0 }}>
            <Chip label={`GPIO ${d.gpioPin}`} color={C.teal} />
            <Chip label={d.activeHigh ? "Active HIGH" : "Active LOW"} color={C.accentL} />
            <Chip label={d.startupState === "on" ? "Always ON" : d.startupState === "off" ? "Always OFF" : "Restore"} color={C.gold} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── GPIO Manager ─────────────────────────────────────────────────────────────

function GPIOSection({ mc, devices, onRelease, onAssign }: {
  mc: Microcontroller; devices: MCDevice[];
  onRelease: (id: string) => void;
  onAssign: (pin: number) => void;
}) {
  const assignedMap: Record<number, MCDevice> = {};
  devices.forEach(d => { assignedMap[d.gpioPin] = d; });

  return (
    <View style={s.gap}>
      <View style={s.row}>
        <View style={[s.miniChip, { backgroundColor: C.on + "15", borderColor: C.on + "30" }]}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.on }} />
          <Text style={{ fontSize: 11, color: C.on, fontFamily: "Inter_700Bold" }}>Available</Text>
        </View>
        <View style={[s.miniChip, { backgroundColor: C.accentL + "15", borderColor: C.accentL + "30" }]}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accentL }} />
          <Text style={{ fontSize: 11, color: C.accentL, fontFamily: "Inter_700Bold" }}>Assigned</Text>
        </View>
      </View>

      {ESP32_GPIO_PINS.map(pin => {
        const assigned = assignedMap[pin];
        return (
          <View key={pin} style={[s.card, { borderColor: assigned ? C.accentL + "25" : C.b0 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[s.gpioBadge, { backgroundColor: assigned ? C.accentL + "18" : C.on + "12", borderColor: assigned ? C.accentL + "40" : C.on + "30" }]}>
                <Text style={[s.gpioBadgeNum, { color: assigned ? C.accentL : C.on }]}>{pin}</Text>
                <Text style={[s.gpioBadgeLabel, { color: assigned ? C.accentL : C.on }]}>GPIO</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{assigned ? assigned.name : "Available"}</Text>
                <Text style={s.cardSub}>{assigned ? `${assigned.room} · ${assigned.activeHigh ? "Active HIGH" : "Active LOW"}` : "Not assigned"}</Text>
              </View>
              {assigned ? (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity style={s.gpioBtn} onPress={() => Alert.alert("Test GPIO", `Test signal sent to GPIO ${pin}`)}>
                    <Text style={s.gpioBtnText}>Test</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.gpioBtn, { borderColor: C.off + "50", backgroundColor: C.off + "12" }]}
                    onPress={() => Alert.alert("Release GPIO", `Release GPIO ${pin} from "${assigned.name}"?`, [
                      { text: "Cancel" },
                      { text: "Release", style: "destructive", onPress: () => onRelease(assigned.id) },
                    ])}
                  >
                    <Text style={[s.gpioBtnText, { color: C.off }]}>Release</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.gpioBtn, { borderColor: "#f97316" + "50", backgroundColor: "#f97316" + "12" }]}
                  onPress={() => onAssign(pin)}
                >
                  <Text style={[s.gpioBtnText, { color: "#f97316" }]}>Assign</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Network ──────────────────────────────────────────────────────────────────

function NetworkSection({ mc }: { mc: Microcontroller }) {
  const sigColor = mc.wifiSignal >= -60 ? C.on : mc.wifiSignal >= -70 ? C.warn : C.off;
  return (
    <View style={s.gap}>
      <SLabel>Wi-Fi</SLabel>
      <View style={s.card}>
        <InfoRow icon="wifi" label="SSID" value={mc.wifiSsid || "—"} />
        <Divider />
        <InfoRow icon="radio" label="Channel" value={mc.wifiChannel ? `CH ${mc.wifiChannel}` : "—"} />
        <Divider />
        <InfoRow icon="bar-chart-2" label="Signal (RSSI)" value={mc.online ? `${mc.wifiSignal} dBm` : "—"} valueColor={sigColor} />
      </View>

      <SLabel>Interfaces</SLabel>
      <View style={s.card}>
        <InfoRow icon="bluetooth" label="Bluetooth" value={mc.bluetoothEnabled ? "Enabled" : "Disabled"} valueColor={mc.bluetoothEnabled ? C.on : C.mute} />
        <Divider />
        <InfoRow icon="globe" label="HTTP Server" value={mc.httpEnabled ? "Enabled" : "Disabled"} valueColor={mc.httpEnabled ? C.on : C.mute} />
      </View>

      <SLabel>Addressing</SLabel>
      <View style={s.card}>
        <InfoRow icon="globe" label="IP Address" value={mc.ipAddress} />
        <Divider />
        <InfoRow icon="hash" label="MAC Address" value={mc.mac} />
      </View>
    </View>
  );
}

// ── Firmware ─────────────────────────────────────────────────────────────────

function FirmwareSection({ mc }: { mc: Microcontroller }) {
  return (
    <View style={s.gap}>
      <SLabel>Current Version</SLabel>
      <View style={[s.card, { borderColor: C.on + "25" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={[s.iconBox, { backgroundColor: C.on + "18", borderColor: C.on + "30" }]}>
            <Feather name="package" size={20} color={C.on} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" }}>{mc.firmware}</Text>
            <Text style={{ fontSize: 12, color: C.on, fontFamily: "Inter_400Regular", marginTop: 2 }}>Up to date</Text>
          </View>
        </View>
      </View>

      <SLabel>OTA Update</SLabel>
      <TouchableOpacity
        style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12, borderColor: C.accentL + "25" }]}
        onPress={() => Alert.alert("OTA Update", "Check for firmware updates?\n\nThis will connect to the update server.", [{ text: "Cancel" }, { text: "Check for Updates" }])}
        activeOpacity={0.8}
      >
        <View style={[s.iconBox, { backgroundColor: C.accentL + "18", borderColor: C.accentL + "30" }]}>
          <Feather name="download-cloud" size={20} color={C.accentL} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>Check for Updates</Text>
          <Text style={s.cardSub}>Over-the-air firmware update</Text>
        </View>
        <Feather name="chevron-right" size={16} color={C.mute2} />
      </TouchableOpacity>

      <SLabel>History</SLabel>
      {MC_FIRMWARE_HISTORY.map((h, i) => (
        <View key={i} style={[s.card, i === 0 && { borderColor: C.on + "20" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[s.versionDot, { backgroundColor: i === 0 ? C.on : C.mute2 }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.cardName, i === 0 && { color: C.on }]}>{h.version}</Text>
              <Text style={s.cardSub}>{h.notes}</Text>
            </View>
            <Text style={{ fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" }}>{h.date}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

function DiagnosticsSection({ mc }: { mc: Microcontroller }) {
  const tempColor = mc.temperature > 70 ? C.off : mc.temperature > 55 ? C.warn : C.on;
  return (
    <View style={s.gap}>
      <SLabel>Resource Usage</SLabel>
      <View style={s.card}>
        <DiagRow label="CPU Usage" value={mc.cpuUsage} max={100} unit="%" color={mc.cpuUsage > 80 ? C.off : C.on} />
        <Divider />
        <DiagRow label="RAM Usage" value={mc.memoryUsage} max={100} unit="%" color={mc.memoryUsage > 75 ? C.warn : C.teal} />
        <Divider />
        <DiagRow label="Flash Usage" value={mc.flashUsage} max={100} unit="%" color={mc.flashUsage > 85 ? C.warn : C.accentL} />
      </View>

      <SLabel>Connectivity</SLabel>
      <View style={s.card}>
        <InfoRow icon="wifi" label="Wi-Fi Signal" value={mc.online ? `${mc.wifiSignal} dBm` : "—"} valueColor={mc.online ? (mc.wifiSignal >= -60 ? C.on : mc.wifiSignal >= -70 ? C.warn : C.off) : C.mute} />
      </View>

      <SLabel>System</SLabel>
      <View style={s.card}>
        <InfoRow icon="thermometer" label="Temperature" value={mc.online && mc.temperature ? `${mc.temperature}°C` : "—"} valueColor={tempColor} />
        <Divider />
        <InfoRow icon="refresh-cw" label="Restart Count" value={`${mc.restartCount}`} valueColor={mc.restartCount > 10 ? C.warn : C.txt} />
        <Divider />
        <InfoRow icon="clock" label="Uptime" value={mc.uptime} />
      </View>
    </View>
  );
}

// ── Maintenance ───────────────────────────────────────────────────────────────

function MaintenanceSection({ mc }: { mc: Microcontroller }) {
  const actions = [
    { icon: "refresh-cw", label: "Restart ESP32", sub: "Soft reboot the controller", color: C.warn, onPress: () => Alert.alert("Restart", `Restart "${mc.name}"?`, [{ text: "Cancel" }, { text: "Restart", style: "destructive" }]) },
    { icon: "download", label: "Backup Configuration", sub: "Save current config to file", color: C.teal, onPress: () => Alert.alert("Backup", "Configuration backup created.") },
    { icon: "upload", label: "Restore Configuration", sub: "Load config from backup file", color: C.accentL, onPress: () => Alert.alert("Restore", "Select a backup file to restore.") },
    { icon: "share", label: "Export Configuration", sub: "Export as JSON", color: C.gold, onPress: () => Alert.alert("Export", "Configuration exported to clipboard.") },
    { icon: "alert-triangle", label: "Factory Reset", sub: "Erase all settings", color: C.off, onPress: () => Alert.alert("Factory Reset", `This will erase all settings on "${mc.name}". This cannot be undone.`, [{ text: "Cancel" }, { text: "Factory Reset", style: "destructive" }]) },
  ];

  return (
    <View style={s.gap}>
      {actions.map((a, i) => (
        <TouchableOpacity key={i} style={[s.card, { borderColor: a.color + "20" }]} onPress={a.onPress} activeOpacity={0.8}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[s.iconBox, { backgroundColor: a.color + "18", borderColor: a.color + "30" }]}>
              <Feather name={a.icon as any} size={18} color={a.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardName, { color: a.color === C.off ? C.off : C.txt }]}>{a.label}</Text>
              <Text style={s.cardSub}>{a.sub}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.mute2} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsSection({ mc, onUpdate }: { mc: Microcontroller; onUpdate: (patch: Partial<Microcontroller>) => void }) {
  const [name, setName] = useState(mc.name);
  const [description, setDescription] = useState(mc.description);
  const [defaultActiveHigh, setDefaultActiveHigh] = useState(true);
  const [defaultStartup, setDefaultStartup] = useState<"on" | "off" | "restore">("off");
  const [restorePrevious, setRestorePrevious] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!name.trim()) { Alert.alert("Validation", "Module name cannot be empty."); return; }
    onUpdate({ name: name.trim(), description: description.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <View style={s.gap}>
      <SLabel>General</SLabel>
      <View style={s.card}>
        <Text style={s.fieldLabel}>Module Name</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholderTextColor={C.mute} />
        <View style={{ height: 14 }} />
        <Text style={s.fieldLabel}>Description</Text>
        <TextInput style={[s.input, { minHeight: 60, textAlignVertical: "top" }]} value={description} onChangeText={setDescription} placeholderTextColor={C.mute} multiline />
      </View>

      <SLabel>Device Defaults</SLabel>
      <View style={s.card}>
        <Text style={s.fieldLabel}>Default GPIO Logic</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          {["Active HIGH", "Active LOW"].map((label, i) => {
            const isActive = defaultActiveHigh === (i === 0);
            return (
              <TouchableOpacity key={label} style={[s.seg, isActive && s.segActive]} onPress={() => setDefaultActiveHigh(i === 0)}>
                <Text style={[s.segText, isActive && s.segTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 14 }} />
        <Text style={s.fieldLabel}>Default Startup State</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          {(["on", "off", "restore"] as const).map(val => {
            const label = val === "on" ? "Always ON" : val === "off" ? "Always OFF" : "Restore";
            return (
              <TouchableOpacity key={val} style={[s.seg, defaultStartup === val && s.segActive]} onPress={() => setDefaultStartup(val)}>
                <Text style={[s.segText, defaultStartup === val && s.segTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Divider />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 }}>
          <View>
            <Text style={s.cardName}>Restore Previous State</Text>
            <Text style={s.cardSub}>On reboot, restore last known state</Text>
          </View>
          <Switch value={restorePrevious} onValueChange={setRestorePrevious} trackColor={{ false: C.mute2, true: C.on + "80" }} thumbColor={restorePrevious ? C.on : C.sec} />
        </View>
      </View>

      <TouchableOpacity style={[s.primaryBtn, saved && { backgroundColor: C.on }]} onPress={handleSave} activeOpacity={0.8}>
        <Feather name={saved ? "check" : "save"} size={16} color="#fff" />
        <Text style={s.primaryBtnText}>{saved ? "Saved!" : "Apply Changes"}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.sLabel}>{children as string}</Text>;
}
function Divider() {
  return <View style={s.divider} />;
}
function InfoRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.infoRow}>
      <Feather name={icon as any} size={13} color={C.mute} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}
function PerfRow({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={s.infoRow}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, { color }]}>{value}{unit}</Text>
      </View>
      <ProgressBar value={value} max={max} color={color} height={4} />
    </View>
  );
}
function DiagRow({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={s.infoRow}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, { color }]}>{value}{unit}</Text>
      </View>
      <ProgressBar value={value} max={max} color={color} height={4} />
    </View>
  );
}
function ActionBtn({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.actionBtn, { borderColor: color + "30", backgroundColor: color + "12" }]} onPress={onPress} activeOpacity={0.8}>
      <Feather name={icon as any} size={18} color={color} />
      <Text style={[s.actionBtnLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}
function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.chipPill, { borderColor: color + "30", backgroundColor: color + "12" }]}>
      <Text style={[s.chipPillText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Main styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  tabBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.b0 },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: "row" },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "transparent", backgroundColor: "transparent" },
  tabActive: { backgroundColor: "#f97316" + "15", borderColor: "#f97316" + "40" },
  tabLabel: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular" },
  tabLabelActive: { color: "#f97316", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16 },
});

// Section-scoped styles
const s = StyleSheet.create({
  gap: { gap: 10 },
  row: { flexDirection: "row", gap: 8 },
  card: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.b0, padding: 14, gap: 10 },
  sLabel: { fontSize: 11, fontWeight: "700" as const, color: C.sec, textTransform: "uppercase", letterSpacing: 1.3, marginTop: 8, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1, backgroundColor: C.b0 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { flex: 1, fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold", textAlign: "right", maxWidth: "55%" },
  iconBox: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 14, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular", marginTop: 1 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 13, color: C.mute, fontFamily: "Inter_400Regular" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#f97316", borderRadius: 13, paddingVertical: 13 },
  primaryBtnText: { fontSize: 14, fontWeight: "700" as const, color: "#fff", fontFamily: "Inter_700Bold" },
  actionBtn: { flex: 1, alignItems: "center", gap: 6, borderRadius: 14, borderWidth: 1, paddingVertical: 14 },
  actionBtnLabel: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold", textAlign: "center" },
  gpioBadge: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  gpioBadgeNum: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  gpioBadgeLabel: { fontSize: 8, fontFamily: "Inter_600SemiBold" },
  gpioBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  gpioBtnText: { fontSize: 11, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  versionDot: { width: 10, height: 10, borderRadius: 5 },
  chipPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  chipPillText: { fontSize: 10, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  miniChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  fieldLabel: { fontSize: 11, color: C.sec, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  input: { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: C.txt, fontFamily: "Inter_400Regular" },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center" },
  segActive: { backgroundColor: "#f97316" + "20", borderColor: "#f97316" + "50" },
  segText: { fontSize: 11, color: C.sec, fontFamily: "Inter_400Regular" },
  segTextActive: { color: "#f97316", fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
});
