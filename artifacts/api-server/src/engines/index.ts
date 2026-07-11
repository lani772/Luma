import { firmwareEngine } from "./firmware/firmware-engine";
import { deviceEngine } from "./device/device-engine";
import { wifiEngine } from "./wifi/wifi-engine";
import { mqttEngine } from "./mqtt/mqtt-engine";
import { usbEngine } from "./usb/usb-engine";
import { firmwareUploadEngine } from "./firmware-upload/firmware-upload-engine";
import { logger } from "../lib/logger";

const engines = [
  firmwareEngine,
  deviceEngine,
  wifiEngine,
  mqttEngine,
  usbEngine,
  firmwareUploadEngine,
];

export function startAllEngines(): void {
  logger.info("[Engines] Starting all engines…");
  for (const engine of engines) {
    try {
      engine.start();
    } catch (err) {
      logger.error({ err, engineId: engine.id }, "[Engines] failed to start engine");
    }
  }
  logger.info({ count: engines.length }, "[Engines] All engines started");
}

export function stopAllEngines(): void {
  logger.info("[Engines] Stopping all engines…");
  for (const engine of [...engines].reverse()) {
    try {
      engine.stop();
    } catch (err) {
      logger.error({ err, engineId: engine.id }, "[Engines] failed to stop engine");
    }
  }
  logger.info("[Engines] All engines stopped");
}

export {
  firmwareEngine,
  deviceEngine,
  wifiEngine,
  mqttEngine,
  usbEngine,
  firmwareUploadEngine,
};
