# REST API Reference

**Base URL:** `/api`
**Content-Type:** `application/json`
**Port (dev):** `8080`

All responses follow the pattern `{ key: value }`.
Errors return `{ error: string }` with an appropriate HTTP status code.

---

## Health

### `GET /api/healthz`

Server health check.

**Response `200`:**
```json
{ "status": "ok" }
```

---

## Engine Gateway

### `GET /api/engines`

List all registered engines with live stats.

**Response `200`:**
```json
{
  "engines": [
    {
      "id": "firmware_engine",
      "name": "Firmware Engine",
      "version": "1.0.0",
      "capabilities": ["firmware_management", "version_checking"],
      "subscribedActions": ["CHECK_FIRMWARE_VERSION", "REQUEST_UPDATE"],
      "status": "running",
      "registeredAt": "2025-07-11T09:23:19.711Z",
      "lastHeartbeat": "2025-07-11T09:23:19.711Z",
      "messagesSent": 3,
      "messagesReceived": 1
    }
  ]
}
```

---

### `GET /api/engines/:engineId`

Get info for a single engine.

**Path params:**
| Param | Type | Values |
|---|---|---|
| `engineId` | `EngineId` | See [Engine IDs](#engine-ids) |

**Response `200`:** `{ "engine": EngineInfo }`
**Response `404`:** `{ "error": "engine_not_found", "engineId": "..." }`

---

### `POST /api/engines/:engineId/command`

Send any action to a specific engine.
This is the universal control endpoint — use it to trigger any subscribed action on any engine.

**Path params:** `engineId` — target engine

**Request body:**
```typescript
{
  action:    string;                               // required — any subscribed action
  payload?:  Record<string, unknown>;              // default: {}
  priority?: "critical" | "high" | "normal" | "low"; // default: "normal"
  source?:   EngineId;                             // default: "device_engine"
}
```

**Response `200`:**
```json
{
  "messageId": "a797ced5-4e05-4e26-b732-4caa53542738",
  "engineId": "mqtt_engine",
  "action": "CONNECT_BROKER"
}
```

**Response `400`:** `{ "error": "action is required" }`

**Examples:**
```bash
# Connect MQTT broker
curl -X POST /api/engines/mqtt_engine/command \
  -H "Content-Type: application/json" \
  -d '{ "action": "CONNECT_BROKER", "payload": { "host": "192.168.1.10" }, "priority": "high" }'

# Check firmware version
curl -X POST /api/engines/firmware_engine/command \
  -d '{ "action": "CHECK_FIRMWARE_VERSION", "payload": { "deviceId": "ESP32_Lamp_01", "currentVersion": "1.8.2" } }'

# Scan WiFi networks
curl -X POST /api/engines/wifi_engine/command \
  -d '{ "action": "SCAN_NETWORKS", "payload": {} }'

# Open USB serial port
curl -X POST /api/engines/usb_engine/command \
  -d '{ "action": "OPEN_SERIAL", "payload": { "portPath": "/dev/ttyUSB0", "baudRate": 115200 } }'

# Initiate firmware OTA update
curl -X POST /api/engines/firmware_engine/command \
  -d '{
    "action": "REQUEST_UPDATE",
    "payload": { "deviceId": "ESP32_Lamp_01", "targetVersion": "2.1.0" },
    "priority": "high"
  }'
```

---

### `POST /api/engines/message/publish`

Publish a raw internal message with full control over all fields.
Use when you need to set `type`, `correlationId`, or route between non-standard sources.

**Request body:**
```typescript
{
  source:      EngineId;                              // required
  destination: EngineId | "broadcast";               // required
  type?:       "COMMAND" | "EVENT" | "QUERY" | "RESPONSE" | "BROADCAST"; // default "COMMAND"
  action:      string;                               // required
  payload?:    Record<string, unknown>;
  priority?:   "critical" | "high" | "normal" | "low";
}
```

**Response `200`:** `{ "messageId": "..." }`
**Response `400`:** `{ "error": "source, destination, and action are required" }`

---

### `GET /api/engines/queue/offline`

Messages waiting for offline engine delivery.

**Response `200`:**
```json
{
  "messages": [
    {
      "id": "...",
      "source": "device_engine",
      "destination": "mqtt_engine",
      "type": "COMMAND",
      "action": "PUBLISH_DEVICE_STATE",
      "payload": { "topic": "luma/device/lamp1/state", "payload": { "on": true } },
      "timestamp": "2025-07-11T09:30:00.000Z",
      "priority": "high",
      "ttl": 30000
    }
  ]
}
```

---

### `GET /api/engines/queue/dead-letters`

Messages that exhausted all delivery retries or exceeded their TTL.

**Response `200`:** `{ "messages": InternalMessage[] }`

---

## Devices

### `GET /api/engines/devices/all`

Get all devices from the Device Engine registry.

**Response `200`:**
```json
{
  "devices": [
    {
      "id": "ESP32_Lamp_01",
      "name": "Living Room Lamp",
      "type": "lamp",
      "mac": "A4:CF:12:23:34:45",
      "room": "Living Room",
      "floor": "Ground",
      "firmware": "1.8.3",
      "status": "online",
      "mqttTopic": "luma/device/ESP32_Lamp_01/state",
      "lastSeen": "2025-07-11T09:23:19.713Z",
      "state": { "on": false, "brightness": 80, "rgb": "#FFFFFF" },
      "config": { "autoOff": true, "autoOffMinutes": 60 }
    }
  ]
}
```

---

### `POST /api/engines/devices/command`

Send a control command to a device.
Shorthand for `POST /api/engines/device_engine/command` with `action: "SEND_COMMAND"`.

**Request body:**
```typescript
{
  deviceId: string;
  command:  "TURN_ON" | "TURN_OFF" | "TOGGLE" | "SET_BRIGHTNESS" | "SET_COLOR" | "SET_TEMP" | "REBOOT";
  params?:  Record<string, unknown>;
}
```

**Response `200`:** `{ "messageId": "..." }`

**Examples:**
```bash
# Toggle lamp
curl -X POST /api/engines/devices/command \
  -d '{ "deviceId": "ESP32_Lamp_01", "command": "TOGGLE" }'

# Set brightness to 40%
curl -X POST /api/engines/devices/command \
  -d '{ "deviceId": "ESP32_Lamp_01", "command": "SET_BRIGHTNESS", "params": { "value": 40 } }'

# Set color
curl -X POST /api/engines/devices/command \
  -d '{ "deviceId": "ESP32_Lamp_01", "command": "SET_COLOR", "params": { "rgb": "#FF6600" } }'
```

---

## MQTT

### `GET /api/engines/mqtt/status`

Current MQTT broker connection state.

**Response `200`:**
```json
{
  "connected": true,
  "subscriptions": [
    {
      "topic": "luma/device/+/state",
      "qos": 1,
      "subscribedBy": "device_engine"
    }
  ]
}
```

---

## WiFi

### `GET /api/engines/wifi/networks`

Current network scan results, discovered ESP32 devices, local IP, and hotspot config.

**Response `200`:**
```json
{
  "networks": [
    { "ssid": "LUMA_Home_5G", "bssid": "AA:BB:CC:DD:EE:FF", "rssi": -42, "channel": 36, "secured": true }
  ],
  "discoveredDevices": [
    { "ip": "192.168.1.100", "mac": "A4:CF:12:23:34:45", "hostname": "ESP32_Lamp_01", "type": "esp32", "lastSeen": "..." }
  ],
  "localIP": "192.168.1.42",
  "hotspot": null
}
```

---

## USB

### `GET /api/engines/usb/devices`

All detected USB serial devices.

**Response `200`:**
```json
{
  "devices": [
    {
      "portPath": "/dev/ttyUSB0",
      "vendorId": "10c4",
      "productId": "ea60",
      "manufacturer": "Silicon Labs",
      "serialNumber": "0001",
      "baudRate": 115200,
      "connected": false
    }
  ]
}
```

---

## Firmware

### `GET /api/engines/firmware/jobs`

All firmware update jobs tracked by the Firmware Engine.

**Response `200`:**
```json
{
  "jobs": [
    {
      "jobId": "fw-job-1720000000000",
      "deviceId": "ESP32_Lamp_01",
      "targetVersion": "2.1.0",
      "status": "done",
      "progress": 100,
      "startedAt": "2025-07-11T09:25:00.000Z"
    }
  ]
}
```

---

### `GET /api/engines/firmware-upload/jobs`

All upload jobs tracked by the Firmware Upload Engine.
Includes OTA, USB flash, and rollback jobs.

**Response `200`:** Same structure as firmware/jobs with additional `method`, `finishedAt`, `errorMessage`, `previousVersion` fields.

---

## Engine IDs

Valid values for `:engineId`:

| ID | Engine |
|---|---|
| `firmware_engine` | Firmware Engine |
| `device_engine` | Device Engine |
| `wifi_engine` | WiFi & Hotspot Engine |
| `mqtt_engine` | MQTT Engine |
| `usb_engine` | USB Communication Engine |
| `firmware_upload_engine` | Firmware Upload Engine |
| `rn_mqtt_client_engine` | React Native MQTT Client (mobile only) |
| `p2p_engine` | Peer-to-Peer Engine (mobile only) |

---

## Error Responses

| HTTP Status | `error` field | Meaning |
|---|---|---|
| `400` | `action is required` | Missing required field in request body |
| `400` | `source, destination, and action are required` | Missing fields for raw publish |
| `404` | `engine_not_found` | Engine ID does not exist or is not registered |

---

## OpenAPI Spec

The full spec lives at `lib/api-spec/openapi.yaml`.
React Query hooks and Zod schemas are auto-generated from it:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Generated output:
- `lib/api-client-react/` — React Query hooks (used by the mobile app)
- `lib/api-zod/` — Zod validation schemas (used by the API server routes)
