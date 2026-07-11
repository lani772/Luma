import { BaseEngine } from "../base-engine";
import type { EngineId, InternalMessage } from "../../internal-api/types";
import { logger } from "../../lib/logger";

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
    this.seedRegistry();
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

    this.broadcast("DEVICE_REGISTERED", { device }, "normal");
  }

  private handleDeregister(message: InternalMessage): void {
    const { deviceId } = message.payload as { deviceId: string };
    const existed = this.registry.delete(deviceId);
    if (existed) {
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

    this.send("mqtt_engine", "PUBLISH_DEVICE_STATE", {
      topic: device.mqttTopic ?? `luma/device/${deviceId}/state`,
      payload: { device: device.name, command, state: device.state },
    }, "high");

    logger.info({ deviceId, command }, "[DeviceEngine] command dispatched to MQTT");
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

    this.broadcast("DEVICE_STATE_CHANGED", { deviceId, state: device.state }, "normal");
  }

  private handleUpdateConfig(message: InternalMessage): void {
    const { deviceId, config } = message.payload as { deviceId: string; config: Record<string, unknown> };
    const device = this.registry.get(deviceId);
    if (!device) return;
    device.config = { ...device.config, ...config };
  }

  private handleFirmwareUpdated(message: InternalMessage): void {
    const { deviceId, newVersion } = message.payload as { deviceId: string; newVersion: string };
    const device = this.registry.get(deviceId);
    if (!device) return;
    device.firmware = newVersion;
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
        setTimeout(() => { device.status = "online"; }, 5_000);
        break;
    }
  }

  private seedRegistry(): void {
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
    ];
    seed.forEach((d) => this.registry.set(d.id, d));
  }

  getDevice(id: string): DeviceRecord | undefined { return this.registry.get(id); }
  getAllDevices(): DeviceRecord[] { return [...this.registry.values()]; }
}

export const deviceEngine = new DeviceEngine();
