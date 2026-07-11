/**
 * MQTTPermissions — device registration keys + role-based command gating.
 *
 * Mirrors the app's existing owner/admin/member/guest role hierarchy (see
 * `data/luma-data.ts` users) but scoped to what's safe to do over the wire:
 * guests can flip/dim a lamp, only owners/admins can touch firmware,
 * schedules, or permissions themselves.
 */
import {
  DeviceRegistryEntry,
  getDeviceRegistry,
  setDeviceRegistryEntry,
} from "./MQTTStorage";
import { generateKey, hashKey } from "./MQTTSecurity";
import { mqttEvents, MQTT_EVENT } from "./MQTTEvents";

export type LumaRole = "owner" | "admin" | "member" | "guest";

export type GatedCommand =
  | "toggle"
  | "brightness"
  | "color"
  | "color_temp"
  | "schedule_write"
  | "permission_write"
  | "firmware_update"
  | "reboot"
  | "factory_reset";

const ROLE_ALLOWLIST: Record<LumaRole, GatedCommand[]> = {
  owner: [
    "toggle",
    "brightness",
    "color",
    "color_temp",
    "schedule_write",
    "permission_write",
    "firmware_update",
    "reboot",
    "factory_reset",
  ],
  admin: [
    "toggle",
    "brightness",
    "color",
    "color_temp",
    "schedule_write",
    "firmware_update",
    "reboot",
  ],
  member: ["toggle", "brightness", "color", "color_temp", "schedule_write"],
  guest: ["toggle", "brightness"],
};

export function canPerform(role: LumaRole, command: GatedCommand): boolean {
  return ROLE_ALLOWLIST[role]?.includes(command) ?? false;
}

export interface DeviceRegistrationResult {
  deviceId: string;
  ownerKey: string;
  adminKey: string;
  registrationKey: string;
}

/**
 * Registers a newly discovered device, minting three keys. Only the hashes
 * are persisted locally — the plaintext keys are returned once so the
 * caller can hand the owner key to the device owner (e.g. via a QR code or
 * the pairing flow) and never store it in plaintext.
 */
export async function registerDevice(deviceId: string, mac: string): Promise<DeviceRegistrationResult> {
  const [ownerKey, adminKey, registrationKey] = await Promise.all([
    generateKey("own"),
    generateKey("adm"),
    generateKey("reg"),
  ]);
  const entry: DeviceRegistryEntry = {
    deviceId,
    mac,
    ownerKeyHash: await hashKey(ownerKey),
    adminKeyHash: await hashKey(adminKey),
    registrationKeyHash: await hashKey(registrationKey),
    registeredAt: Date.now(),
  };
  await setDeviceRegistryEntry(entry);
  mqttEvents.emit(MQTT_EVENT.DEVICE_REGISTERED, { deviceId, mac });
  return { deviceId, ownerKey, adminKey, registrationKey };
}

export async function isDeviceRegistered(deviceId: string): Promise<boolean> {
  const registry = await getDeviceRegistry();
  return deviceId in registry;
}

export type KeyType = "owner" | "admin" | "registration";

/** Verifies a presented plaintext key against the stored hash for a device. */
export async function verifyDeviceKey(deviceId: string, key: string, keyType: KeyType): Promise<boolean> {
  const registry = await getDeviceRegistry();
  const entry = registry[deviceId];
  if (!entry) return false;
  const hash = await hashKey(key);
  if (keyType === "owner") return hash === entry.ownerKeyHash;
  if (keyType === "admin") return hash === entry.adminKeyHash;
  return hash === entry.registrationKeyHash;
}

/** Combined check used by MQTTManager before publishing any command. */
export function canControlDevice(role: LumaRole, command: GatedCommand): { allowed: boolean; reason?: string } {
  const allowed = canPerform(role, command);
  return allowed ? { allowed } : { allowed: false, reason: `role '${role}' cannot perform '${command}'` };
}
