export interface Schedule {
  id: string;
  type: "daily" | "weekly" | "monthly" | "one-time" | "sunrise" | "sunset";
  time?: string;
  days?: string[];
  action: "on" | "off" | "toggle";
  label: string;
  enabled: boolean;
}

export interface ActiveTimer {
  action: "on" | "off";
  expiresAt: number;
  label: string;
}

export interface Health {
  rssi: number;
  signalQuality: number;
  ip: string;
  uptime: string;
  restartCount: number;
  cpu: number;
  memory: number;
}

export interface Lamp {
  id: string;
  name: string;
  room: string;
  floor: string;
  deviceId: string;
  mac: string;
  mqttStatus: "connected" | "disconnected";
  online: boolean;
  lastSeen: number;
  firmware: string;
  on: boolean;
  brightness: number;
  colorTemp: number;
  rgb: string;
  voltage: number;
  current: number;
  power: number;
  energyToday: number;
  costToday: number;
  energyMonth: number;
  costMonth: number;
  schedules: Schedule[];
  activeTimer: ActiveTimer | null;
  lastCommand: string;
  lastUpdate: number;
  health: Health;
}

export interface Scene {
  id: string;
  name: string;
  emoji: string;
  color: string;
  active: boolean;
  desc: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Operator" | "Viewer";
  status: "active" | "inactive";
  init: string;
  color: string;
  lastLogin: string;
}

export interface LumaNotification {
  id: number;
  cat: string;
  icon: string;
  title: string;
  time: string;
  read: boolean;
  archived: boolean;
}

export interface ActivityLog {
  id: number;
  type: "device" | "scene" | "schedule" | "login" | "firmware" | "automation";
  user: string;
  action: string;
  device: string | null;
  time: number;
}

export interface PendingRequest {
  id: number;
  user: string;
  init: string;
  color: string;
  req: string;
  when: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  priority: number;
}

const N = Date.now();

