import AsyncStorage from "@react-native-async-storage/async-storage";

const MQTT_SERVICE_BASE = process.env.EXPO_PUBLIC_MQTT_SERVICE_URL
  ? process.env.EXPO_PUBLIC_MQTT_SERVICE_URL
  : "http://localhost:8091";

const KEY_ACCESS = "@luma/cloud_access_token";

interface ResponseEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  customHeaders?: Record<string, string>
): Promise<T> {
  const url = `${MQTT_SERVICE_BASE}${path}`;
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  // Retrieve shared JWT session token from AsyncStorage
  const token = await AsyncStorage.getItem(KEY_ACCESS);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (customHeaders) {
    Object.entries(customHeaders).forEach(([k, v]) => {
      headers.set(k, v);
    });
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseData = await response.json();

  if (!response.ok) {
    const errorMsg = responseData.error || `HTTP error! status: ${response.status}`;
    throw new Error(errorMsg);
  }

  return responseData as T;
}

export interface EMQXConnectionInfo {
  clientId: string;
  username: string;
  ipAddress: string;
  connected: boolean;
  keepAlive: number;
  connectedAt: string;
}

export interface EMQXStats {
  connectedDevices: number;
  publishedMessages: number;
  receivedMessages: number;
  failedPublishes: number;
  activeSubscriptions: number;
  queueSize: number;
  retryCount: number;
  uptimeSeconds: number;
}

export interface EMQXBrokerHealth {
  connected: boolean;
  checkedAt: string;
  host: string;
  port: number;
  error?: string;
}

export interface DeviceTelemetryItem {
  topic: string;
  payload: string;
  createdAt: string;
}

export interface DeviceTelemetryResponse {
  deviceId: string;
  telemetry: DeviceTelemetryItem[];
}

export const EMQXAPI = {
  /**
   * Publish raw message to a specific topic
   */
  async publish(topic: string, payload: string, qos = 1, retain = false): Promise<{ status: string }> {
    return apiRequest<{ status: string }>("POST", "/api/v1/mqtt/publish", {
      topic,
      payload,
      qos,
      retain,
    });
  },

  /**
   * Subscribe client to a topic wildcard pattern
   */
  async subscribe(topic: string, qos = 1): Promise<{ status: string }> {
    return apiRequest<{ status: string }>("POST", "/api/v1/mqtt/subscribe", {
      topic,
      qos,
    });
  },

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(topic: string): Promise<{ status: string }> {
    return apiRequest<{ status: string }>("POST", "/api/v1/mqtt/unsubscribe", {
      topic,
    });
  },

  /**
   * Dispatches command to a registered device with correlation tracking
   */
  async sendDeviceCommand(deviceId: string, command: string, qos = 1): Promise<unknown> {
    return apiRequest<unknown>("POST", `/api/v1/mqtt/devices/${deviceId}/commands`, {
      command,
      qos,
    });
  },

  /**
   * Retrieves current live online status and last seen heartbeats of a device
   */
  async getDeviceStatus(deviceId: string): Promise<{ deviceId: string; status: "online" | "offline"; lastSeen: string }> {
    return apiRequest<{ deviceId: string; status: "online" | "offline"; lastSeen: string }>(
      "GET",
      `/api/v1/mqtt/devices/${deviceId}/status`
    );
  },

  /**
   * Retrieves historical telemetry metadata stored for a specific device
   */
  async getDeviceTelemetry(deviceId: string, limit = 20): Promise<DeviceTelemetryResponse> {
    return apiRequest<DeviceTelemetryResponse>("GET", `/api/v1/mqtt/devices/${deviceId}/telemetry?limit=${limit}`);
  },

  /**
   * Fetch live connection metrics from EMQX platform api or fallback cache
   */
  async getActiveConnections(deploymentId?: string): Promise<{ connections: EMQXConnectionInfo[] }> {
    const path = deploymentId ? `/api/v1/mqtt/connections?deploymentId=${deploymentId}` : "/api/v1/mqtt/connections";
    return apiRequest<{ connections: EMQXConnectionInfo[] }>("GET", path);
  },

  /**
   * Fetch MQTT stats and message counters
   */
  async getStats(): Promise<EMQXStats> {
    return apiRequest<EMQXStats>("GET", "/api/v1/mqtt/stats");
  },

  /**
   * Fetch actual MQTT Broker connection status
   */
  async getBrokerHealth(): Promise<EMQXBrokerHealth> {
    return apiRequest<EMQXBrokerHealth>("GET", "/api/v1/mqtt/health");
  },
};
