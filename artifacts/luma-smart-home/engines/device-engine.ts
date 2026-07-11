import { gateway } from "./internal-api/gateway";
import type { InternalMessage } from "./internal-api/types";

export type DeviceCommand =
  | "TURN_ON"
  | "TURN_OFF"
  | "TOGGLE"
  | "SET_BRIGHTNESS"
  | "SET_COLOR"
  | "SET_TEMP"
  | "REBOOT";

export interface DeviceState {
  deviceId: string;
  state: Record<string, unknown>;
}

export class MobileDeviceEngine {
  private token: string = "";
  private onStateChange?: (update: DeviceState) => void;
  private onDeviceRegistered?: (device: unknown) => void;

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "device_engine",
        name: "Device Engine",
        version: "1.0.0",
        capabilities: ["device_commands", "state_management", "device_registry"],
        subscribedActions: [
          "DEVICE_REGISTERED",
          "DEVICE_DEREGISTERED",
          "DEVICE_STATE_CHANGED",
          "DEVICE_DATA",
          "DEVICE_LIST",
          "DEVICE_FIRMWARE_UPDATED",
        ],
      },
      (msg) => this.handleMessage(msg),
    );
  }

  stop(): void {
    gateway.unregisterEngine("device_engine", this.token);
  }

  sendCommand(
    deviceId: string,
    command: DeviceCommand,
    params?: Record<string, unknown>,
  ): void {
    gateway.sendCommand("device_engine", "device_engine", "SEND_COMMAND", {
      deviceId,
      command,
      params,
    }, "high");
  }

  requestDevice(deviceId: string): void {
    gateway.sendCommand("device_engine", "device_engine", "GET_DEVICE", { deviceId });
  }

  listDevices(): void {
    gateway.sendCommand("device_engine", "device_engine", "LIST_DEVICES", {});
  }

  onState(cb: (update: DeviceState) => void): void { this.onStateChange = cb; }
  onRegistered(cb: (device: unknown) => void): void { this.onDeviceRegistered = cb; }

  private handleMessage(message: InternalMessage): void {
    switch (message.action) {
      case "DEVICE_STATE_CHANGED":
        this.onStateChange?.(message.payload as unknown as DeviceState);
        break;
      case "DEVICE_REGISTERED":
        this.onDeviceRegistered?.(message.payload);
        break;
    }
  }
}

export const mobileDeviceEngine = new MobileDeviceEngine();
