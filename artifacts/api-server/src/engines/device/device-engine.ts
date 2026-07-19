import { BaseEngine } from "../base-engine";
import type { EngineId, InternalMessage } from "../../internal-api/types";
import { logger } from "../../lib/logger";
import { deviceRepository } from "@workspace/db";

export type DeviceType = "lamp" | "fan" | "sensor" | "switch" | "thermostat" | "camera" | "esp32";
export type DeviceStatus = "online" | "offline" | "error";
export type DeviceCommand = "TURN_ON" | "TURN_OFF" | "TOGGLE" | "SET_BRIGHTNESS" | "SET_COLOR" | "SET_TEMP" | "REBOOT";

export interface DeviceRecord {
  id: string;
  name: string;
  type: DeviceType;
  mac: string;
  ip?: string;
  room?: string;
  floor?: string;
  firmware: string;
  status: DeviceStatus;
  mqttTopic?: string;
  lastSeen: string;
  state: Record<string, unknown>;
  config: Record<string, unknown>;
}

export class DeviceEngine extends BaseEngine {
  readonly id: EngineId = "device_engine";
  readonly name = "Device Engine";
  readonly version = "1.0.0";
  readonly capabilities = [
    "device_registration",
    "device_identification",
    "state_management",
    "device_commands",
    "device_configuration",
    "device_registry",
  ];
  readonly subscribedActions = [
    "REGISTER_DEVICE",
    "DEREGISTER_DEVICE",
    "SEND_COMMAND",
    "GET_DEVICE",
    "LIST_DEVICES",
    "UPDATE_STATE",
    "UPDATE_CONFIG",
    "FIRMWARE_UPDATED",
  ];

  private registry: Map<string, DeviceRecord> = new Map();

  protected onStart(): void {
    // Load persisted devices from DB, seed defaults on any failure
    this.loadFromDb().catch((err: unknown) => {
      logger.warn({ err }, "[DeviceEngine] failed to load from DB — falling back to seed data");
      this.seedRegistry().catch((seedErr: unknown) =>
        logger.error({ err: seedErr }, "[DeviceEngine] seed also failed"),
      );
    });
  }

  protected onStop(): void {}

  protected handleMessage(message: InternalMessage): void {
    logger.debug({ action: message.action, source: message.source }, "[DeviceEngine] received");

    switch (message.action) {
      case "REGISTER_DEVICE":
        this.handleRegister(message);
        break;
      case "DEREGISTER_DEVICE":
        this.handleDeregister(message);
        break;
      case "SEND_COMMAND":
        this.handleCommand(message);
        break;
      case "GET_DEVICE":
        this.handleGet(message);
        break;
      case "LIST_DEVICES":
        this.handleList(message);
        break;
      case "UPDATE_STATE":
        this.handleUpdateState(message);
        break;
      case "UPDATE_CONFIG":
        this.handleUpdateConfig(message);
        break;
      case "FIRMWARE_UPDATED":
        this.handleFirmwareUpdated(message);
        break;
      default:
        logger.warn({ action: message.action }, "[DeviceEngine] unknown action");
    }
  }

  private async loadFromDb(): Promise<void> {
    const rows = await deviceRepository.findAll();
    if (rows.length === 0) {
      await this.seedRegistry();
      return;
    }
    for (const row of rows) {
      this.registry.set(row.id, this.rowToRecord(row));
    }
    logger.info({ count: rows.length }, "[DeviceEngine] loaded from DB");
  }

  private rowToRecord(row: Awaited<ReturnType<typeof deviceRepository.findAll>>[0]): DeviceRecord {
    return {
      id: row.id,
      name: row.name,
      type: row.type as DeviceType,
      mac: row.mac,
      ip: row.ip ?? undefined,
      room: row.room ?? undefined,
      floor: row.floor ?? undefined,
      firmware: row.firmware,
      status: row.status as DeviceStatus,
      mqttTopic: row.mqttTopic ?? undefined,
      lastSeen: row.lastSeen instanceof Date ? row.lastSeen.toISOString() : String(row.lastSeen),
      state: (row.state as Record<string, unknown>) ?? {},
      config: (row.config as Record<string, unknown>) ?? {},
    };
  }