export const INITIAL_LAMPS: Lamp[] = [
  {
    id: "L001", name: "Living Room Main", room: "Living Room", floor: "Ground Floor",
    deviceId: "DEV-0A1B2C", mac: "A4:CF:12:3D:7E:01", mqttStatus: "connected",
    online: true, lastSeen: N - 30000, firmware: "v2.4.1",
    on: true, brightness: 80, colorTemp: 3000, rgb: "#FFB77A",
    voltage: 230.1, current: 0.039, power: 9,
    energyToday: 0.80, costToday: 0.096, energyMonth: 14.2, costMonth: 1.70,
    schedules: [
      { id: "s1", type: "daily", time: "06:30", action: "on", label: "Morning ON", enabled: true },
      { id: "s2", type: "daily", time: "22:00", action: "off", label: "Night OFF", enabled: true },
    ],
    activeTimer: null, lastCommand: "Turn ON", lastUpdate: N - 30000,
    health: { rssi: -52, signalQuality: 88, ip: "192.168.1.101", uptime: "5d 3h", restartCount: 2, cpu: 12, memory: 34 },
  },
  {
    id: "L002", name: "Bedroom Ceiling", room: "Bedroom", floor: "First Floor",
    deviceId: "DEV-0B2C3D", mac: "A4:CF:12:3D:7E:02", mqttStatus: "connected",
    online: true, lastSeen: N - 120000, firmware: "v2.4.0",
    on: false, brightness: 50, colorTemp: 4000, rgb: "#ADE8F4",
    voltage: 230.0, current: 0, power: 0,
    energyToday: 0.40, costToday: 0.048, energyMonth: 8.1, costMonth: 0.97,
    schedules: [], activeTimer: null, lastCommand: "Turn OFF", lastUpdate: N - 120000,
    health: { rssi: -65, signalQuality: 72, ip: "192.168.1.102", uptime: "2d 14h", restartCount: 0, cpu: 8, memory: 28 },
  },
  {
    id: "L003", name: "Kitchen Downlight", room: "Kitchen", floor: "Ground Floor",
    deviceId: "DEV-0C3D4E", mac: "A4:CF:12:3D:7E:03", mqttStatus: "connected",
    online: true, lastSeen: N - 5000, firmware: "v2.4.1",
    on: true, brightness: 60, colorTemp: 5000, rgb: "#F5F5E8",
    voltage: 229.8, current: 0.026, power: 6,
    energyToday: 0.60, costToday: 0.072, energyMonth: 11.4, costMonth: 1.37,
    schedules: [{ id: "s3", type: "weekly", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], time: "07:00", action: "on", label: "Weekday Morning", enabled: true }],
    activeTimer: null, lastCommand: "Brightness 60%", lastUpdate: N - 5000,
    health: { rssi: -48, signalQuality: 92, ip: "192.168.1.103", uptime: "12d 0h", restartCount: 5, cpu: 15, memory: 41 },
  },
  {
    id: "L004", name: "Front Porch", room: "Entrance", floor: "Ground Floor",
    deviceId: "DEV-0D4E5F", mac: "A4:CF:12:3D:7E:04", mqttStatus: "disconnected",
    online: false, lastSeen: N - 3600000, firmware: "v2.3.8",
    on: false, brightness: 100, colorTemp: 2700, rgb: "#FFD166",
    voltage: 0, current: 0, power: 0,
    energyToday: 0, costToday: 0, energyMonth: 6.2, costMonth: 0.74,
    schedules: [{ id: "s4", type: "sunset", action: "on", label: "Sunset ON", enabled: true }],
    activeTimer: null, lastCommand: "Disconnected", lastUpdate: N - 3600000,
    health: { rssi: -80, signalQuality: 38, ip: "—", uptime: "—", restartCount: 12, cpu: 0, memory: 0 },
  },
  {
    id: "L005", name: "Study Desk Lamp", room: "Study", floor: "First Floor",
    deviceId: "DEV-0E5F6G", mac: "A4:CF:12:3D:7E:05", mqttStatus: "connected",
    online: true, lastSeen: N - 10000, firmware: "v2.4.1",
    on: true, brightness: 90, colorTemp: 6500, rgb: "#E8F4FD",
    voltage: 230.2, current: 0.052, power: 12,
    energyToday: 1.10, costToday: 0.132, energyMonth: 19.8, costMonth: 2.38,
    schedules: [],
    activeTimer: { action: "off", expiresAt: N + 3540000, label: "1h → OFF" },
    lastCommand: "Timer 1h", lastUpdate: N - 10000,
    health: { rssi: -55, signalQuality: 84, ip: "192.168.1.105", uptime: "1d 8h", restartCount: 1, cpu: 18, memory: 52 },
  },
  {
    id: "L006", name: "Garage Floodlight", room: "Garage", floor: "Ground Floor",
    deviceId: "DEV-0F6G7H", mac: "A4:CF:12:3D:7E:06", mqttStatus: "connected",
    online: true, lastSeen: N - 60000, firmware: "v2.4.0",
    on: false, brightness: 100, colorTemp: 4000, rgb: "#FFFFFF",
    voltage: 230.0, current: 0, power: 0,
    energyToday: 0.20, costToday: 0.024, energyMonth: 3.1, costMonth: 0.37,
    schedules: [], activeTimer: null, lastCommand: "Turn OFF", lastUpdate: N - 60000,
    health: { rssi: -71, signalQuality: 63, ip: "192.168.1.106", uptime: "3d 22h", restartCount: 3, cpu: 9, memory: 30 },
  },
];

export const INITIAL_SCENES: Scene[] = [
  { id: "morning", name: "Morning Routine", emoji: "🌅", color: "#D4A017", active: false, desc: "Gradual wake-up lighting" },
  { id: "movie", name: "Movie Night", emoji: "🎬", color: "#7C3AED", active: false, desc: "Deep amber ambient glow" },
  { id: "reading", name: "Reading Mode", emoji: "📖", color: "#06B6D4", active: false, desc: "Crisp 6500K task light" },
  { id: "sleep", name: "Sleep Mode", emoji: "🌙", color: "#4F46E5", active: false, desc: "All lamps off" },
  { id: "away", name: "Away Mode", emoji: "🔒", color: "#F43F5E", active: true, desc: "Security schedule active" },
  { id: "vacation", name: "Vacation Mode", emoji: "✈️", color: "#D4A017", active: false, desc: "Randomised schedules" },
];

