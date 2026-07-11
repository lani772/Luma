/**
 * MQTTStorage — the only module allowed to touch AsyncStorage for the
 * communication engine. Everything else in `modules/mqtt` persists through
 * these typed helpers so the on-disk shape stays in one place.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const NS = "@luma/mqtt/";

const KEYS = {
  sessions: `${NS}sessions`, // per-connection last-known session (clientId, resumeToken, brokerUrl)
  queue: `${NS}queue`, // MQTTQueue offline operations
  deviceCache: `${NS}device-cache`, // last known state per deviceId (for MQTTSync dedupe)
  schedulesCache: `${NS}schedules-cache`,
  permissionsCache: `${NS}permissions-cache`,
  deviceRegistry: `${NS}device-registry`, // MQTTPermissions: ownerKey/adminKey/registrationKey per device
  recentEvents: `${NS}recent-events`,
  replayNonces: `${NS}replay-nonces`, // MQTTSecurity anti-replay cache
  discoveredDevices: `${NS}discovered-devices`,
} as const;

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[MQTTStorage] failed to read ${key}`, err);
    return fallback;
  }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[MQTTStorage] failed to write ${key}`, err);
  }
}

// ── Sessions ────────────────────────────────────────────────────────────────

export interface StoredSession {
  channelId: string;
  clientId: string;
  brokerUrl: string;
  lastConnectedAt: number;
}

export const getSessions = () => getJSON<Record<string, StoredSession>>(KEYS.sessions, {});
export const setSession = async (channelId: string, session: StoredSession) => {
  const all = await getSessions();
  all[channelId] = session;
  await setJSON(KEYS.sessions, all);
};

// ── Offline queue ───────────────────────────────────────────────────────────

export interface QueuedOperation<T = unknown> {
  id: string;
  kind: "command" | "schedule" | "permission" | "device_update" | "firmware_request";
  deviceId: string;
  payload: T;
  createdAt: number;
  attempts: number;
}

export const getQueue = () => getJSON<QueuedOperation[]>(KEYS.queue, []);
export const setQueue = (queue: QueuedOperation[]) => setJSON(KEYS.queue, queue);

// ── Device state cache (for sync dedupe) ────────────────────────────────────

export interface CachedDeviceState {
  deviceId: string;
  version: number;
  updatedAt: number;
  state: Record<string, unknown>;
}

export const getDeviceCache = () => getJSON<Record<string, CachedDeviceState>>(KEYS.deviceCache, {});
export const setDeviceCacheEntry = async (deviceId: string, entry: CachedDeviceState) => {
  const all = await getDeviceCache();
  all[deviceId] = entry;
  await setJSON(KEYS.deviceCache, all);
};

// ── Schedules / permissions caches ──────────────────────────────────────────

export const getSchedulesCache = () => getJSON<Record<string, unknown>>(KEYS.schedulesCache, {});
export const setSchedulesCache = (v: Record<string, unknown>) => setJSON(KEYS.schedulesCache, v);

export const getPermissionsCache = () => getJSON<Record<string, unknown>>(KEYS.permissionsCache, {});
export const setPermissionsCache = (v: Record<string, unknown>) => setJSON(KEYS.permissionsCache, v);

// ── Device registry (keys) ──────────────────────────────────────────────────

export interface DeviceRegistryEntry {
  deviceId: string;
  mac: string;
  ownerKeyHash: string;
  adminKeyHash: string;
  registrationKeyHash: string;
  registeredAt: number;
}

export const getDeviceRegistry = () => getJSON<Record<string, DeviceRegistryEntry>>(KEYS.deviceRegistry, {});
export const setDeviceRegistryEntry = async (entry: DeviceRegistryEntry) => {
  const all = await getDeviceRegistry();
  all[entry.deviceId] = entry;
  await setJSON(KEYS.deviceRegistry, all);
};

// ── Recent events (rolling log, capped) ─────────────────────────────────────

export interface StoredEvent {
  at: number;
  event: string;
  detail: string;
}

export const getRecentEvents = () => getJSON<StoredEvent[]>(KEYS.recentEvents, []);
export const appendRecentEvent = async (event: StoredEvent) => {
  const all = await getRecentEvents();
  all.push(event);
  while (all.length > 200) all.shift();
  await setJSON(KEYS.recentEvents, all);
};

// ── Replay-prevention nonce cache ───────────────────────────────────────────

export const getReplayNonces = () => getJSON<Record<string, number>>(KEYS.replayNonces, {});
export const rememberNonce = async (nonce: string, expiresAt: number) => {
  const all = await getReplayNonces();
  const now = Date.now();
  for (const [k, exp] of Object.entries(all)) if (exp < now) delete all[k];
  all[nonce] = expiresAt;
  await setJSON(KEYS.replayNonces, all);
};
export const hasSeenNonce = async (nonce: string): Promise<boolean> => {
  const all = await getReplayNonces();
  const exp = all[nonce];
  return exp != null && exp > Date.now();
};

// ── Discovered devices cache ────────────────────────────────────────────────

export const getDiscoveredDevices = () => getJSON<Record<string, unknown>>(KEYS.discoveredDevices, {});
export const setDiscoveredDevices = (v: Record<string, unknown>) => setJSON(KEYS.discoveredDevices, v);

export { KEYS as MQTT_STORAGE_KEYS };
