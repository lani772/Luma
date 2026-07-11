# Device Engine

**ID:** `device_engine`
**File:** `artifacts/api-server/src/engines/device/device-engine.ts`

---

## Responsibility

The Device Engine is the authoritative registry for all smart home devices.
It owns device state, receives control commands, and forwards state changes to the MQTT Engine for delivery to the physical hardware.

```
REST / other engines
        │  SEND_COMMAND
        ▼
  device_engine
  - updates in-memory state
  - sends PUBLISH_DEVICE_STATE → mqtt_engine
        │
        ▼
  mqtt_engine → broker → ESP32
```

---

## Device Record Shape

```typescript
interface DeviceRecord {
  id:         string;               // unique device identifier
  name:       string;               // human-readable name
  type:       DeviceType;           // "lamp" | "fan" | "sensor" | "switch" | "thermostat" | "camera" | "esp32"
  mac:        string;               // MAC address
  ip?:        string;               // current IP (optional)
  room?:      string;               // room name
  floor?:     string;               // floor name
  firmware:   string;               // current firmware version
  status:     "online" | "offline" | "error";
  mqttTopic?: string;               // override default topic
  lastSeen:   string;               // ISO timestamp
  state:      Record<string, unknown>;  // device-specific state (on, brightness, rgb…)
  config:     Record<string, unknown>;  // device-specific configuration
}
```

Default MQTT topic for a device: `luma/device/{deviceId}/state`

---

## Capabilities

| Capability | Description |
|---|---|
| `device_registration` | Add/remove devices from the registry |
| `device_identification` | Look up devices by ID |
| `state_management` | Track and update device state |
| `device_commands` | Process control commands and relay to MQTT |
| `device_configuration` | Store per-device configuration |
| `device_registry` | Single source of truth for all connected devices |

---

## Subscribed Actions

### `REGISTER_DEVICE`

Add a new device to the registry.

**Payload:**
```typescript
{
  id:     string;
  name:   string;
  type:   DeviceType;
  mac:    string;
  ip?:    string;
  room?:  string;
  floor?: string;
  firmware: string;
  status: "online" | "offline" | "error";
  mqttTopic?: string;
}
```

**Broadcast emitted:** `DEVICE_REGISTERED` → all engines

---

### `DEREGISTER_DEVICE`

Remove a device from the registry.

**Payload:** `{ deviceId: string }`

**Broadcast emitted:** `DEVICE_DEREGISTERED` → all engines

---

### `SEND_COMMAND`

Send a control command to a device.
The engine updates the in-memory state, then relays to `mqtt_engine`.

**Payload:**
```typescript
{
  deviceId: string;
  command:  DeviceCommand;
  params?:  Record<string, unknown>;
}
```

**Supported commands:**

| Command | Effect | Optional params |
|---|---|---|
| `TURN_ON` | `state.on = true` | — |
| `TURN_OFF` | `state.on = false` | — |
| `TOGGLE` | `state.on = !state.on` | — |
| `SET_BRIGHTNESS` | `state.brightness = value` | `{ value: number }` |
| `SET_COLOR` | `state.rgb = rgb` | `{ rgb: string }` |
| `SET_TEMP` | `state.colorTemp = value` | `{ value: number }` |
| `REBOOT` | `status = offline` for 5 s | — |

**Side effect:** sends `PUBLISH_DEVICE_STATE` → `mqtt_engine` (HIGH priority)

---

### `GET_DEVICE`

Fetch a single device record.

**Payload:** `{ deviceId: string }`

**Response event:** `DEVICE_DATA`
```typescript
{ device: DeviceRecord }           // found
{ error: "not_found", deviceId }   // not found
```

---

### `LIST_DEVICES`

Fetch all device records.

**Payload:** `{}`

**Response event:** `DEVICE_LIST`
```typescript
{ devices: DeviceRecord[] }
```

---

### `UPDATE_STATE`

Merge a partial state object into an existing device.
Triggers a `DEVICE_STATE_CHANGED` broadcast.

**Payload:**
```typescript
{
  deviceId: string;
  state:    Record<string, unknown>;   // merged into existing state
}
```

---

### `UPDATE_CONFIG`

Merge a partial config object into an existing device.
Silent — no broadcast.

**Payload:**
```typescript
{
  deviceId: string;
  config:   Record<string, unknown>;
}
```

---

### `FIRMWARE_UPDATED`

Received from `firmware_engine` after a successful OTA.
Updates the device's `firmware` field.

**Payload:** `{ deviceId: string; newVersion: string }`

**Broadcast emitted:** `DEVICE_FIRMWARE_UPDATED`

---

## Broadcasts Emitted

| Broadcast | When | Payload |
|---|---|---|
| `DEVICE_REGISTERED` | New device added | `{ device: DeviceRecord }` |
| `DEVICE_DEREGISTERED` | Device removed | `{ deviceId }` |
| `DEVICE_STATE_CHANGED` | `UPDATE_STATE` processed | `{ deviceId, state }` |
| `DEVICE_FIRMWARE_UPDATED` | Firmware updated | `{ deviceId, newVersion }` |

---

## REST Endpoints

```
GET  /api/engines/device_engine           — engine info
POST /api/engines/device_engine/command   — send any action
GET  /api/engines/devices/all             — full device registry
POST /api/engines/devices/command         — shorthand for SEND_COMMAND
```

**Example — turn on a lamp:**
```bash
curl -X POST /api/engines/devices/command \
  -H "Content-Type: application/json" \
  -d '{ "deviceId": "ESP32_Lamp_01", "command": "TURN_ON" }'
```

**Example — set brightness:**
```bash
curl -X POST /api/engines/devices/command \
  -H "Content-Type: application/json" \
  -d '{ "deviceId": "ESP32_Lamp_01", "command": "SET_BRIGHTNESS", "params": { "value": 60 } }'
```
