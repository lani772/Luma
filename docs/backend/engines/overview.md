# Engines — Overview

LUMA has 6 server-side engines. Each is independent and communicates only through the gateway.

```
                    InternalAPIGateway
                           │
    ┌──────────────────────┼──────────────────────┐
    │          │           │          │            │           │
firmware    device       wifi       mqtt         usb    firmware-upload
engine      engine      engine     engine       engine    engine
```

---

## Quick Reference

| Engine | ID | File | Responsibility |
|---|---|---|---|
| Firmware | `firmware_engine` | `engines/firmware/firmware-engine.ts` | OTA jobs, version checks, validation |
| Device | `device_engine` | `engines/device/device-engine.ts` | Registry, state, commands → MQTT |
| WiFi & Hotspot | `wifi_engine` | `engines/wifi/wifi-engine.ts` | Scan, connect, hotspot, discovery |
| MQTT | `mqtt_engine` | `engines/mqtt/mqtt-engine.ts` | Broker connection, pub/sub, offline queue |
| USB | `usb_engine` | `engines/usb/usb-engine.ts` | Serial, detection, flash via USB |
| Firmware Upload | `firmware_upload_engine` | `engines/firmware-upload/firmware-upload-engine.ts` | OTA/USB upload, progress, rollback |

---

## Message Flow Examples

### Turning on a lamp

```
REST POST /api/engines/device_engine/command
  { action: "SEND_COMMAND", payload: { deviceId: "ESP32_Lamp_01", command: "TURN_ON" } }
         │
         ▼
   device_engine
   - updates device state.on = true
   - sends COMMAND → mqtt_engine: PUBLISH_DEVICE_STATE
         │
         ▼
   mqtt_engine
   - publishes to broker: luma/device/ESP32_Lamp_01/state  { on: true }
```

### OTA firmware update

```
REST POST /api/engines/firmware_engine/command
  { action: "REQUEST_UPDATE", payload: { deviceId: "ESP32_Lamp_01", targetVersion: "2.0.0" } }
         │
         ▼
  firmware_engine
  - creates update job
  - sends COMMAND → firmware_upload_engine: UPLOAD_FIRMWARE_PACKAGE
         │
         ▼
  firmware_upload_engine
  - runs OTA upload simulation
  - BROADCASTs UPLOAD_PROGRESS every step
  - sends EVENT → firmware_engine: UPLOAD_COMPLETE { success: true }
         │
         ▼
  firmware_engine
  - sends EVENT → device_engine: FIRMWARE_UPDATED { deviceId, newVersion }
         │
         ▼
  device_engine
  - updates device.firmware field
  - BROADCASTs DEVICE_FIRMWARE_UPDATED
```

### USB flash

```
REST POST /api/engines/usb_engine/command
  { action: "FLASH_FIRMWARE", payload: { portPath: "/dev/ttyUSB0", deviceId, firmwarePath } }
         │
         ▼
  usb_engine
  - simulates flash progress at 20% steps
  - sends EVENT → firmware_upload_engine: USB_FLASH_COMPLETE
         │
         ▼
  firmware_upload_engine
  - sends EVENT → firmware_engine: UPLOAD_COMPLETE
```

---

## Engine Status Codes

| Status | Meaning |
|---|---|
| `initializing` | Registered but `onStart()` not yet complete |
| `running` | Active and handling messages |
| `stopped` | `stop()` was called; not receiving messages |
| `error` | An unrecoverable error occurred |

Check all engine statuses at once: `GET /api/engines`

---

## Adding a New Engine

See [adding-engine.md](../adding-engine.md) for a step-by-step guide.
The only files you need to touch are:
1. Your new engine file
2. `src/engines/index.ts` (add to array)
3. `src/internal-api/types.ts` (add ID to `EngineId` union)
4. `lib/api-spec/openapi.yaml` (add your engine ID to the enum)
