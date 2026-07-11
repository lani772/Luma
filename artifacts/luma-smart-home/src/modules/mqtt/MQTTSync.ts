/**
 * MQTTSync — reconciles local caches against freshly-arrived device state
 * whenever a connection (re)establishes, so a queued command that already
 * landed while we were offline doesn't get replayed, and stale local state
 * doesn't linger after a device changed while we were disconnected.
 */
import { getDeviceCache, setDeviceCacheEntry, CachedDeviceState } from "./MQTTStorage";
import { mqttEvents, MQTT_EVENT } from "./MQTTEvents";

export interface RemoteDeviceSnapshot {
  deviceId: string;
  version: number; // monotonically increasing per-device revision from firmware
  state: Record<string, unknown>;
}

export type ApplyLocalFn = (deviceId: string, state: Record<string, unknown>) => void;

/**
 * Reconciles one device: only applies the remote snapshot locally (and
 * updates the cache) if its version is newer than what we already have —
 * this is the dedupe guard that stops a replayed queued command or a
 * duplicate retained-message delivery from bouncing lamp state backwards.
 */
export async function syncDevice(snapshot: RemoteDeviceSnapshot, applyLocal: ApplyLocalFn): Promise<"applied" | "skipped_stale"> {
  const cache = await getDeviceCache();
  const existing = cache[snapshot.deviceId];
  if (existing && existing.version >= snapshot.version) {
    return "skipped_stale";
  }
  applyLocal(snapshot.deviceId, snapshot.state);
  const entry: CachedDeviceState = {
    deviceId: snapshot.deviceId,
    version: snapshot.version,
    updatedAt: Date.now(),
    state: snapshot.state,
  };
  await setDeviceCacheEntry(snapshot.deviceId, entry);
  return "applied";
}

/**
 * Full reconciliation pass, called right after a reconnect (fired by
 * MQTTRecovery's `onReconnected`). Runs before the offline queue is drained
 * so any in-flight duplicate is already deduped by the version check above.
 */
export async function syncAll(snapshots: RemoteDeviceSnapshot[], applyLocal: ApplyLocalFn): Promise<{ applied: number; skipped: number }> {
  mqttEvents.emit(MQTT_EVENT.SYNC_STARTED, { count: snapshots.length });
  let applied = 0;
  let skipped = 0;
  for (const snap of snapshots) {
    const result = await syncDevice(snap, applyLocal);
    if (result === "applied") applied += 1;
    else skipped += 1;
  }
  mqttEvents.emit(MQTT_EVENT.SYNC_COMPLETED, { applied, skipped });
  return { applied, skipped };
}