export const SCENE_CONFIGS: Record<string, Record<string, Partial<Lamp>>> = {
  morning: { L001: { on: true, brightness: 70, colorTemp: 3000 }, L003: { on: true, brightness: 80, colorTemp: 4000 } },
  movie: { L001: { on: true, brightness: 15, colorTemp: 2700 } },
  reading: { L005: { on: true, brightness: 95, colorTemp: 6500 } },
  sleep: { L001: { on: false }, L002: { on: false }, L003: { on: false }, L005: { on: false } },
  away: { L004: { on: true } },
  vacation: { L001: { on: true, brightness: 50 } },
};

export const INITIAL_USERS: User[] = [
  { id: 1, name: "Alex Harrison", email: "alex@smarthome.io", role: "Admin", status: "active", init: "AH", color: "#2563EB", lastLogin: "2 min ago" },
  { id: 2, name: "Elena Rodriguez", email: "elena@smarthome.io", role: "Manager", status: "active", init: "ER", color: "#22C55E", lastLogin: "1 hr ago" },
  { id: 3, name: "Marcus Chen", email: "marcus@smarthome.io", role: "Operator", status: "active", init: "MC", color: "#7C3AED", lastLogin: "3 hr ago" },
  { id: 4, name: "Sofia Williams", email: "sofia@clean.io", role: "Viewer", status: "active", init: "SW", color: "#D4A017", lastLogin: "Yesterday" },
];

export const INITIAL_NOTIFICATIONS: LumaNotification[] = [
  { id: 1, cat: "offline", icon: "wifi-off", title: "Front Porch went offline", time: "1h ago", read: false, archived: false },
  { id: 2, cat: "schedule", icon: "clock", title: "Morning Routine triggered at 06:30", time: "Today 06:30", read: false, archived: false },
  { id: 3, cat: "timer", icon: "clock", title: "Study Desk timer expired — OFF", time: "2h ago", read: true, archived: false },
  { id: 4, cat: "energy", icon: "zap", title: "Energy alert: Study exceeded 20W", time: "Yesterday", read: true, archived: false },
  { id: 5, cat: "firmware", icon: "refresh-cw", title: "Firmware v2.4.2 available", time: "2d ago", read: false, archived: false },
  { id: 6, cat: "security", icon: "shield", title: "Access request: Oliver Hayes", time: "3h ago", read: false, archived: false },
];

export const ACTIVITY_LOG: ActivityLog[] = [
  { id: 1, type: "device", user: "Alex Harrison", action: "Turned ON Living Room Main", device: "L001", time: N - 120000 },
  { id: 2, type: "scene", user: "System", action: "Morning Routine executed", device: null, time: N - 3600000 },
  { id: 3, type: "device", user: "Elena Rodriguez", action: "Brightness 60% · Kitchen", device: "L003", time: N - 7200000 },
  { id: 4, type: "schedule", user: "System", action: "Night OFF — Living Room", device: "L001", time: N - 86400000 },
  { id: 5, type: "login", user: "Marcus Chen", action: "Login · 192.168.1.8", device: null, time: N - 172800000 },
];