  private handleRegister(message: InternalMessage): void {
    const data = message.payload as Omit<DeviceRecord, "lastSeen" | "state" | "config">;
    const device: DeviceRecord = {
      ...data,
      lastSeen: new Date().toISOString(),
      state: {},
      config: {},
    };
    this.registry.set(device.id, device);
    logger.info({ deviceId: device.id, name: device.name }, "[DeviceEngine] registered");

    deviceRepository.upsert({ ...device, lastSeen: new Date() }).catch((e: unknown) =>
      logger.warn({ err: e }, "[DeviceEngine] persist register failed"),
    );

    this.broadcast("DEVICE_REGISTERED", { device }, "normal");
  }

  private handleDeregister(message: InternalMessage): void {
    const { deviceId } = message.payload as { deviceId: string };
    const existed = this.registry.delete(deviceId);
    if (existed) {
      deviceRepository.delete(deviceId).catch((e: unknown) =>
        logger.warn({ err: e, deviceId }, "[DeviceEngine] persist delete failed"),
      );
      this.broadcast("DEVICE_DEREGISTERED", { deviceId }, "normal");
      logger.info({ deviceId }, "[DeviceEngine] deregistered");
    }
  }

  private handleCommand(message: InternalMessage): void {
    const { deviceId, command, params } = message.payload as {
      deviceId: string;
      command: DeviceCommand;
      params?: Record<string, unknown>;
    };

    const device = this.registry.get(deviceId);
    if (!device) {
      logger.warn({ deviceId }, "[DeviceEngine] command target not found");
      return;
    }

    this.applyCommandToState(device, command, params);
    device.lastSeen = new Date().toISOString();

    deviceRepository.updateState(deviceId, device.state).catch((e: unknown) =>
      logger.warn({ err: e, deviceId }, "[DeviceEngine] persist state failed"),
    );

    this.send("mqtt_engine", "PUBLISH_DEVICE_STATE", {
      topic: device.mqttTopic ?? `luma/device/${deviceId}/state`,
      payload: { device: device.name, command, state: device.state },
    }, "high");

    logger.info({ deviceId, command }, "[DeviceEngine] command dispatched");
  }

  private handleGet(message: InternalMessage): void {
    const { deviceId } = message.payload as { deviceId: string };
    const device = this.registry.get(deviceId);

    this.emit(
      message.source as EngineId,
      "DEVICE_DATA",
      device ? { device } : { error: "not_found", deviceId },
      "normal",
    );
  }

  private handleList(message: InternalMessage): void {
    this.emit(
      message.source as EngineId,
      "DEVICE_LIST",
      { devices: [...this.registry.values()] },
      "normal",
    );
  }

  private handleUpdateState(message: InternalMessage): void {
    const { deviceId, state } = message.payload as { deviceId: string; state: Record<string, unknown> };
    const device = this.registry.get(deviceId);
    if (!device) return;

    device.state = { ...device.state, ...state };
    device.lastSeen = new Date().toISOString();

    deviceRepository.updateState(deviceId, device.state).catch((e: unknown) =>
      logger.warn({ err: e, deviceId }, "[DeviceEngine] persist state update failed"),
    );

    this.broadcast("DEVICE_STATE_CHANGED", { deviceId, state: device.state }, "normal");
  }

  private handleUpdateConfig(message: InternalMessage): void {
    const { deviceId, config } = message.payload as { deviceId: string; config: Record<string, unknown> };
    const device = this.registry.get(deviceId);
    if (!device) return;
    device.config = { ...device.config, ...config };

    deviceRepository.updateConfig(deviceId, device.config).catch((e: unknown) =>
      logger.warn({ err: e, deviceId }, "[DeviceEngine] persist config update failed"),
    );
  }

