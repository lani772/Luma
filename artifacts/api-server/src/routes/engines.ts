import { Router, type IRouter } from "express";
import { gateway, messageBus } from "../internal-api";
import { deviceEngine } from "../engines/device/device-engine";
import { mqttEngine } from "../engines/mqtt/mqtt-engine";
import { wifiEngine } from "../engines/wifi/wifi-engine";
import { usbEngine } from "../engines/usb/usb-engine";
import { firmwareEngine } from "../engines/firmware/firmware-engine";
import { firmwareUploadEngine } from "../engines/firmware-upload/firmware-upload-engine";
import type { EngineId } from "../internal-api/types";

const router: IRouter = Router();

router.get("/engines", (_req, res) => {
  res.json({ engines: gateway.getAllEngines() });
});

router.get("/engines/:engineId", (req, res) => {
  const engineId = req.params["engineId"] as EngineId;
  const engine = gateway.discoverEngine(engineId);
  if (!engine) {
    res.status(404).json({ error: "engine_not_found", engineId });
    return;
  }
  res.json({ engine });
});

router.post("/engines/:engineId/command", (req, res) => {
  const engineId = req.params["engineId"] as EngineId;
  const { action, payload, priority, source } = req.body as {
    action: string;
    payload?: Record<string, unknown>;
    priority?: "critical" | "high" | "normal" | "low";
    source?: EngineId;
  };

  if (!action) {
    res.status(400).json({ error: "action is required" });
    return;
  }

  const sourceEngineId: EngineId = source ?? "device_engine";
  const msgId = gateway.sendCommand(sourceEngineId, engineId, action, payload ?? {}, priority ?? "normal");
  res.json({ messageId: msgId, engineId, action });
});

router.post("/engines/message/publish", (req, res) => {
  const { source, destination, type, action, payload, priority } = req.body as {
    source: EngineId;
    destination: EngineId | "broadcast";
    type: "COMMAND" | "EVENT" | "QUERY" | "BROADCAST";
    action: string;
    payload?: Record<string, unknown>;
    priority?: "critical" | "high" | "normal" | "low";
  };

  if (!source || !destination || !action) {
    res.status(400).json({ error: "source, destination, and action are required" });
    return;
  }

  const msgId = gateway.publishMessage({
    source,
    destination,
    type: type ?? "COMMAND",
    action,
    payload: payload ?? {},
    priority: priority ?? "normal",
  });
  res.json({ messageId: msgId });
});

router.get("/engines/queue/offline", (_req, res) => {
  res.json({ messages: gateway.syncMessages() });
});

router.get("/engines/queue/dead-letters", (_req, res) => {
  res.json({ messages: messageBus.getDeadLetters() });
});

router.get("/engines/devices/all", (_req, res) => {
  res.json({ devices: deviceEngine.getAllDevices() });
});

router.post("/engines/devices/command", (req, res) => {
  const { deviceId, command, params } = req.body as {
    deviceId: string;
    command: string;
    params?: Record<string, unknown>;
  };
  const msgId = gateway.sendCommand("device_engine", "device_engine", "SEND_COMMAND", {
    deviceId,
    command,
    params,
  });
  res.json({ messageId: msgId });
});

router.get("/engines/mqtt/status", (_req, res) => {
  res.json({
    connected: mqttEngine.isConnected(),
    subscriptions: mqttEngine.getSubscriptions(),
  });
});

router.get("/engines/wifi/networks", (_req, res) => {
  res.json({
    networks: wifiEngine.getNetworks(),
    discoveredDevices: wifiEngine.getDiscoveredDevices(),
    localIP: wifiEngine.getLocalIP(),
    hotspot: wifiEngine.getHotspotConfig(),
  });
});

router.get("/engines/usb/devices", (_req, res) => {
  res.json({ devices: usbEngine.getDevices() });
});

router.get("/engines/firmware/jobs", (_req, res) => {
  res.json({ jobs: firmwareEngine.getAllJobs() });
});

router.get("/engines/firmware-upload/jobs", (_req, res) => {
  res.json({ jobs: firmwareUploadEngine.getAllJobs() });
});

export default router;
