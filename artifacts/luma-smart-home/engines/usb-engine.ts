import { gateway } from "./internal-api/gateway";
import type { InternalMessage } from "./internal-api/types";

export interface MobileUSBDevice {
  portPath: string;
  manufacturer: string;
  serialNumber: string;
  connected: boolean;
}

export interface SerialResponse {
  portPath: string;
  response: string;
}

type USBEventHandler = (data: Record<string, unknown>) => void;

export class MobileUSBEngine {
  private token: string = "";
  private devices: MobileUSBDevice[] = [];
  private openPorts: Set<string> = new Set();
  private eventHandlers: Map<string, USBEventHandler[]> = new Map();

  start(): void {
    this.token = gateway.registerEngine(
      {
        id: "usb_engine",
        name: "USB Communication Engine",
        version: "1.0.0",
        capabilities: [
          "usb_device_detection",
          "serial_communication",
          "firmware_upload_via_usb",
        ],
        subscribedActions: [
          "USB_DEVICES_FOUND",
          "SERIAL_OPENED",
          "SERIAL_CLOSED",
          "SERIAL_RESPONSE",
          "FLASH_PROGRESS",
          "FLASH_COMPLETE",
          "USB_STATUS",
          "SERIAL_LOGS",
        ],
      },
      (msg) => this.handleMessage(msg),
    );
  }

  stop(): void {
    gateway.unregisterEngine("usb_engine", this.token);
  }

  detectUSBDevices(): void {
    gateway.sendCommand("usb_engine", "usb_engine", "DETECT_USB_DEVICES", {});
  }

  openSerial(portPath: string, baudRate = 115200): void {
    gateway.sendCommand("usb_engine", "usb_engine", "OPEN_SERIAL", { portPath, baudRate }, "high");
  }

  sendCommand(portPath: string, command: string): void {
    gateway.sendCommand("usb_engine", "usb_engine", "SEND_SERIAL_COMMAND", { portPath, command });
  }

  flashFirmware(portPath: string, deviceId: string, firmwarePath: string): void {
    gateway.sendCommand(
      "usb_engine",
      "usb_engine",
      "FLASH_FIRMWARE",
      { portPath, deviceId, firmwarePath },
      "high",
    );
  }

  readLogs(portPath: string): void {
    gateway.sendCommand("usb_engine", "usb_engine", "READ_LOGS", { portPath });
  }

  on(event: string, handler: USBEventHandler): () => void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []);
    this.eventHandlers.get(event)!.push(handler);
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx > -1) handlers.splice(idx, 1);
      }
    };
  }

  getDevices(): MobileUSBDevice[] { return this.devices; }
  isPortOpen(portPath: string): boolean { return this.openPorts.has(portPath); }

  private emitEvent(event: string, data: Record<string, unknown>): void {
    this.eventHandlers.get(event)?.forEach((h) => h(data));
  }

  private handleMessage(message: InternalMessage): void {
    const p = message.payload as Record<string, unknown>;
    switch (message.action) {
      case "USB_DEVICES_FOUND":
        this.devices = (p["devices"] as MobileUSBDevice[]) ?? [];
        this.emitEvent("DevicesFound", p);
        break;
      case "SERIAL_OPENED":
        this.openPorts.add(p["portPath"] as string);
        this.emitEvent("SerialOpened", p);
        break;
      case "SERIAL_CLOSED":
        this.openPorts.delete(p["portPath"] as string);
        this.emitEvent("SerialClosed", p);
        break;
      case "SERIAL_RESPONSE":
        this.emitEvent("SerialResponse", p);
        break;
      case "FLASH_PROGRESS":
        this.emitEvent("FlashProgress", p);
        break;
      case "FLASH_COMPLETE":
        this.emitEvent("FlashComplete", p);
        break;
      case "SERIAL_LOGS":
        this.emitEvent("SerialLogs", p);
        break;
    }
  }
}

export const mobileUSBEngine = new MobileUSBEngine();