  private handleFirmwareUpdated(message: InternalMessage): void {
    const { deviceId, newVersion } = message.payload as { deviceId: string; newVersion: string };
    const device = this.registry.get(deviceId);
    if (!device) return;
    device.firmware = newVersion;

    deviceRepository.updateFirmwareVersion(deviceId, newVersion).catch((e: unknown) =>
      logger.warn({ err: e, deviceId }, "[DeviceEngine] persist firmware version failed"),
    );

    this.broadcast("DEVICE_FIRMWARE_UPDATED", { deviceId, newVersion }, "normal");
    logger.info({ deviceId, newVersion }, "[DeviceEngine] firmware version recorded");
  }

  private applyCommandToState(device: DeviceRecord, command: DeviceCommand, params?: Record<string, unknown>): void {
    switch (command) {
      case "TURN_ON":
        device.state.on = true;
        break;
      case "TURN_OFF":
        device.state.on = false;
        break;
      case "TOGGLE":
        device.state.on = !device.state.on;
        break;
      case "SET_BRIGHTNESS":
        device.state.brightness = params?.value ?? device.state.brightness;
        break;
      case "SET_COLOR":
        device.state.rgb = params?.rgb ?? device.state.rgb;
        break;
      case "SET_TEMP":
        device.state.colorTemp = params?.value ?? device.state.colorTemp;
        break;
      case "REBOOT":
        device.status = "offline";
        deviceRepository.updateStatus(device.id, "offline").catch(() => {});
        setTimeout(() => {
          device.status = "online";
          deviceRepository.updateStatus(device.id, "online").catch(() => {});
        }, 5_000);
        break;
    }
  }

  private async seedRegistry(): Promise<void> {
    const seed: DeviceRecord[] = [
      {
        id: "ESP32_Lamp_01",
        name: "Living Room Lamp",
        type: "lamp",
        mac: "A4:CF:12:23:34:45",
        room: "Living Room",
        floor: "Ground",
        firmware: "1.8.3",
        status: "online",
        mqttTopic: "luma/device/ESP32_Lamp_01/state",
        lastSeen: new Date().toISOString(),
        state: { on: false, brightness: 80, rgb: "#FFFFFF" },
        config: { autoOff: true, autoOffMinutes: 60 },
      },
      {
        id: "ESP32_Fan_01",
        name: "Bedroom Fan",
        type: "fan",
        mac: "A4:CF:12:23:34:46",
        room: "Bedroom",
        floor: "First",
        firmware: "1.5.1",
        status: "online",
        mqttTopic: "luma/device/ESP32_Fan_01/state",
        lastSeen: new Date().toISOString(),
        state: { on: false, speed: 3 },
        config: { maxSpeed: 5 },
      },
      {
        id: "ESP32_Sensor_01",
        name: "Living Room Sensor",
        type: "sensor",
        mac: "A4:CF:12:23:34:47",
        room: "Living Room",
        floor: "Ground",
        firmware: "1.5.1",
        status: "online",
        mqttTopic: "luma/device/ESP32_Sensor_01/state",
        lastSeen: new Date().toISOString(),
        state: { temperature: 22.5, humidity: 55 },
        config: { reportInterval: 30 },
      },
    ];

    for (const d of seed) {
      this.registry.set(d.id, d);
      await deviceRepository.upsert({ ...d, lastSeen: new Date() }).catch((e: unknown) =>
        logger.warn({ err: e, deviceId: d.id }, "[DeviceEngine] seed persist failed"),
      );
    }
    logger.info({ count: seed.length }, "[DeviceEngine] seeded registry");
  }

  getDevice(id: string): DeviceRecord | undefined { return this.registry.get(id); }
  getAllDevices(): DeviceRecord[] { return [...this.registry.values()]; }
}

export const deviceEngine = new DeviceEngine();
