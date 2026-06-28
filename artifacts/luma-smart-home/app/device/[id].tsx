import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/constants/colors";
import { useLuma } from "@/context/LumaContext";
import LumaToggle from "@/components/LumaToggle";
import ProgressBar from "@/components/ProgressBar";
import { TRIGGER_OPTIONS, ACTION_OPTIONS, ActivityLog, AutomationRule, Schedule, fmtCountdown, rssiColor, signalColor, timeAgo } from "@/data/luma-data";
import TimerSheet from "@/components/TimerSheet";

const TABS = ["Overview", "Timers", "Schedule", "Users", "Automation", "Scenes", "History", "Description", "Specs", "Settings"] as const;
type TabId = typeof TABS[number];

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { lamps, users, scenes, lampAutomations, lampActivity, updateLamp, addLampSchedule, deleteLampSchedule, toggleLampSchedule, toggleAutomationRule, deleteAutomationRule, addAutomationRule } = useLuma();

  const lamp = lamps.find(l => l.id === id);
  const [activeTab, setActiveTab] = useState<TabId>("Overview");
  const [timerOpen, setTimerOpen] = useState(false);

  if (!lamp) {
    return (
      <View style={[styles.root, { paddingTop: topPad, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: C.sec, fontSize: 16 }}>Device not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: C.accentL }}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activities = lampActivity[lamp.id] || [];
  const automations = lampAutomations[lamp.id] || [];

  function handleTimerSet(ms: number, action: "on" | "off") {
    updateLamp(lamp.id, { activeTimer: { action, expiresAt: Date.now() + ms, label: `${Math.round(ms / 60000)}m→${action.toUpperCase()}` }, lastCommand: `Timer set`, lastUpdate: Date.now() });
    setTimerOpen(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleClearTimer() {
    updateLamp(lamp.id, { activeTimer: null, lastCommand: "Timer cleared", lastUpdate: Date.now() });
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={C.sec} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>{lamp.name}</Text>
          <Text style={styles.topSub}>{lamp.room} · {lamp.floor}</Text>
        </View>
        <View style={[styles.mqttBadge, { backgroundColor: lamp.mqttStatus === "connected" ? C.on + "18" : C.off + "18", borderColor: lamp.mqttStatus === "connected" ? C.on + "40" : C.off + "40" }]}>
          <Text style={[styles.mqttText, { color: lamp.mqttStatus === "connected" ? C.on : C.off }]}>
            {lamp.mqttStatus === "connected" ? "MQTT ●" : "MQTT ○"}
          </Text>
        </View>
      </View>

      {/* Device quick info */}
      <View style={styles.infoStrip}>
        <InfoChip label={lamp.deviceId} icon="cpu" />
        <InfoChip label={lamp.mac} icon="wifi" />
        <InfoChip label={lamp.health.ip || "—"} icon="server" />
        <InfoChip label={`${timeAgo(lamp.lastSeen)}`} icon="clock" />
      </View>

      {/* Action buttons */}
      <View style={styles.actionStrip}>
        <ActionBtn icon="refresh-cw" label="Restart" color={C.warn} onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }} />
        <ActionBtn icon="refresh-ccw" label="Refresh" color={C.teal} onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }} />
        <ActionBtn icon="navigation" label="Locate" color={C.purple} onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }} />
        <ActionBtn icon="power" label={lamp.on ? "Turn Off" : "Turn On"} color={lamp.on ? C.off : C.on} onPress={() => updateLamp(lamp.id, { on: !lamp.on, lastCommand: lamp.on ? "Turn OFF" : "Turn ON", lastUpdate: Date.now() })} />
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setActiveTab(t)}
            style={[styles.tabBtn, activeTab === t && { borderBottomWidth: 2, borderBottomColor: C.accentL }]}
          >
            <Text style={[styles.tabText, activeTab === t && { color: C.accentL }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView style={styles.tabBody} contentContainerStyle={styles.tabBodyContent} showsVerticalScrollIndicator={false}>
        {activeTab === "Overview" && <OverviewTab lamp={lamp} onUpdate={updateLamp} />}
        {activeTab === "Timers" && <TimersTab lamp={lamp} onOpenTimer={() => setTimerOpen(true)} onClearTimer={handleClearTimer} />}
        {activeTab === "Schedule" && <ScheduleTab lamp={lamp} onAdd={(s) => addLampSchedule(lamp.id, s)} onDelete={(sid) => deleteLampSchedule(lamp.id, sid)} onToggle={(sid) => toggleLampSchedule(lamp.id, sid)} />}
        {activeTab === "Users" && <UsersTab users={users} />}
        {activeTab === "Automation" && <AutomationTab automations={automations} lampId={lamp.id} onToggle={toggleAutomationRule} onDelete={deleteAutomationRule} onAdd={addAutomationRule} />}
        {activeTab === "Scenes" && <ScenesTab scenes={scenes} lampId={lamp.id} />}
        {activeTab === "History" && <HistoryTab activities={activities} />}
        {activeTab === "Description" && <DescriptionTab lamp={lamp} />}
        {activeTab === "Specs" && <SpecsTab lamp={lamp} />}
        {activeTab === "Settings" && <SettingsTab lamp={lamp} onUpdate={updateLamp} />}
      </ScrollView>

      <TimerSheet lamp={lamp} visible={timerOpen} onClose={() => setTimerOpen(false)} onSet={handleTimerSet} />
    </View>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────────────

function InfoChip({ label, icon }: { label: string; icon: string }) {
  return (
    <View style={styles.infoChip}>
      <Feather name={icon as any} size={10} color={C.mute} />
      <Text style={styles.infoChipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color + "30", backgroundColor: color + "12" }]} onPress={onPress} activeOpacity={0.75}>
      <Feather name={icon as any} size={16} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function OverviewTab({ lamp, onUpdate }: { lamp: any; onUpdate: any }) {
  const [brightness, setBrightness] = useState(lamp.brightness);
  const countdown = lamp.activeTimer ? fmtCountdown(lamp.activeTimer.expiresAt) : null;

  return (
    <View style={styles.tabSection}>
      <Row label="Status">
        <View style={styles.inlineRow}>
          <View style={[styles.statusDot, { backgroundColor: lamp.on ? C.on : C.off }]} />
          <Text style={{ color: lamp.on ? C.on : C.off, fontWeight: "700" as const, fontSize: 13 }}>{lamp.on ? "ON" : "OFF"}</Text>
          <LumaToggle value={lamp.on} onToggle={(v) => onUpdate(lamp.id, { on: v, lastCommand: v ? "Turn ON" : "Turn OFF", lastUpdate: Date.now() })} />
        </View>
      </Row>
      <Row label="Brightness">
        <View style={styles.brightnessRow}>
          <Text style={styles.rowVal}>{lamp.brightness}%</Text>
          <View style={styles.brightnessButtons}>
            {[10, 25, 50, 75, 100].map(v => (
              <TouchableOpacity key={v} style={[styles.brtBtn, lamp.brightness === v && { backgroundColor: C.accent + "20", borderColor: C.accentL + "40" }]} onPress={() => onUpdate(lamp.id, { brightness: v, lastCommand: `Brightness ${v}%`, lastUpdate: Date.now() })}>
                <Text style={[styles.brtBtnText, lamp.brightness === v && { color: C.accentL }]}>{v}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Row>
      <Row label="Power">
        <Text style={[styles.rowVal, { color: lamp.on ? C.purple : C.mute }]}>{lamp.on ? `${lamp.power}W` : "0W"}</Text>
      </Row>
      <Row label="Color Temp">
        <Text style={[styles.rowVal, { color: C.gold }]}>{lamp.colorTemp}K</Text>
      </Row>
      {countdown && (
        <Row label="Active Timer">
          <View style={styles.inlineRow}>
            <Text style={[styles.rowVal, { color: "#fde68a" }]}>{countdown} → {lamp.activeTimer?.action.toUpperCase()}</Text>
          </View>
        </Row>
      )}
      <Row label="Last Command"><Text style={styles.rowMuted}>{lamp.lastCommand}</Text></Row>
      <Row label="Updated"><Text style={styles.rowMuted}>{timeAgo(lamp.lastUpdate)}</Text></Row>
      <Row label="Last Seen"><Text style={styles.rowMuted}>{timeAgo(lamp.lastSeen)}</Text></Row>
      <Row label="Signal">
        <View style={styles.signalRow}>
          <Text style={[styles.rowVal, { color: rssiColor(lamp.health.rssi) }]}>{lamp.health.rssi} dBm</Text>
          <View style={styles.signalBars}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.signalBar, { height: i * 5, backgroundColor: lamp.health.signalQuality > i * 22 ? rssiColor(lamp.health.rssi) : C.b0 }]} />
            ))}
          </View>
        </View>
      </Row>
    </View>
  );
}

