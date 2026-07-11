import { mobileFirmwareEngine } from "./firmware-engine";
import { mobileDeviceEngine } from "./device-engine";
import { mobileWiFiEngine } from "./wifi-engine";
import { mobileRNMQTTClientEngine } from "./mqtt-client-engine";
import { mobileP2PEngine } from "./p2p-engine";
import { mobileFirmwareUploadEngine } from "./firmware-upload-engine";
import { mobileUSBEngine } from "./usb-engine";

const engines = [
  mobileFirmwareEngine,
  mobileDeviceEngine,
  mobileWiFiEngine,
  mobileRNMQTTClientEngine,
  mobileP2PEngine,
  mobileFirmwareUploadEngine,
  mobileUSBEngine,
];

let started = false;

export function startAllMobileEngines(): void {
  if (started) return;
  started = true;
  for (const engine of engines) {
    try {
      engine.start();
    } catch (err) {
      console.error(`[MobileEngines] failed to start engine:`, err);
    }
  }
  console.log(`[MobileEngines] ${engines.length} engines started`);
}

export function stopAllMobileEngines(): void {
  for (const engine of [...engines].reverse()) {
    try {
      engine.stop();
    } catch (err) {
      console.error(`[MobileEngines] failed to stop engine:`, err);
    }
  }
  started = false;
}

export { gateway } from "./internal-api";

export {
  mobileFirmwareEngine,
  mobileDeviceEngine,
  mobileWiFiEngine,
  mobileRNMQTTClientEngine,
  mobileP2PEngine,
  mobileFirmwareUploadEngine,
  mobileUSBEngine,
};
