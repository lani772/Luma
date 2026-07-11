/**
 * MQTTDiscovery — ESP32 discovery. This library ships no network-scanning
 * code at all, so discovery is built on top of the app's existing
 * `mobileWiFiEngine`, which already simulates mDNS/UDP-broadcast/heartbeat
 * discovery on the local network. This module doesn't re-simulate that —
 * it subscribes to the real events that engine already emits and turns
 * each into a device registration + a DEVICE_DISCOVERED event on the MQTT
 * bus, so the rest of `modules/mqtt` never has to know about the WiFi
 * engine directly.
 *
 * A production build talking to real hardware would replace only the
 * WiFi-engine subscription below with a real mDNS/UDP-broadcast scanner
 * (e.g. `react-native-zeroconf` or a native UDP socket) — every consumer of
 * `MQTTDiscovery` (MQTTManager, dashboard, device cards) is unaffected by
 * that swap because they only see `DiscoveredESP32` + emitted events.
 */
import { mobileWiFiEngine, RegisteredDevice } from "../../../engines/wifi-engine";
import { registerDevice, isDeviceRegistered } from "./MQTTPermissions";
import { mqttEvents, MQTT_EVENT } from "./MQTTEvents";
import { getDiscoveredDevices, setDiscoveredDevices } from "./MQTTStorage";

export interface DiscoveredESP32 {
  deviceId: string;
  mac: string;
  ip: string;
  hostname: string;
  firmwareVersion: string;
  discoveryMethod: "mdns" | "udp_broadcast" | "heartbeat";
  status: "online" | "offline" | "unreachable";
  lastSeen: number;
}

function toDiscovered(dev: RegisteredDevice): DiscoveredESP32 {
  return {
    deviceId: dev.id,
    mac: dev.mac,
    ip: dev.ip,
    hostname: dev.hostname,
    firmwareVersion: dev.firmwareVersion,
    discoveryMethod: dev.discoveryMethod,
    status: dev.status,
    lastSeen: dev.lastSeen,
  };
}

let unsubscribeDiscovered: (() => void) | null = null;
let unsubscribeConnected: (() => void) | null = null;
let started = false;

export function startDiscovery(): void {
  if (started) {
    mobileWiFiEngine.startDiscovery();
    return;
  }
  started = true;

  unsubscribeDiscovered = mobileWiFiEngine.on("DeviceDiscovered", async ({ device }) => {
    const discovered = toDiscovered(device);
    const cache = await getDiscoveredDevices();
    cache[discovered.deviceId] = discovered;
    await setDiscoveredDevices(cache);

    mqttEvents.emit(MQTT_EVENT.DEVICE_DISCOVERED, discovered);

    if (!(await isDeviceRegistered(discovered.deviceId))) {
      await registerDevice(discovered.deviceId, discovered.mac);
    }
  });

  unsubscribeConnected = mobileWiFiEngine.on("IPAddressUpdated", async ({ deviceId, newIp }) => {
    const cache = await getDiscoveredDevices();
    if (cache[deviceId]) {
      (cache[deviceId] as DiscoveredESP32).ip = newIp;
      await setDiscoveredDevices(cache);
      mqttEvents.emit(MQTT_EVENT.DEVICE_UPDATED, { deviceId, ip: newIp });
    }
  });

  mobileWiFiEngine.startDiscovery();
}

export function stopDiscovery(): void {
  mobileWiFiEngine.stopDiscovery();
}

export function teardown(): void {
  unsubscribeDiscovered?.();
  unsubscribeConnected?.();
  unsubscribeDiscovered = null;
  unsubscribeConnected = null;
  started = false;
}

export async function getDiscovered(): Promise<DiscoveredESP32[]> {
  const cache = await getDiscoveredDevices();
  return Object.values(cache) as DiscoveredESP32[];
}
