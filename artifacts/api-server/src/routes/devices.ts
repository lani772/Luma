/**
 * Device CRUD REST API
 * These routes provide a direct, database-backed REST interface
 * for managing devices (complement to the engine message-bus API).
 */
import { Router, type IRouter } from "express";
import { deviceRepository } from "@workspace/db";
import { deviceEngine } from "../engines/device/device-engine";
import { gateway } from "../internal-api";

const router: IRouter = Router();

// GET /api/devices — list all devices
router.get("/devices", async (_req, res) => {
  try {
    const devices = await deviceRepository.findAll();
    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// GET /api/devices/:id — get single device
router.get("/devices/:id", async (req, res) => {
  try {
    const device = await deviceRepository.findById(req.params["id"]!);
    if (!device) {
      res.status(404).json({ error: "not_found", deviceId: req.params["id"] });
      return;
    }
    res.json({ device });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// POST /api/devices — register a new device
router.post("/devices", async (req, res) => {
  const body = req.body as {
    id: string;
    name: string;
    type: string;
    mac: string;
    ip?: string;
    room?: string;
    floor?: string;
    firmware: string;
    status?: string;
    mqttTopic?: string;
  };

  if (!body.id || !body.name || !body.type || !body.mac || !body.firmware) {
    res.status(400).json({ error: "missing_fields", required: ["id", "name", "type", "mac", "firmware"] });
    return;
  }

  try {
    const device = await deviceRepository.upsert({
      id: body.id,
      name: body.name,
      type: body.type,
      mac: body.mac,
      ip: body.ip,
      room: body.room,
      floor: body.floor,
      firmware: body.firmware,
      status: body.status ?? "offline",
      mqttTopic: body.mqttTopic,
      lastSeen: new Date(),
      state: {},
      config: {},
    });

    // Also register in the in-memory engine
    gateway.sendCommand("device_engine", "device_engine", "REGISTER_DEVICE", body, "normal");

    res.status(201).json({ device });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// PATCH /api/devices/:id/state — update device state
router.patch("/devices/:id/state", async (req, res) => {
  const { id } = req.params as { id: string };
  const state = req.body as Record<string, unknown>;

  try {
    await deviceRepository.updateState(id, state);
    // Also update the in-memory engine
    gateway.sendCommand("device_engine", "device_engine", "UPDATE_STATE", { deviceId: id, state }, "normal");
    res.json({ ok: true, deviceId: id, state });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// PATCH /api/devices/:id/config — update device config
router.patch("/devices/:id/config", async (req, res) => {
  const { id } = req.params as { id: string };
  const config = req.body as Record<string, unknown>;

  try {
    await deviceRepository.updateConfig(id, config);
    gateway.sendCommand("device_engine", "device_engine", "UPDATE_CONFIG", { deviceId: id, config }, "normal");
    res.json({ ok: true, deviceId: id, config });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// POST /api/devices/:id/command — send a command to a device
router.post("/devices/:id/command", (req, res) => {
  const { id } = req.params as { id: string };
  const { command, params } = req.body as { command: string; params?: Record<string, unknown> };

  if (!command) {
    res.status(400).json({ error: "command is required" });
    return;
  }

  const msgId = gateway.sendCommand("device_engine", "device_engine", "SEND_COMMAND", {
    deviceId: id,
    command,
    params,
  }, "high");

  res.json({ ok: true, messageId: msgId, deviceId: id, command });
});

// DELETE /api/devices/:id — deregister a device
router.delete("/devices/:id", async (req, res) => {
  const { id } = req.params as { id: string };
  try {
    await deviceRepository.delete(id);
    gateway.sendCommand("device_engine", "device_engine", "DEREGISTER_DEVICE", { deviceId: id }, "normal");
    res.json({ ok: true, deviceId: id });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

export default router;
