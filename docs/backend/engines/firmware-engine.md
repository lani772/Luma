# Firmware Engine

**ID:** `firmware_engine`
**File:** `artifacts/api-server/src/engines/firmware/firmware-engine.ts`

---

## Responsibility

The Firmware Engine is the coordinator for all firmware lifecycle events.
It does **not** handle actual file transfer — it delegates that to the Firmware Upload Engine.
Its job is version management, job orchestration, and notifying other engines when firmware changes.

```
firmware_engine
    │
    ├── Tracks: firmware registry (known versions per device type)
    ├── Tracks: active update jobs (pending/uploading/done/failed)
    │
    ├── Delegates OTA upload → firmware_upload_engine
    └── Notifies on completion → device_engine  (FIRMWARE_UPDATED event)
```

---

## Capabilities

| Capability | Description |
|---|---|
| `firmware_management` | Maintains the firmware version registry |
| `version_checking` | Compares current vs latest version for a device |
| `update_requests` | Initiates and tracks OTA update jobs |
| `firmware_validation` | Checksum-based firmware authenticity check |
| `status_reporting` | Returns job status on demand |
| `ota_coordination` | Orchestrates multi-engine OTA flow |

---

## Subscribed Actions

### `CHECK_FIRMWARE_VERSION`

Check whether a device has the latest firmware.

**Payload:**
```typescript
{
  deviceId:       string;  // e.g. "ESP32_Lamp_01"
  currentVersion: string;  // e.g. "1.8.2"
}
```

**Response event sent back to source:** `FIRMWARE_VERSION_RESULT`
```typescript
{
  deviceId:        string;
  currentVersion:  string;
  latestVersion:   string;
  updateAvailable: boolean;
  checksum:        string;
  stable:          boolean;
}
```

---

### `REQUEST_UPDATE`

Initiate an OTA firmware update for a device.
Creates an update job and immediately delegates to the Firmware Upload Engine.

**Payload:**
```typescript
{
  deviceId:      string;
  targetVersion: string;
}
```

**Side effects:**
- Creates a `FirmwareUpdateJob` tracked by the engine
- Sends `UPLOAD_FIRMWARE_PACKAGE` → `firmware_upload_engine` (HIGH priority)

---

### `VALIDATE_FIRMWARE`

Validate that a firmware package's checksum matches the registry.

**Payload:**
```typescript
{
  deviceId:  string;
  checksum:  string;
}
```

**Response event:** `FIRMWARE_VALIDATION_RESULT`
```typescript
{
  deviceId: string;
  valid:    boolean;
  checksum: string;
}
```

---

### `GET_FIRMWARE_STATUS`

Get the current status of an update job.

**Payload:**
```typescript
{
  jobId: string;
}
```

**Response event:** `FIRMWARE_STATUS`
```typescript
{
  jobId:          string;
  deviceId:       string;
  targetVersion:  string;
  status:         "pending" | "uploading" | "validating" | "applying" | "done" | "failed";
  progress:       number;   // 0–100
  startedAt:      string;
}
```

---

### `UPLOAD_COMPLETE`

Received from `firmware_upload_engine` when an OTA or USB flash finishes.

**Payload:**
```typescript
{
  jobId:   string;
  success: boolean;
}
```

**Side effects:**
- Marks job as `done` or `failed`
- On success: sends `FIRMWARE_UPDATED` → `device_engine` (HIGH priority)

---

### `ROLLBACK_FIRMWARE`

Roll a device back to a previous version.

**Payload:**
```typescript
{
  deviceId: string;
  version:  string;  // version to roll back to
}
```

**Side effects:**
- Sends `ROLLBACK_TO_VERSION` → `firmware_upload_engine` (CRITICAL priority)

---

## Events Emitted

| Event | Destination | When |
|---|---|---|
| `FIRMWARE_UPDATED` | `device_engine` | Upload succeeded |
| `FIRMWARE_VERSION_RESULT` | (source engine) | After version check |
| `FIRMWARE_VALIDATION_RESULT` | (source engine) | After checksum validation |
| `FIRMWARE_STATUS` | (source engine) | After status query |

---

## Firmware Registry

The engine seeds its registry on startup with known stable firmware versions:

| Device Type | Version | Checksum |
|---|---|---|
| `ESP32_DEFAULT` | `2.1.0` | `abc123def456` |
| `ESP32_LAMP` | `1.8.3` | `fed987cba654` |
| `ESP32_SENSOR` | `1.5.1` | `123abc789xyz` |

To add a real firmware record, call `this.firmwareRegistry.set(deviceId, record)` inside `seedRegistry()`.

---

## Job State Machine

```
REQUEST_UPDATE received
        │
        ▼
    "pending"
        │
        ▼ (upload engine starts)
   "uploading"
        │
        ├── on failure: "failed"
        │
        ▼
  "validating"
        │
        ▼
   "applying"
        │
        ▼
      "done"  ──▶ FIRMWARE_UPDATED sent to device_engine
```

---

## REST Endpoints

```
GET  /api/engines/firmware_engine            — engine info + status
POST /api/engines/firmware_engine/command    — send any action
GET  /api/engines/firmware/jobs              — all tracked update jobs
```

**Example — request update via REST:**
```bash
curl -X POST /api/engines/firmware_engine/command \
  -H "Content-Type: application/json" \
  -d '{
    "action": "REQUEST_UPDATE",
    "payload": { "deviceId": "ESP32_Lamp_01", "targetVersion": "2.1.0" },
    "priority": "high"
  }'
```