export const LAMP_ACTIVITY: Record<string, ActivityLog[]> = {
  L001: [
    { id: 101, type: "device", user: "Alex Harrison", action: "Turn ON", device: "L001", time: N - 300000 },
    { id: 102, type: "schedule", user: "System", action: "Daily schedule — Morning ON", device: "L001", time: N - 21600000 },
    { id: 103, type: "device", user: "Elena Rodriguez", action: "Brightness → 80%", device: "L001", time: N - 86400000 },
    { id: 104, type: "device", user: "System", action: "Timer expired — OFF", device: "L001", time: N - 172800000 },
    { id: 105, type: "scene", user: "System", action: "Morning Routine applied", device: "L001", time: N - 259200000 },
    { id: 106, type: "firmware", user: "System", action: "Firmware updated v2.4.1", device: "L001", time: N - 345600000 },
  ],
  L002: [
    { id: 201, type: "device", user: "Alex Harrison", action: "Turn OFF", device: "L002", time: N - 120000 },
    { id: 202, type: "device", user: "Marcus Chen", action: "Brightness → 50%", device: "L002", time: N - 900000 },
    { id: 203, type: "scene", user: "System", action: "Sleep Mode applied", device: "L002", time: N - 86400000 },
  ],
  L003: [
    { id: 301, type: "device", user: "Elena Rodriguez", action: "Brightness → 60%", device: "L003", time: N - 5000 },
    { id: 302, type: "schedule", user: "System", action: "Weekday Morning — ON", device: "L003", time: N - 21600000 },
    { id: 303, type: "device", user: "Alex Harrison", action: "Color temp → 5000K", device: "L003", time: N - 86400000 },
    { id: 304, type: "automation", user: "System", action: "Automation rule triggered", device: "L003", time: N - 172800000 },
  ],
  L004: [
    { id: 401, type: "device", user: "System", action: "Disconnected from broker", device: "L004", time: N - 3600000 },
    { id: 402, type: "schedule", user: "System", action: "Sunset schedule — ON", device: "L004", time: N - 86400000 },
  ],
  L005: [
    { id: 501, type: "device", user: "Alex Harrison", action: "Timer 1h → OFF set", device: "L005", time: N - 10000 },
    { id: 502, type: "device", user: "Alex Harrison", action: "Turn ON", device: "L005", time: N - 3610000 },
    { id: 503, type: "device", user: "Marcus Chen", action: "Brightness → 90%", device: "L005", time: N - 86400000 },
  ],
  L006: [
    { id: 601, type: "device", user: "Alex Harrison", action: "Turn OFF", device: "L006", time: N - 60000 },
    { id: 602, type: "device", user: "Alex Harrison", action: "Turn ON", device: "L006", time: N - 3660000 },
    { id: 603, type: "scene", user: "System", action: "Away Mode check", device: "L006", time: N - 86400000 },
  ],
};

export const PENDING_REQUESTS: PendingRequest[] = [
  { id: 1, user: "Oliver Hayes", init: "OH", color: "#F43F5E", req: "Front Porch + Living Room", when: "2h ago" },
  { id: 2, user: "Priya Sharma", init: "PS", color: "#22C55E", req: "Kitchen Downlight", when: "5h ago" },
];

export const ROOMS = [
  { id: "lr", name: "Living Room", emoji: "🛋️", lampIds: ["L001"] },
  { id: "bd", name: "Bedroom", emoji: "🛏️", lampIds: ["L002"] },
  { id: "kt", name: "Kitchen", emoji: "🍳", lampIds: ["L003"] },
  { id: "en", name: "Entrance", emoji: "🚪", lampIds: ["L004"] },
  { id: "st", name: "Study", emoji: "📚", lampIds: ["L005"] },
  { id: "ga", name: "Garage", emoji: "🚗", lampIds: ["L006"] },
];

export const ENERGY_WEEKLY = [
  { day: "Mon", kwh: 8.2 }, { day: "Tue", kwh: 12.5 }, { day: "Wed", kwh: 9.8 },
  { day: "Thu", kwh: 14.1 }, { day: "Fri", kwh: 11.3 }, { day: "Sat", kwh: 16.7 }, { day: "Sun", kwh: 13.4 },
];

export const ENERGY_MONTHLY = [
  { m: "Jan", kwh: 280 }, { m: "Feb", kwh: 260 }, { m: "Mar", kwh: 310 },
  { m: "Apr", kwh: 295 }, { m: "May", kwh: 340 }, { m: "Jun", kwh: 328 },
];

