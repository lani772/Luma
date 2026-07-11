# USB Communication Engine

**ID:** `usb_engine`
**File:** `artifacts/api-server/src/engines/usb/usb-engine.ts`

---

## Responsibility

The USB Engine handles all wired communication with microcontrollers.
It manages serial port lifecycle, sends/receives data over serial, and handles direct firmware flashing.
When flashing completes, it notifies the Firmware Upload Engine automatically.

```
usb_engine
    │
    ├── DETECT_USB_DEVICES  → reports connected USB devices
    ├── OPEN_SERIAL         → opens serial port (e.g. /dev/ttyUSB0)
    ├── SEND_SERIAL_COMMAND → writes to serial, reads response
    ├── FLASH_FIRMWARE      → simulates esptool flash with progress
    └── on complete         → USB_FLASH_COMPLETE → firmware_upload_engine
```

---

## Capabilities

| Capability | Description |
|---|---|
| `usb_device_detection` | Detect connected USB-to-serial adapters |
| `serial_communication` | Open ports, send commands, read responses |
| `arduino_esp32_flashing` | Flash firmware to ESP32/Arduino via esptool |
| `debug_communication` | Stream serial logs from running firmware |
| `firmware_upload_via_usb` | Full firmware upload workflow over USB |

---

## USB Device Record

```typescript
interface USBDevice {
  portPath:     string;   // e.g. "/dev/ttyUSB0"
  vendorId:     string;   // hex, e.g. "10c4" (Silicon Labs CP2102)
  productId:    string;   // hex, e.g. "ea60"
  manufacturer: string;
  serialNumber: string;
  baudRate:     number;   // current baud rate (default 115200)
  connected:    boolean;  // true if serial port is open
}
```

**Known USB-to-serial chips used with ESP32:**

| Chip | VID | PID | Manufacturer |
|---|---|---|---|
| CP2102 | 10c4 | ea60 | Silicon Labs |
| CH340 | 1a86 | 7523 | WCH |
| FTDI FT232R | 0403 | 6001 | FTDI |

---

## Subscribed Actions

### `DETECT_USB_DEVICES`

Scan for connected USB serial adapters.

**Payload:** `{}`

**Response event:** `USB_DEVICES_FOUND` → `{ devices: USBDevice[] }`
**Broadcast (per device):** `USB_DEVICE_CONNECTED` → `{ device: USBDevice }`

---

### `OPEN_SERIAL`

Open a serial port for communication.

**Payload:**
```typescript
{
  portPath:  string;   // e.g. "/dev/ttyUSB0"
  baudRate?: number;   // default 115200
}
```

**Response on success:** `SERIAL_OPENED` → `{ portPath, baudRate }`
**Response on failure:** `SERIAL_OPEN_FAILED` → `{ portPath, reason: "device_not_found" }`

---

### `CLOSE_SERIAL`

Close an open serial port.

**Payload:** `{ portPath: string }`

**Response event:** `SERIAL_CLOSED` → `{ portPath }`

---

### `SEND_SERIAL_COMMAND`

Write a command string to an open serial port.
Returns the simulated response.

**Payload:**
```typescript
{
  portPath: string;
  command:  string;   // e.g. "AT\r\n"
}
```

**Prerequisite:** Port must be open (`OPEN_SERIAL` called first).

**Response event:** `SERIAL_RESPONSE` → `{ portPath, response: string }`

Serial commands and responses are also stored in the per-port log (retrievable via `READ_LOGS`).

---

### `FLASH_FIRMWARE`

Flash a firmware binary to a connected ESP32.
Simulates `esptool` with 5 progress steps at 20% intervals (500 ms each).

**Payload:**
```typescript
{
  portPath:     string;   // must be open
  firmwarePath: string;   // e.g. "fw_2.1.0.bin"
  deviceId:     string;
}
```

**Progress events (broadcast):** `FLASH_PROGRESS`
```typescript
{
  portPath: string;
  deviceId: string;
  progress: number;   // 0, 20, 40, 60, 80, 100
}
```

**Completion event (to source):** `FLASH_COMPLETE`
```typescript
{
  portPath: string;
  deviceId: string;
  success:  boolean;
}
```

**Also sends to `firmware_upload_engine`:** `USB_FLASH_COMPLETE` (HIGH priority)

---

### `READ_LOGS`

Return the serial communication log for a port.

**Payload:** `{ portPath: string }`

**Response event:** `SERIAL_LOGS`
```typescript
{
  portPath: string;
  logs: Array<{
    timestamp: string;
    direction: "rx" | "tx";   // rx = received from device, tx = sent to device
    data:      string;
  }>
}
```

---

### `GET_USB_STATUS`

Get current state of all USB devices and active flash jobs.

**Payload:** `{}`

**Response event:** `USB_STATUS`
```typescript
{
  detectedDevices: USBDevice[];
  openPorts:       string[];
  flashInProgress: Array<{ port: string; pct: number }>;
}
```

---

## Flash Workflow

```
OPEN_SERIAL { portPath: "/dev/ttyUSB0" }
        │
        ▼
FLASH_FIRMWARE { portPath, firmwarePath, deviceId }
        │
FLASH_PROGRESS (0%)  → (20%) → (40%) → (60%) → (80%)
        │
FLASH_PROGRESS (100%)
        │
FLASH_COMPLETE { success: true }
        │
USB_FLASH_COMPLETE → firmware_upload_engine
        │
UPLOAD_COMPLETE → firmware_engine
        │
FIRMWARE_UPDATED → device_engine
```

---

## REST Endpoints

```
GET  /api/engines/usb_engine           — engine info + status
POST /api/engines/usb_engine/command   — send any action
GET  /api/engines/usb/devices          — list detected USB devices
```

**Example — flash firmware over USB:**
```bash
# Step 1: open the serial port
curl -X POST /api/engines/usb_engine/command \
  -d '{ "action": "OPEN_SERIAL", "payload": { "portPath": "/dev/ttyUSB0" } }'

# Step 2: start flashing
curl -X POST /api/engines/usb_engine/command \
  -d '{
    "action": "FLASH_FIRMWARE",
    "payload": {
      "portPath": "/dev/ttyUSB0",
      "firmwarePath": "fw_2.1.0.bin",
      "deviceId": "ESP32_Lamp_01"
    },
    "priority": "high"
  }'
```
