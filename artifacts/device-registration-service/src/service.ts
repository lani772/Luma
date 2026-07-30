import { v4 as uuidv4 } from 'uuid';
import mqtt, { MqttClient } from 'mqtt';

export interface Device {
  deviceId: string;
  homeId: string;
  name: string;
  deviceType: string;
  protocol: string;
  macAddress: string;
  ipAddress?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  status: 'online' | 'offline' | 'error';
  healthScore: number;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceMetric {
  metricId: string;
  deviceId: string;
  metricType: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface PairingSession {
  sessionId: string;
  homeId: string;
  protocol: string;
  status: 'active' | 'completed' | 'failed';
  startedAt: Date;
  expiresAt: Date;
  discoveredDevices: Device[];
}

export type Protocol = 'zigbee' | 'z-wave' | 'wifi' | 'ble' | 'thread' | 'mqtt';

export class DeviceRegistrationService {
  private mqttClient: MqttClient | null = null;
  private devices: Map<string, Device> = new Map();
  private pairingSessions: Map<string, PairingSession> = new Map();
  private brokerUrl: string;

  constructor(brokerUrl: string = process.env.MQTT_BROKER || 'mqtt://localhost:1883') {
    this.brokerUrl = brokerUrl;
  }

  /**
   * Connect to MQTT broker
   */
  async connectMQTT(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mqttClient = mqtt.connect(this.brokerUrl, {
        clientId: `luma-device-service-${uuidv4()}`,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });

      this.mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');
        this.mqttClient!.subscribe('devices/+/+/status', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.mqttClient.on('error', (err) => reject(err));
    });
  }

  /**
   * Register a new device
   */
  registerDevice(
    homeId: string,
    name: string,
    deviceType: string,
    protocol: Protocol,
    macAddress: string,
    manufacturer?: string,
    model?: string
  ): Device {
    const device: Device = {
      deviceId: uuidv4(),
      homeId,
      name,
      deviceType,
      protocol,
      macAddress,
      manufacturer,
      model,
      firmwareVersion: '1.0.0',
      status: 'online',
      healthScore: 100,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.devices.set(device.deviceId, device);
    return device;
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): Device | null {
    return this.devices.get(deviceId) || null;
  }

  /**
   * List all devices for a home
   */
  listDevices(homeId: string): Device[] {
    return Array.from(this.devices.values()).filter((d) => d.homeId === homeId);
  }

  /**
   * Update device
   */
  updateDevice(deviceId: string, updates: Partial<Device>): Device | null {
    const device = this.devices.get(deviceId);
    if (!device) return null;

    const updated: Device = {
      ...device,
      ...updates,
      deviceId: device.deviceId, // Preserve ID
      homeId: device.homeId, // Preserve home ID
      createdAt: device.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };

    this.devices.set(deviceId, updated);
    return updated;
  }

  /**
   * Remove device
   */
  removeDevice(deviceId: string): boolean {
    return this.devices.delete(deviceId);
  }

  /**
   * Record device metric
   */
  recordMetric(
    deviceId: string,
    metricType: string,
    value: number,
    unit: string
  ): DeviceMetric {
    const metric: DeviceMetric = {
      metricId: uuidv4(),
      deviceId,
      metricType,
      value,
      unit,
      timestamp: new Date(),
    };

    // Update device health score based on metrics
    const device = this.devices.get(deviceId);
    if (device) {
      device.lastSeen = new Date();
      device.status = 'online';
    }

    return metric;
  }

  /**
   * Start pairing session
   */
  startPairingSession(homeId: string, protocol: Protocol, duration: number = 60): PairingSession {
    const session: PairingSession = {
      sessionId: uuidv4(),
      homeId,
      protocol,
      status: 'active',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + duration * 1000),
      discoveredDevices: [],
    };

    this.pairingSessions.set(session.sessionId, session);

    // Auto-expire session
    setTimeout(() => {
      const s = this.pairingSessions.get(session.sessionId);
      if (s) {
        s.status = 'completed';
      }
    }, duration * 1000);

    return session;
  }

  /**
   * Get pairing session
   */
  getPairingSession(sessionId: string): PairingSession | null {
    return this.pairingSessions.get(sessionId) || null;
  }

  /**
   * Add discovered device to pairing session
   */
  addDiscoveredDevice(sessionId: string, device: Device): boolean {
    const session = this.pairingSessions.get(sessionId);
    if (!session) return false;

    session.discoveredDevices.push(device);
    return true;
  }

  /**
   * Confirm device pairing
   */
  confirmDevicePairing(sessionId: string, deviceId: string): Device | null {
    const session = this.pairingSessions.get(sessionId);
    if (!session) return null;

    const device = session.discoveredDevices.find((d) => d.deviceId === deviceId);
    if (!device) return null;

    this.devices.set(device.deviceId, device);
    return device;
  }

  /**
   * Update device firmware
   */
  updateFirmware(deviceId: string, version: string, url: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    device.firmwareVersion = version;
    device.updatedAt = new Date();

    // Publish firmware update via MQTT
    if (this.mqttClient) {
      this.mqttClient.publish(
        `devices/${device.homeId}/${deviceId}/firmware/update`,
        JSON.stringify({ version, url }),
        { retain: false }
      );
    }

    return true;
  }

  /**
   * Get device health
   */
  getDeviceHealth(deviceId: string): { score: number; status: string } | null {
    const device = this.devices.get(deviceId);
    if (!device) return null;

    // Calculate health score based on status and response time
    let score = device.healthScore;

    if (device.status === 'offline') {
      score = Math.max(0, score - 30);
    } else if (device.status === 'error') {
      score = Math.max(0, score - 50);
    }

    return {
      score: Math.min(100, score),
      status: device.status,
    };
  }

  /**
   * Publish device status via MQTT
   */
  publishDeviceStatus(deviceId: string, status: string): void {
    const device = this.devices.get(deviceId);
    if (!device || !this.mqttClient) return;

    this.mqttClient.publish(
      `devices/${device.homeId}/${deviceId}/status`,
      JSON.stringify({
        status,
        timestamp: new Date().toISOString(),
        healthScore: device.healthScore,
      }),
      { retain: true }
    );
  }

  /**
   * Disconnect from MQTT
   */
  disconnect(): void {
    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }
  }
}