function TimersTab({ lamp, onOpenTimer, onClearTimer }: { lamp: any; onOpenTimer: () => void; onClearTimer: () => void }) {
  const countdown = lamp.activeTimer ? fmtCountdown(lamp.activeTimer.expiresAt) : null;
  return (
    <View style={styles.tabSection}>
      {lamp.activeTimer ? (
        <View style={styles.timerCard}>
          <View style={styles.timerHeader}>
            <Feather name="clock" size={18} color="#fde68a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.timerTitle}>{countdown}</Text>
              <Text style={styles.timerSub}>Then → {lamp.activeTimer.action.toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.clearBtn} onPress={onClearTimer}>
              <Feather name="x" size={14} color={C.off} />
              <Text style={[styles.clearBtnText, { color: C.off }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Feather name="clock" size={36} color={C.mute} />
          <Text style={styles.emptyTitle}>No active timer</Text>
          <Text style={styles.emptySub}>Set a timer to turn this device on or off</Text>
        </View>
      )}
      <TouchableOpacity style={styles.primaryBtn} onPress={onOpenTimer}>
        <Feather name="plus" size={16} color="#fff" />
        <Text style={styles.primaryBtnText}>Set Timer</Text>
      </TouchableOpacity>
    </View>
  );
}

function ScheduleTab({ lamp, onAdd, onDelete, onToggle }: { lamp: any; onAdd: (s: Schedule) => void; onDelete: (id: string) => void; onToggle: (id: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTime, setNewTime] = useState("07:00");
  const [newAction, setNewAction] = useState<"on" | "off">("on");
  const [newType, setNewType] = useState<"daily" | "weekly">("daily");
  const [newLabel, setNewLabel] = useState("");

  function handleAdd() {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    onAdd({ id, type: newType, time: newTime, action: newAction, label: newLabel || `${newType} ${newAction.toUpperCase()}`, enabled: true });
    setShowAdd(false);
  }

  return (
    <View style={styles.tabSection}>
      {lamp.schedules.length === 0 && !showAdd && (
        <View style={styles.emptyState}>
          <Feather name="calendar" size={36} color={C.mute} />
          <Text style={styles.emptyTitle}>No schedules</Text>
          <Text style={styles.emptySub}>Add recurring schedules to automate this device</Text>
        </View>
      )}
      {lamp.schedules.map((s: Schedule) => (
        <View key={s.id} style={styles.scheduleRow}>
          <View style={styles.scheduleLeft}>
            <Feather name="clock" size={14} color={s.enabled ? C.accentL : C.mute} />
            <View>
              <Text style={[styles.scheduleLabel, s.enabled && { color: C.txt }]}>{s.label}</Text>
              <Text style={styles.scheduleMeta}>{s.type} · {s.time} · {s.action.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.scheduleRight}>
            <LumaToggle size="sm" value={s.enabled} onToggle={() => onToggle(s.id)} />
            <TouchableOpacity onPress={() => onDelete(s.id)}>
              <Feather name="trash-2" size={14} color={C.mute} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {showAdd && (
        <View style={styles.addForm}>
          <TextInput style={styles.formInput} placeholder="Label (optional)" placeholderTextColor={C.mute} value={newLabel} onChangeText={setNewLabel} />
          <TextInput style={styles.formInput} placeholder="Time (HH:MM)" placeholderTextColor={C.mute} value={newTime} onChangeText={setNewTime} />
          <View style={styles.formRow}>
            {(["daily", "weekly"] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.formChip, newType === t && { borderColor: C.accentL, backgroundColor: C.accentL + "18" }]} onPress={() => setNewType(t)}>
                <Text style={[styles.formChipText, newType === t && { color: C.accentL }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.formRow}>
            {(["on", "off"] as const).map(a => (
              <TouchableOpacity key={a} style={[styles.formChip, newAction === a && { borderColor: a === "on" ? C.on : C.off, backgroundColor: (a === "on" ? C.on : C.off) + "18" }]} onPress={() => setNewAction(a)}>
                <Text style={[styles.formChipText, newAction === a && { color: a === "on" ? C.on : C.off }]}>Turn {a.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.formBtns}>
            <TouchableOpacity style={styles.formSave} onPress={handleAdd}><Text style={styles.formSaveText}>Save</Text></TouchableOpacity>
            <TouchableOpacity style={styles.formCancel} onPress={() => setShowAdd(false)}><Text style={styles.formCancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}
      <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowAdd(true)}>
        <Feather name="plus" size={16} color="#fff" />
        <Text style={styles.primaryBtnText}>Add Schedule</Text>
      </TouchableOpacity>
    </View>
  );
}

function UsersTab({ users }: { users: any[] }) {
  return (
    <View style={styles.tabSection}>
      {users.map(u => (
        <View key={u.id} style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: u.color + "25", borderColor: u.color + "50" }]}>
            <Text style={[styles.avatarText, { color: u.color }]}>{u.init}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{u.name}</Text>
            <Text style={styles.userEmail}>{u.email}</Text>
          </View>
          <View style={[styles.rolePill, { backgroundColor: u.color + "18", borderColor: u.color + "30" }]}>
            <Text style={[styles.roleText, { color: u.color }]}>{u.role}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function AutomationTab({ automations, lampId, onToggle, onDelete, onAdd }: { automations: AutomationRule[]; lampId: string; onToggle: any; onDelete: any; onAdd: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const [trigger, setTrigger] = useState(TRIGGER_OPTIONS[0]);
  const [action, setActionOpt] = useState(ACTION_OPTIONS[0]);
  const [name, setName] = useState("");

  function handleAdd() {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    onAdd(lampId, { id, name: name || `${trigger} → ${action}`, trigger, action, enabled: true, priority: automations.length + 1 });
    setShowAdd(false);
  }

  return (
    <View style={styles.tabSection}>
      {automations.length === 0 && !showAdd && (
        <View style={styles.emptyState}>
          <Feather name="cpu" size={36} color={C.mute} />
          <Text style={styles.emptyTitle}>No automations</Text>
          <Text style={styles.emptySub}>Create rules to automate this device</Text>
        </View>
      )}
      {automations.map(r => (
        <View key={r.id} style={styles.automationRow}>
          <View style={styles.automationIcon}>
            <Text style={styles.automationPriority}>#{r.priority}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.automationName}>{r.name}</Text>
            <Text style={styles.automationDetail}>{r.trigger} → {r.action}</Text>
          </View>
          <View style={styles.scheduleRight}>
            <LumaToggle size="sm" value={r.enabled} onToggle={() => onToggle(lampId, r.id)} />
            <TouchableOpacity onPress={() => onDelete(lampId, r.id)}>
              <Feather name="trash-2" size={14} color={C.mute} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {showAdd && (
        <View style={styles.addForm}>
          <TextInput style={styles.formInput} placeholder="Rule name (optional)" placeholderTextColor={C.mute} value={name} onChangeText={setName} />
          <Text style={styles.formLabel}>Trigger</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={styles.chipRow}>
              {TRIGGER_OPTIONS.slice(0, 5).map(t => (
                <TouchableOpacity key={t} style={[styles.formChip, trigger === t && { borderColor: C.teal, backgroundColor: C.teal + "18" }]} onPress={() => setTrigger(t)}>
                  <Text style={[styles.formChipText, trigger === t && { color: C.teal }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.formLabel}>Action</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={styles.chipRow}>
              {ACTION_OPTIONS.slice(0, 5).map(a => (
                <TouchableOpacity key={a} style={[styles.formChip, action === a && { borderColor: C.purple, backgroundColor: C.purple + "18" }]} onPress={() => setActionOpt(a)}>
                  <Text style={[styles.formChipText, action === a && { color: "#c4b5fd" }]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={styles.formBtns}>
            <TouchableOpacity style={styles.formSave} onPress={handleAdd}><Text style={styles.formSaveText}>Save</Text></TouchableOpacity>
            <TouchableOpacity style={styles.formCancel} onPress={() => setShowAdd(false)}><Text style={styles.formCancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      )}
      <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowAdd(true)}>
        <Feather name="plus" size={16} color="#fff" />
        <Text style={styles.primaryBtnText}>Add Rule</Text>
      </TouchableOpacity>
    </View>
  );
}

function ScenesTab({ scenes, lampId }: { scenes: any[]; lampId: string }) {
  const sceneCfg: Record<string, Record<string, any>> = {
    morning: { L001: true, L003: true }, movie: { L001: true }, reading: { L005: true },
    sleep: { L001: true, L002: true, L003: true, L005: true }, away: { L004: true }, vacation: { L001: true },
  };
  const relevant = scenes.filter(s => sceneCfg[s.id]?.[lampId]);
  return (
    <View style={styles.tabSection}>
      {relevant.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="sun" size={36} color={C.mute} />
          <Text style={styles.emptyTitle}>Not in any scenes</Text>
          <Text style={styles.emptySub}>This device isn't included in any lighting scenes</Text>
        </View>
      )}
      {relevant.map(s => (
        <View key={s.id} style={[styles.sceneRow, { borderColor: s.color + "30" }]}>
          <Text style={styles.sceneEmoji}>{s.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sceneName, { color: s.color }]}>{s.name}</Text>
            <Text style={styles.sceneDesc}>{s.desc}</Text>
          </View>
          {s.active && (
            <View style={[styles.activePill, { backgroundColor: s.color + "18", borderColor: s.color + "30" }]}>
              <Text style={[styles.activeText, { color: s.color }]}>Active</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function HistoryTab({ activities }: { activities: ActivityLog[] }) {
  const colorMap: Record<string, string> = { device: C.gold, scene: C.purple, schedule: C.accentL, login: C.teal, firmware: C.on, automation: C.rose };
  const iconMap: Record<string, string> = { device: "zap", scene: "sun", schedule: "clock", login: "log-in", firmware: "refresh-cw", automation: "cpu" };
  return (
    <View style={styles.tabSection}>
      {activities.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="list" size={36} color={C.mute} />
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySub}>Device actions will appear here</Text>
        </View>
      )}
      {activities.map(a => {
        const cl = colorMap[a.type] ?? C.sec;
        const ic = iconMap[a.type] ?? "activity";
        return (
          <View key={a.id} style={styles.historyRow}>
            <View style={[styles.historyIcon, { backgroundColor: cl + "18", borderColor: cl + "30" }]}>
              <Feather name={ic as any} size={13} color={cl} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyAction}>{a.action}</Text>
              <Text style={styles.historyUser}>{a.user}</Text>
            </View>
            <Text style={styles.historyTime}>{timeAgo(a.time)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DescriptionTab({ lamp }: { lamp: any }) {
  return (
    <View style={styles.tabSection}>
      <Row label="Device Name"><Text style={styles.rowVal}>{lamp.name}</Text></Row>
      <Row label="Room"><Text style={styles.rowVal}>{lamp.room}</Text></Row>
      <Row label="Floor"><Text style={styles.rowVal}>{lamp.floor}</Text></Row>
      <Row label="Device ID"><Text style={styles.rowMuted}>{lamp.deviceId}</Text></Row>
      <Row label="MAC Address"><Text style={styles.rowMuted}>{lamp.mac}</Text></Row>
      <Row label="Firmware"><Text style={styles.rowMuted}>{lamp.firmware}</Text></Row>
      <Row label="Lamp Type"><Text style={styles.rowMuted}>Tuya Smart LED Bulb</Text></Row>
      <Row label="Connectivity"><Text style={styles.rowMuted}>Wi-Fi 2.4GHz · MQTT</Text></Row>
      <Row label="Protocol"><Text style={styles.rowMuted}>MQTT over TCP</Text></Row>
      <Row label="Topic Base"><Text style={styles.rowMuted}>luma/device/{lamp.id}</Text></Row>
    </View>
  );
}

function SpecsTab({ lamp }: { lamp: any }) {
  return (
    <View style={styles.tabSection}>
      <Text style={styles.specsSection}>Electrical</Text>
      <Row label="Voltage"><Text style={[styles.rowVal, { color: C.gold }]}>{lamp.voltage} V</Text></Row>
      <Row label="Current"><Text style={[styles.rowVal, { color: C.teal }]}>{lamp.current.toFixed(3)} A</Text></Row>
      <Row label="Power"><Text style={[styles.rowVal, { color: C.purple }]}>{lamp.power} W</Text></Row>
      <Row label="RGB"><Text style={[styles.rowVal, { color: C.gold }]}>{lamp.rgb}</Text></Row>
      <Row label="Color Temp"><Text style={[styles.rowVal, { color: C.warn }]}>{lamp.colorTemp} K</Text></Row>
      <Text style={styles.specsSection}>Performance</Text>
      <Row label="Signal (RSSI)"><Text style={[styles.rowVal, { color: rssiColor(lamp.health.rssi) }]}>{lamp.health.rssi} dBm</Text></Row>
      <Row label="Signal Quality"><Text style={[styles.rowVal, { color: signalColor(lamp.health.signalQuality) }]}>{lamp.health.signalQuality}%</Text></Row>
      <Row label="CPU Usage"><Text style={[styles.rowVal, { color: lamp.health.cpu > 60 ? C.warn : C.on }]}>{lamp.health.cpu}%</Text></Row>
      <Row label="Memory"><Text style={[styles.rowVal, { color: lamp.health.memory > 70 ? C.warn : C.on }]}>{lamp.health.memory}%</Text></Row>
      <Row label="Uptime"><Text style={styles.rowMuted}>{lamp.health.uptime || "—"}</Text></Row>
      <Row label="Restarts"><Text style={styles.rowMuted}>{lamp.health.restartCount}</Text></Row>
      <Text style={styles.specsSection}>Energy</Text>
      <Row label="Energy Today"><Text style={[styles.rowVal, { color: C.accentL }]}>{lamp.energyToday.toFixed(2)} kWh</Text></Row>
      <Row label="Cost Today"><Text style={[styles.rowVal, { color: C.accentL }]}>${lamp.costToday.toFixed(3)}</Text></Row>
      <Row label="Energy Month"><Text style={[styles.rowVal, { color: C.accentL }]}>{lamp.energyMonth.toFixed(1)} kWh</Text></Row>
      <Row label="Cost Month"><Text style={[styles.rowVal, { color: C.accentL }]}>${lamp.costMonth.toFixed(2)}</Text></Row>
    </View>
  );
}

function SettingsTab({ lamp, onUpdate }: { lamp: any; onUpdate: any }) {
  return (
    <View style={styles.tabSection}>
      <Row label="Restore Power State"><LumaToggle size="sm" value={true} onToggle={() => {}} /></Row>
      <Row label="Flash on Command"><LumaToggle size="sm" value={false} onToggle={() => {}} /></Row>
      <Row label="Night Mode"><LumaToggle size="sm" value={false} onToggle={() => {}} /></Row>
      <Row label="Energy Tracking"><LumaToggle size="sm" value={true} onToggle={() => {}} /></Row>
      <Row label="Auto-Reconnect"><LumaToggle size="sm" value={true} onToggle={() => {}} /></Row>
      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <TouchableOpacity style={[styles.dangerBtn, { borderColor: C.warn + "40", backgroundColor: C.warn + "12" }]}>
          <Feather name="refresh-cw" size={14} color={C.warn} />
          <Text style={[styles.dangerBtnText, { color: C.warn }]}>Factory Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerBtn, { borderColor: C.off + "40", backgroundColor: C.off + "12", marginTop: 8 }]}>
          <Feather name="trash-2" size={14} color={C.off} />
          <Text style={[styles.dangerBtnText, { color: C.off }]}>Remove Device</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.b0, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.b0, alignItems: "center", justifyContent: "center" },
  topCenter: { flex: 1 },
  topTitle: { fontSize: 16, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  topSub: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  mqttBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  mqttText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  infoStrip: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.elevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.b0 },
  infoChipText: { fontSize: 9, color: C.sec, fontFamily: "Inter_400Regular", maxWidth: 90 },
  actionStrip: { flexDirection: "row", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 3 },
  actionBtnText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  tabScroll: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: C.b0 },
  tabContent: { paddingHorizontal: 12, alignItems: "center" },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 12, fontWeight: "700" as const, color: C.mute, fontFamily: "Inter_700Bold" },
  tabBody: { flex: 1 },
  tabBodyContent: { padding: 16, paddingBottom: 80 },
  tabSection: { gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  rowLabel: { fontSize: 13, color: C.sec, fontFamily: "Inter_400Regular", flex: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowVal: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  rowMuted: { fontSize: 12, color: C.mute, fontFamily: "Inter_400Regular" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 99 },
  brightnessRow: { gap: 6 },
  brightnessButtons: { flexDirection: "row", gap: 4 },
  brtBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: C.b0, backgroundColor: C.elevated },
  brtBtnText: { fontSize: 10, color: C.mute, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  signalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  signalBars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 16 },
  signalBar: { width: 5, borderRadius: 2 },
  timerCard: { backgroundColor: C.warn + "10", borderRadius: 14, borderWidth: 1, borderColor: C.warn + "30", padding: 16, marginBottom: 12 },
  timerHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  timerTitle: { fontSize: 24, fontWeight: "700" as const, color: "#fde68a", fontFamily: "Inter_700Bold" },
  timerSub: { fontSize: 11, color: C.mute, fontFamily: "Inter_400Regular" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.off + "40", backgroundColor: C.off + "12" },
  clearBtnText: { fontSize: 11, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, marginTop: 12 },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700" as const, color: C.sec, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 12, color: C.mute, textAlign: "center", paddingHorizontal: 20, fontFamily: "Inter_400Regular" },
  scheduleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  scheduleLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  scheduleLabel: { fontSize: 13, color: C.mute, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  scheduleMeta: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  scheduleRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  addForm: { backgroundColor: C.elevated, borderRadius: 14, borderWidth: 1, borderColor: C.b0, padding: 14, marginBottom: 12, gap: 8 },
  formInput: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.b0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.txt, fontSize: 13, fontFamily: "Inter_400Regular" },
  formLabel: { fontSize: 10, color: C.mute, fontWeight: "700" as const, letterSpacing: 1, textTransform: "uppercase", fontFamily: "Inter_600SemiBold" },
  formRow: { flexDirection: "row", gap: 8 },
  formChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.b0, backgroundColor: C.bg },
  formChipText: { fontSize: 11, color: C.mute, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  formBtns: { flexDirection: "row", gap: 8, marginTop: 4 },
  formSave: { flex: 1, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  formSaveText: { color: "#fff", fontWeight: "700" as const, fontSize: 13, fontFamily: "Inter_700Bold" },
  formCancel: { flex: 1, backgroundColor: C.b1, borderWidth: 1, borderColor: C.b0, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  formCancelText: { color: C.mute, fontWeight: "700" as const, fontSize: 13, fontFamily: "Inter_700Bold" },
  chipRow: { flexDirection: "row", gap: 6 },
  automationRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.b0 },
  automationIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.teal + "18", borderWidth: 1, borderColor: C.teal + "30", alignItems: "center", justifyContent: "center" },
  automationPriority: { fontSize: 10, color: C.teal, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  automationName: { fontSize: 13, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  automationDetail: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  avatar: { width: 38, height: 38, borderRadius: 99, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 13, fontWeight: "700" as const, color: C.txt, fontFamily: "Inter_700Bold" },
  userEmail: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  rolePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  roleText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  sceneRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.b0, borderLeftWidth: 2, paddingLeft: 10, marginBottom: 2 },
  sceneEmoji: { fontSize: 20 },
  sceneName: { fontSize: 13, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  sceneDesc: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  activePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  activeText: { fontSize: 9, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.b0 },
  historyIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  historyAction: { fontSize: 12, fontWeight: "600" as const, color: C.txt, fontFamily: "Inter_600SemiBold" },
  historyUser: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  historyTime: { fontSize: 10, color: C.mute, fontFamily: "Inter_400Regular" },
  specsSection: { fontSize: 10, color: C.mute, fontWeight: "700" as const, textTransform: "uppercase", letterSpacing: 1.5, paddingTop: 16, paddingBottom: 4, fontFamily: "Inter_600SemiBold" },
  dangerSection: { marginTop: 24, padding: 14, backgroundColor: C.off + "08", borderRadius: 14, borderWidth: 1, borderColor: C.off + "20" },
  dangerTitle: { fontSize: 12, fontWeight: "700" as const, color: C.off, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Inter_700Bold" },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 10, borderWidth: 1 },
  dangerBtnText: { fontSize: 13, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
});