export const ROLES_DATA = [
  { id: "admin", name: "Admin", color: "#2563EB", count: 1, perms: ["Toggle", "Brightness", "Timer", "Schedule", "Scenes", "User Mgmt", "Health", "MQTT", "Energy", "Settings"] },
  { id: "manager", name: "Manager", color: "#22C55E", count: 1, perms: ["Toggle", "Brightness", "Timer", "Schedule", "Scenes", "Health", "MQTT", "Energy"] },
  { id: "operator", name: "Operator", color: "#7C3AED", count: 1, perms: ["Toggle", "Brightness", "Timer", "Schedule"] },
  { id: "viewer", name: "Viewer", color: "#D4A017", count: 2, perms: ["Energy"] },
];

export const ALL_PERMS = ["Toggle", "Brightness", "Timer", "Schedule", "Scenes", "User Mgmt", "Health", "MQTT", "Energy", "Settings"];

export const DEVICE_PERMISSIONS = [
  { lampId: "L001", lamp: "Living Room Main", allowed: ["Admin", "Manager"], actions: ["Toggle", "Timer", "Schedule"], denied: ["Delete"] },
  { lampId: "L002", lamp: "Bedroom Ceiling", allowed: ["Admin"], actions: ["Toggle", "Brightness", "Timer"], denied: ["Schedule", "Delete"] },
  { lampId: "L003", lamp: "Kitchen Downlight", allowed: ["Admin", "Manager", "Operator"], actions: ["Toggle", "Brightness"], denied: ["Delete"] },
  { lampId: "L004", lamp: "Front Porch", allowed: ["Admin"], actions: ["Toggle"], denied: ["Timer", "Schedule", "Delete"] },
];

export const LAMP_AUTOMATIONS: Record<string, AutomationRule[]> = {
  L001: [
    { id: "a1", name: "Sunset → ON", trigger: "Sunset", action: "Turn ON at 70%", enabled: true, priority: 1 },
    { id: "a2", name: "Away → OFF", trigger: "Away Mode Active", action: "Turn OFF", enabled: false, priority: 2 },
  ],
  L003: [{ id: "a3", name: "Weekday Morning", trigger: "Time: 07:00 (Weekdays)", action: "Turn ON at 80%", enabled: true, priority: 1 }],
  L005: [
    { id: "a4", name: "Motion → ON", trigger: "Motion Detected", action: "Turn ON at 100%", enabled: false, priority: 1 },
    { id: "a5", name: "No Motion → OFF", trigger: "No Motion 30 min", action: "Turn OFF", enabled: false, priority: 2 },
  ],
};

export const TRIGGER_OPTIONS = [
  "Motion Detected", "No Motion 30 min", "Sunset", "Sunrise",
  "Time: Custom", "Temperature > 40°C", "Door Opens", "Away Mode Active", "Button Press",
];

export const ACTION_OPTIONS = [
  "Turn ON", "Turn OFF", "Toggle", "Brightness 25%", "Brightness 50%",
  "Brightness 100%", "Flash 3x", "Change Color", "Send Notification",
];

export function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60000) return Math.floor(d / 1000) + "s ago";
  if (d < 3600000) return Math.floor(d / 60000) + "m ago";
  if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
  return Math.floor(d / 86400000) + "d ago";
}

export function fmtCountdown(expiresAt: number): string {
  const d = Math.max(0, expiresAt - Date.now());
  const h = Math.floor(d / 3600000);
  const m = Math.floor((d % 3600000) / 60000);
  const s = Math.floor((d % 60000) / 1000);
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return m + ":" + String(s).padStart(2, "0");
}

export function signalColor(q: number): string {
  return q >= 80 ? "#22C55E" : q >= 55 ? "#FBBF24" : "#EF4444";
}

export function rssiColor(rssi: number): string {
  return rssi >= -60 ? "#22C55E" : rssi >= -70 ? "#FBBF24" : "#EF4444";
}

export function roleColor(role: string): string {
  const m: Record<string, string> = { Admin: "#2563EB", Manager: "#22C55E", Operator: "#7C3AED", Viewer: "#D4A017" };
  return m[role] || "#4B5A6E";
}
