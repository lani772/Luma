export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  avatar?: string;
  createdAt: string;
  lastLogin: string;
}

export interface Lamp {
  id: string;
  name: string;
  room: string;
  floor: string;
  deviceId: string;
  mac: string;
  mqttStatus: 'connected' | 'disconnected';
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
  health: HealthMetrics;
}

export interface MCDevice {
  id: string;
  name: string;
  room: string;
  mcId: string;
  mcName?: string;
  on: boolean;
  online: boolean;
  lastSeen: number;
}

export interface Microcontroller {
  id: string;
  name: string;
  model: string;
  online: boolean;
  ipAddress: string;
  signalStrength: number;
  uptime: number;
  lastSeen: number;
}

export interface Scene {
  id: string;
  name: string;
  emoji: string;
  color: string;
  active: boolean;
  description: string;
  devices: string[]; // lamp IDs
}

export interface Schedule {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'one-time' | 'sunrise' | 'sunset';
  time?: string;
  days?: string[];
  action: 'on' | 'off' | 'toggle';
  label: string;
  enabled: boolean;
}

export interface ActiveTimer {
  action: 'on' | 'off';
  expiresAt: number;
  label: string;
}

export interface HealthMetrics {
  rssi: number;
  signalQuality: number;
  ip: string;
  uptime: string;
  restartCount: number;
  cpu: number;
  memory: number;
}

export interface LumaNotification {
  id: string;
  type: 'device' | 'scene' | 'schedule' | 'login' | 'firmware' | 'automation';
  message: string;
  read: boolean;
  archived: boolean;
  timestamp: number;
  relatedDevice?: string;
  relatedUser?: string;
}

export interface ActivityLog {
  id: string;
  type: 'device' | 'scene' | 'schedule' | 'login' | 'firmware' | 'automation';
  description: string;
  device?: string;
  user?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: 'time' | 'device' | 'manual';
    condition: string;
  };
  action: {
    deviceId: string;
    state: 'on' | 'off' | 'toggle';
    value?: number;
  };
}

export interface RoomInfo {
  id: string;
  name: string;
  emoji: string;
  floor: string;
  devices: string[]; // device IDs
}

export interface EnergyData {
  timestamp: number;
  kwh: number;
  cost: number;
  power: number;
}

export interface EnergyAnalytics {
  lampId: string;
  lampName: string;
  room: string;
  kwh: number;
  cost: number;
  efficiency: number;
  efficiencyGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  color: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresIn: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type DeviceKind = 'all' | 'gpio' | 'mqtt';
export type StatusFilter = 'all' | 'on' | 'off' | 'offline';
export type EnergyPeriod = 'today' | 'week' | 'month';
