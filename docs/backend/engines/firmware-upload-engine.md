# Firmware Upload Engine

**ID:** `firmware_upload_engine`
**File:** `artifacts/api-server/src/engines/firmware-upload/firmware-upload-engine.ts`

---

## Responsibility

The Firmware Upload Engine handles the physical delivery of firmware to devices.
It supports two upload paths — OTA (Over The Air) and USB — and manages progress tracking and rollback.
It receives job requests from the Firmware Engine and delegates USB flashing to the USB Engine.

```
firmware_engine
      │  UPLOAD_FIRMWARE_PACKAGE
      ▼
firmware_upload_engine
      │
      ├── OTA path: simulates upload directly
      └── USB path: delegates FLASH_FIRMWARE → usb_engine
                                                    │
                                            USB_FLASH_COMPLETE
                                                    │
                                                    ▼
                                       firmware_upload_engine
                                       sends UPLOAD_COMPLETE → firmware_engine
```

---

## Upload Methods

| Method | Trigger | Description |
|---|---|---|
| `ota` | `UPLOAD_FIRMWARE_PACKAGE` or `OTA_UPDATE` | Wireless update over MQTT/HTTP |
| `usb` | `USB_FLASH` | Wired update via serial port + esptool |

---

## Upload Job Record

```typescript
interface UploadJob {
  jobId:           string;
  deviceId:        string;
  firmwareVersion: string;
  method:          "ota" | "usb";
  status:          UploadStatus;
  progress:        number;     // 0–100
  startedAt:       string;
  finishedAt?:     string;
  errorMessage?:   string;
  previousVersion?: string;   // set for rollbacks
}

type UploadStatus =
  | "preparing"
  | "uploading"
  | "verifying"
  | "applying"
  | "done"
  | "failed"
  | "rolled_back";
```

---

## Subscribed Actions

### `UPLOAD_FIRMWARE_PACKAGE`

Start an OTA upload (called by Firmware Engine).

**Payload:**
```typescript
{
  jobId:         string;
  deviceId:      string;
  targetVersion: string;
}
```

**Side effects:**
- Creates an `UploadJob` (method: `ota`)
- Starts OTA progress simulation (5 stages × 1 s each)
- BROADCASTs `UPLOAD_PROGRESS` at each stage
- Sends `UPLOAD_COMPLETE` → `firmware_engine` on completion

---

### `OTA_UPDATE`

Directly trigger an OTA update (without going through Firmware Engine).
Accepts an optional `currentVersion` for rollback tracking.

**Payload:**
```typescript
{
  deviceId:        string;
  version:         string;
  currentVersion?: string;   // saved for potential rollback
}
```

---

### `USB_FLASH`

Start a USB firmware flash. Delegates to USB Engine.

**Payload:**
```typescript
{
  deviceId:  string;
  version:   string;
  portPath:  string;   // e.g. "/dev/ttyUSB0"
}
```

**Side effect:** sends `FLASH_FIRMWARE` → `usb_engine` (HIGH priority)

---

### `USB_FLASH_COMPLETE`

Received from USB Engine when flash finishes.

**Payload:** `{ deviceId: string; success: boolean }`

**Side effect:** sends `UPLOAD_COMPLETE` → `firmware_engine` (HIGH priority)

---

### `ROLLBACK_TO_VERSION`

Roll a device back to a previous firmware version.
Runs the same OTA simulation but sets `isRollback = true` in broadcasts.

**Payload:**
```typescript
{
  deviceId: string;
  version:  string;
}
```

**Broadcast on completion:** `ROLLBACK_COMPLETE` → `{ deviceId, version }` (HIGH priority)

---

### `GET_UPLOAD_STATUS`

Query job status.

**Payload:**
```typescript
{
  jobId?: string;   // if omitted, returns all jobs
}
```

**Response event:** `UPLOAD_STATUS`
```typescript
{ job: UploadJob }           // single job
{ jobs: UploadJob[] }        // all jobs (no jobId)
{ error: "not_found", jobId } // job not found
```

---

### `CANCEL_UPLOAD`

Cancel an in-progress upload.

**Payload:** `{ jobId: string }`

**Side effect:** sets `job.status = "failed"`, `job.errorMessage = "cancelled_by_user"`

---

## OTA Progress Stages

The simulated OTA runs these stages sequentially (1 second each):

```
"preparing"   0%    ──▶
"uploading"   25%   ──▶
"verifying"   60%   ──▶
"applying"    85%   ──▶
"done"        100%  ──▶ UPLOAD_COMPLETE → firmware_engine
```

At each stage, `UPLOAD_PROGRESS` is broadcast:
```typescript
{
  jobId:      string;
  deviceId:   string;
  status:     UploadStatus;
  progress:   number;
  method:     "ota" | "usb";
  isRollback: boolean;
}
```

---

## Rollback Support

When calling `OTA_UPDATE`, pass `currentVersion` to enable rollback:

```typescript
// Original update
gateway.sendCommand(
  "device_engine",
  "firmware_upload_engine",
  "OTA_UPDATE",
  { deviceId: "ESP32_Lamp_01", version: "2.1.0", currentVersion: "1.8.3" }
);

// If 2.1.0 is bad, roll back:
gateway.sendCommand(
  "device_engine",
  "firmware_engine",
  "ROLLBACK_FIRMWARE",
  { deviceId: "ESP32_Lamp_01", version: "1.8.3" }
);
// firmware_engine sends → firmware_upload_engine: ROLLBACK_TO_VERSION (CRITICAL)
```

---

## REST Endpoints

```
GET  /api/engines/firmware_upload_engine           — engine info
POST /api/engines/firmware_upload_engine/command   — send any action
GET  /api/engines/firmware-upload/jobs             — all upload jobs + progress
```

**Example — check upload job progress:**
```bash
curl /api/engines/firmware-upload/jobs
# Returns all jobs with status and progress
```

**Example — cancel a stuck upload:**
```bash
curl -X POST /api/engines/firmware_upload_engine/command \
  -d '{ "action": "CANCEL_UPLOAD", "payload": { "jobId": "ota-1720000000000" } }'
```
