import { BaseEngine } from "../base-engine";
import type { EngineId, InternalMessage } from "../../internal-api/types";
import { logger } from "../../lib/logger";

export interface USBDevice {
  portPath: string;
  vendorId: string;
  productId: string;
  manufacturer: string;
  serialNumber: string;
  baudRate: number;
  connected: boolean;
}

export interface SerialLog {
  timestamp: string;
  direction: "rx" | "tx";
  data: string;
}

export class USBEngine extends BaseEngine {
  readonly id: EngineId = "usb_engine";
  readonly name = "USB Communication Engine";
  readonly version = "1.0.0";
  readonly capabilities = [
    "usb_device_detection",
    "serial_communication",
    "arduino_esp32_flashing",
    "debug_communication",
    "firmware_upload_via_usb",
  ];
  readonly subscribedActions = [
    "DETECT_USB_DEVICES",
    "OPEN_SERIAL",
    "CLOSE_SERIAL",
    "SEND_SERIAL_COMMAND",
    "FLASH_FIRMWARE",
    "READ_LOGS",
    "GET_USB_STATUS",
  ];

  private detectedDevices: Map<string, USBDevice> = new Map();
  private openPorts: Set<string> = new Set();
  private serialLogs: Map<string, SerialLog[]> = new Map();
  private flashProgress: Map<string, number> = new Map();

  protected onStart(): void {
    this.simulateUSBDetection();
  }

  protected onStop(): void {
    this.openPorts.clear();
  }

  protected handleMessage(message: InternalMessage): void {
    logger.debug({ action: message.action }, "[USBEngine] received");

    switch (message.action) {
      case "DETECT_USB_DEVICES":
        this.handleDetect(message);
        break;
      case "OPEN_SERIAL":
        this.handleOpenSerial(message);
        break;
      case "CLOSE_SERIAL":
        this.handleCloseSerial(message);
        break;
      case "SEND_SERIAL_COMMAND":
        this.handleSendCommand(message);
        break;
      case "FLASH_FIRMWARE":
        this.handleFlashFirmware(message);
        break;
      case "READ_LOGS":
        this.handleReadLogs(message);
        break;
      case "GET_USB_STATUS":
        this.handleGetStatus(message);
        break;
      default:
        logger.warn({ action: message.action }, "[USBEngine] unknown action");
    }
  }

  private handleDetect(message: InternalMessage): void {
    this.simulateUSBDetection();
    const devices = [...this.detectedDevices.values()];
    this.emit(message.source as EngineId, "USB_DEVICES_FOUND", { devices }, "normal");
    devices.forEach((d) => this.broadcast("USB_DEVICE_CONNECTED", { device: d }, "normal"));
  }

  private handleOpenSerial(message: InternalMessage): void {
    const { portPath, baudRate } = message.payload as { portPath: string; baudRate?: number };
    const device = this.detectedDevices.get(portPath);

    if (!device) {
      this.emit(message.source as EngineId, "SERIAL_OPEN_FAILED", { portPath, reason: "device_not_found" }, "high");
      return;
    }

    device.baudRate = baudRate ?? 115200;
    device.connected = true;
    this.openPorts.add(portPath);
    this.serialLogs.set(portPath, []);

    this.emit(message.source as EngineId, "SERIAL_OPENED", { portPath, baudRate: device.baudRate }, "high");
    logger.info({ portPath }, "[USBEngine] serial port opened");
  }

  private handleCloseSerial(message: InternalMessage): void {
    const { portPath } = message.payload as { portPath: string };
    this.openPorts.delete(portPath);
    const device = this.detectedDevices.get(portPath);
    if (device) device.connected = false;
    this.emit(message.source as EngineId, "SERIAL_CLOSED", { portPath }, "normal");
  }

  private handleSendCommand(message: InternalMessage): void {
    const { portPath, command } = message.payload as { portPath: string; command: string };

    if (!this.openPorts.has(portPath)) {
      logger.warn({ portPath }, "[USBEngine] port not open");
      return;
    }

    const log: SerialLog = { timestamp: new Date().toISOString(), direction: "tx", data: command };
    this.serialLogs.get(portPath)?.push(log);

    const simResponse = `OK:${command.trim()}`;
    const rxLog: SerialLog = { timestamp: new Date().toISOString(), direction: "rx", data: simResponse };
    this.serialLogs.get(portPath)?.push(rxLog);

    this.emit(message.source as EngineId, "SERIAL_RESPONSE", { portPath, response: simResponse }, "normal");
    logger.debug({ portPath, command }, "[USBEngine] command sent");
  }

  private handleFlashFirmware(message: InternalMessage): void {
    const { portPath, firmwarePath, deviceId } = message.payload as {
      portPath: string;
      firmwarePath: string;
      deviceId: string;
    };

    if (!this.openPorts.has(portPath)) {
      this.emit(message.source as EngineId, "FLASH_FAILED", { portPath, reason: "port_not_open" }, "high");
      return;
    }

    this.flashProgress.set(portPath, 0);
    logger.info({ portPath, firmwarePath }, "[USBEngine] flashing started");

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      this.flashProgress.set(portPath, progress);
      this.emit(message.source as EngineId, "FLASH_PROGRESS", { portPath, deviceId, progress }, "normal");

      if (progress >= 100) {
        clearInterval(interval);
        this.flashProgress.delete(portPath);
        this.emit(message.source as EngineId, "FLASH_COMPLETE", { portPath, deviceId, success: true }, "high");
        this.emit("firmware_upload_engine", "USB_FLASH_COMPLETE", { portPath, deviceId, success: true }, "high");
        logger.info({ portPath, deviceId }, "[USBEngine] flash complete");
      }
    }, 500);
  }

  private handleReadLogs(message: InternalMessage): void {
    const { portPath } = message.payload as { portPath: string };
    const logs = this.serialLogs.get(portPath) ?? [];
    this.emit(message.source as EngineId, "SERIAL_LOGS", { portPath, logs }, "normal");
  }

  private handleGetStatus(message: InternalMessage): void {
    this.emit(message.source as EngineId, "USB_STATUS", {
      detectedDevices: [...this.detectedDevices.values()],
      openPorts: [...this.openPorts],
      flashInProgress: [...this.flashProgress.entries()].map(([port, pct]) => ({ port, pct })),
    }, "normal");
  }

  private simulateUSBDetection(): void {
    this.detectedDevices.set("/dev/ttyUSB0", {
      portPath: "/dev/ttyUSB0",
      vendorId: "10c4",
      productId: "ea60",
      manufacturer: "Silicon Labs",
      serialNumber: "0001",
      baudRate: 115200,
      connected: false,
    });
  }

  getDevices(): USBDevice[] { return [...this.detectedDevices.values()]; }
  isPortOpen(portPath: string): boolean { return this.openPorts.has(portPath); }
}

export const usbEngine = new USBEngine();
