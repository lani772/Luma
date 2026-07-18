# LUMA Smart Home — AI-Augmented Full System Design

> **Date:** 2026-07-18  
> **Scope:** Parallel implementation of core system Phases 0–2 and a full AI layer across all five feature verticals  
> **Status:** Approved design — ready for implementation planning  
> **References:** Auth & RBAC blueprint (DOC-20260718-WA0000), Architecture & Roadmap (DOC-20260718-WA0001)

---

## Table of Contents

1. [Summary](#1-summary)
2. [System Architecture](#2-system-architecture)
3. [Vertical 1 — Device Control](#3-vertical-1--device-control)
4. [Vertical 2 — Users & Sharing](#4-vertical-2--users--sharing)
5. [Vertical 3 — Automations](#5-vertical-3--automations)
6. [Vertical 4 — Energy](#6-vertical-4--energy)
7. [Vertical 5 — Firmware & Microcontrollers](#7-vertical-5--firmware--microcontrollers)
8. [AI Provider Strategy](#8-ai-provider-strategy)
9. [Migration Inventory](#9-migration-inventory)
10. [New File Inventory](#10-new-file-inventory)
11. [Delivery Schedule](#11-delivery-schedule)
12. [Error Handling & Resilience](#12-error-handling--resilience)
13. [Security Constraints](#13-security-constraints)

---

## 1. Summary

LUMA Smart Home is a React Native / Expo mobile app backed by a Go/Gin cloud API and an ESP32 device layer connected via MQTT. The existing codebase has a complete auth system, device CRUD, and cloud sync — but the mobile app runs on hardcoded data, MQTT is simulated, and no AI features exist.

This design introduces:

1. **Real MQTT** via `react-native-mqtt-client`, replacing the simulated `MQTTManager` internals
2. **Five backend engines** not yet built: invitations, access-requests, scenes, schedules, microcontrollers
3. **One analytics engine** (telemetry pipeline + daily rollups)
4. **AI layer** integrated into every vertical — NL control, automation suggestions, energy insights, permission suggestions, and ESP32 firmware generation
5. **AI providers**: Gemini Flash/Pro (primary — NL control, voice, chat, automation), Anthropic Claude (firmware code generation), OpenAI (optional, embeddings/search)

All AI calls originate **from the mobile app** (mobile-first architecture). The Go backend stores AI-generated data (automations, firmware backups, energy insights) via existing sync/backup engines — no new AI engine is needed on the server.

Work is organised as **5 feature verticals** that each span mobile + backend + AI and are independently deliverable. Core system (Phases 0–2 from the reference docs) and AI layer are implemented in parallel within each vertical.

---

## 2. System Architecture

### 2.1 Layered Diagram

```
Mobile App (React Native / Expo)
├── CloudAuthContext          existing — JWT, refresh token, session restore
├── LumaContext               existing — device state, optimistic updates
├── MQTTContext               existing interface → re-wired internals (V1)
│     └── react-native-mqtt-client  ← replaces NativeModules.MqttClient mock
├── AIContext (new)           wraps Gemini / Anthropic / OpenAI SDKs
│     ├── Gemini Flash        NL device control, voice, in-app chat, automation gen
│     ├── Gemini Pro          Automation suggestions (structured JSON/function calling)
│     └── Anthropic Claude    ESP32 firmware code generation (long context)
└── expo-secure-store         JWT tokens + MQTT credentials + AI API keys

Go Cloud Backend (artifacts/luma-cloud-backend)
├── Existing engines          auth, users, devices, mqtt, firmware, deployment,
│                             notifications, sync, backup
├── New engines (this design) invitations, access-requests, microcontrollers,
│                             rooms, scenes, schedules, analytics
└── Worker ticks              schedule execution, telemetry aggregation, pruning

MQTT Broker (EMQX / Mosquitto)
└── Topic namespace: luma/devices/{id}/state|commands|telemetry|response|...
    Topic namespace: luma/microcontrollers/{mcId}/heartbeat|status|config
```

### 2.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| AI processing location | Mobile-first | API keys stay on device, no backend AI engine, lower operational cost |
| AI API key storage | `expo-secure-store` | Never in AsyncStorage (plaintext), never on backend |
| MQTT library | `react-native-mqtt-client` | Native module — real broker connections in production builds |
| MQTT topic namespace | `luma/devices/{id}/...` | Canonical from backend `topics.go`; fixes existing mismatch |
| RBAC for invitations | Write to `device_admins` | Consistent with current access model; `permissions` table upgrade is a later phase |
| AI data persistence | Stored via existing sync/backup engines | No new backend AI storage engine needed |
| Schedule distribution | Mobile → backend + MQTT retained | ESP32 executes autonomously; cloud executes as fallback |
| Microcontroller FK | UUID ref (new `microcontroller_uuid` column) | Replaces opaque `microcontroller_id TEXT` string |

### 2.3 Vertical Delivery Order

```
Week 1–2   V1 — Device Control      MQTT live + NL control + voice
Week 2–3   V2 — Users & Sharing     Invitations + access requests backend
Week 3–4   V3 — Automations         Scenes + schedules + AI suggestions
Week 5     V4 — Energy              Telemetry pipeline + AI insights
Week 6     V5 — Firmware & MCUs     Microcontrollers engine + AI code gen
```

---

## 3. Vertical 1 — Device Control

### Goal
Real MQTT connection to ESP32 devices. Voice and natural language commands translate to MQTT publishes.

### 3.1 MQTT Re-wire

`src/modules/mqtt/MQTTConnection.ts` internal implementation replaced:

```typescript
// Before: NativeModules.MqttClient (simulated, Expo Go fallback)
// After:  react-native-mqtt-client with credentials from expo-secure-store

import MqttClient from 'react-native-mqtt-client';
const { clientId, username, password, brokerUrl } =
  await SecureStore.getItemAsync('@luma/mqtt_creds_' + deviceId);
```

`src/modules/mqtt/MQTTTopics.ts` namespace corrected:
```typescript
// Before: ROOT = "device"  (wrong — never reaches ESP32)
// After:  ROOT = "luma/devices"  (canonical)
```

QoS policy applied:
- Commands → QoS 1 (at-least-once)
- Telemetry subscriptions → QoS 0
- State subscriptions → QoS 1, retained

LWT set on every connection:
```
Topic:   luma/devices/{deviceId}/status
Payload: {"online": false, "reason": "unexpected_disconnect", "ts": 0}
QoS: 1, Retain: true
```

### 3.2 MQTT Credential Fetch on Login

`services/cloud-api.ts` extended: after successful login/register, for each device in the returned device list, call `POST /cloud/devices/{id}/mqtt-credentials` and store the result in `expo-secure-store` under `@luma/mqtt_creds_{deviceId}`.

No backend changes required — this endpoint already exists and works.

### 3.3 AIContext — Natural Language Control

New `context/AIContext.tsx` wraps Gemini Flash with function calling:

```typescript
// Function schema built from LumaContext.lamps[] + device capabilities
// Input: "dim the bedroom lamp to 40%"
// Output: { deviceId: "...", command: "SET_BRIGHTNESS", params: { brightness: 40 } }

const result = await gemini.generateContent({
  tools: [{ functionDeclarations: [deviceCommandSchema] }],
  contents: [{ role: 'user', parts: [{ text: userInput }] }]
});
// AIContext.handleNLCommand() → LumaContext.updateLamp() → MQTTManager.publishCommand()
```

### 3.4 Voice Interface

`expo-av` (already in project) records microphone input. Audio buffer sent to Gemini multimodal API. Response feeds the same NL control pipeline. A floating "hold to speak" mic button is added to the dashboard tab (`app/(tabs)/index.tsx`).

### 3.5 Device Action Data Flow

```
User speaks / types command
  → AIContext.handleNLCommand()
      → Gemini Flash: NL → { deviceId, command, params }
      → LumaContext.updateLamp()  [optimistic UI]
      → MQTTManager.publishCommand('luma/devices/{id}/commands', QoS 1)
          → react-native-mqtt-client → broker → ESP32
  → Subscribe luma/devices/{id}/response (5s timeout)
      → success:  confirm UI, POST /cloud/sync (background)
      → timeout:  revert optimistic update, show toast
      → error:    revert, show error, push notification
```

### 3.6 Error Handling

| Failure | Behaviour |
|---|---|
| MQTT offline | Command queued in `MQTTQueue`, drained on reconnect |
| Gemini parse failure | Disambiguation UI: "Did you mean: Living Room Lamp?" |
| No devices registered | AI context shows onboarding prompt |
| Broker credential expired | Re-fetch from `/cloud/devices/{id}/mqtt-credentials`, retry |

### 3.7 Files Changed

| File | Change |
|---|---|
| `src/modules/mqtt/MQTTConnection.ts` | Replace simulated client with `react-native-mqtt-client` |
| `src/modules/mqtt/MQTTTopics.ts` | Fix namespace: `device/` → `luma/devices/` |
| `context/AIContext.tsx` | **New** — Gemini Flash + Anthropic wrappers |
| `services/cloud-api.ts` | Add MQTT credential fetch on login |
| `app/(tabs)/index.tsx` | Add voice mic button |

---

## 4. Vertical 2 — Users & Sharing

### Goal
Owner invites users by email or username. Any user can request access. AI suggests appropriate permission levels before the owner sends an invite.

### 4.1 Invitations Engine (Backend)

**New package:** `internal/engines/invitations/` — `dto.go`, `repository.go`, `service.go`, `handlers.go`

**Migration:** `000006_invitations.up.sql`

```sql
CREATE TABLE invitations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_email     TEXT,
    to_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id    UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    permissions  TEXT[] NOT NULL DEFAULT '{}',
    message      TEXT,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
    responded_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_to_user   ON invitations (to_user_id, status);
CREATE INDEX idx_invitations_from_user ON invitations (from_user_id, status);
CREATE INDEX idx_invitations_device    ON invitations (device_id);
```

**Routes** (mounted on `/cloud/api/engines/invitations`, `requireAuth`):

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/` | sender owns `deviceId` | Send invitation |
| `GET` | `/received` | — | List received invitations |
| `GET` | `/sent` | — | List sent invitations |
| `POST` | `/:id/accept` | invitee only | Accept → INSERT device_admins |
| `POST` | `/:id/decline` | invitee only | Decline |
| `DELETE` | `/:id` | sender only | Cancel pending invitation |

Accept flow writes to `device_admins` (Option A — consistent with current RBAC). On accept/decline/cancel, calls `notificationsService.Create()`.

### 4.2 Access Requests Engine (Backend)

**New package:** `internal/engines/access-requests/` — `dto.go`, `repository.go`, `service.go`, `handlers.go`

**Migration:** `000007_access_requests.up.sql`

```sql
CREATE TABLE access_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_owner_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id        UUID REFERENCES devices(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'viewer'
                     CHECK (permission_level IN ('viewer','admin')),
    message          TEXT,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','blocked')),
    responded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_requests_owner     ON access_requests (target_owner_id, status);
CREATE INDEX idx_access_requests_requester ON access_requests (requester_id, status);
CREATE INDEX idx_access_requests_device    ON access_requests (device_id);
```

`blocked` status prevents re-submission. Approve flow calls `devicesService.GrantAdmin()` for audit trail.

**Routes** (mounted on `/cloud/api/engines/access-requests`, `requireAuth`):

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Submit access request |
| `GET` | `/` | List own requests (sent + incoming) |
| `POST` | `/:id/approve` | Approve + grant access |
| `POST` | `/:id/reject` | Reject |
| `POST` | `/:id/block` | Reject + block requester |

### 4.3 Ownership Transfer Fix

`internal/engines/devices/service.go`: wire the `previousOwnerBecomesAdmin bool` field from `TransferOwnershipRequest`. Skip `AddAdmin` call if `false`. (Currently always adds previous owner as admin, ignoring the mobile flag.)

### 4.4 Mobile Wiring

All screens already exist (`invitations.tsx`, `access.tsx`). Changes: replace `apiFetchOptional` mock calls with real `cloud-api.ts` methods.

New `cloud-api.ts` methods:
- `sendInvitation(req)` → `POST /cloud/api/engines/invitations`
- `respondToInvitation(id, action)` → `POST /cloud/api/engines/invitations/:id/{accept|decline}`
- `cancelInvitation(id)` → `DELETE /cloud/api/engines/invitations/:id`
- `submitAccessRequest(req)` → `POST /cloud/api/engines/access-requests`
- `respondToAccessRequest(id, action)` → `POST /cloud/api/engines/access-requests/:id/{approve|reject|block}`

### 4.5 AI Layer — Permission Suggestion

When the invite form opens, `AIContext.suggestPermission()` sends a non-blocking Gemini Flash request:

```typescript
// Context: invitee email, device type, time of day, household size (from user count)
// Output: { suggestedRole: "member", reasoning: "Guest access recommended for non-residents" }
// UI: pre-fills role selector with suggestion + shows reasoning in subtle grey text
// User can always override
```

Failure is silent — form defaults to `member` role.

### 4.6 Files Changed

| File | Change |
|---|---|
| `migrations/000006_invitations.up.sql` | New |
| `migrations/000007_access_requests.up.sql` | New |
| `internal/engines/invitations/` | New (4 files) |
| `internal/engines/access-requests/` | New (4 files) |
| `internal/engines/devices/service.go` | Wire `previousOwnerBecomesAdmin` flag |
| `cmd/api/main.go` | Wire both new engines |
| `services/cloud-api.ts` | Add 5 new methods |
| `app/invitations.tsx` | Replace mock with real API |
| `app/access.tsx` | Replace mock with real API |
| `context/AIContext.tsx` | Add `suggestPermission()` |

---

## 5. Vertical 3 — Automations

### Goal
Real scene and schedule CRUD backed by the cloud. AI watches usage history and proactively suggests new automations.

### 5.1 Rooms Engine (Backend)

Rooms are not yet in any migration (`scenes` and `schedules` already exist in `000001`). Added in `000008_rooms.up.sql`:

```sql
CREATE TABLE rooms (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name     TEXT NOT NULL,
    icon     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE devices ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;
```

Simple CRUD engine at `/cloud/rooms`.

### 5.2 Scenes Engine (Backend)

`scenes` table exists in migration `000001`. New engine at `internal/engines/scenes/`:

| Method | Path | Description |
|---|---|---|
| `POST` | `/cloud/scenes` | Create scene (`name`, `actions: JSONB`) |
| `GET` | `/cloud/scenes` | List user's scenes |
| `POST` | `/cloud/scenes/:id/activate` | Publish MQTT command per action |
| `PATCH` | `/cloud/scenes/:id` | Update |
| `DELETE` | `/cloud/scenes/:id` | Delete |

`activate` iterates `scene.actions` and publishes to `luma/devices/{id}/commands` via the MQTT adapter for each. Partial failures (some devices offline) return per-device results.

### 5.3 Schedules Engine (Backend)

`schedules` table exists in migration `000001`. New engine at `internal/engines/schedules/`:

| Method | Path | Description |
|---|---|---|
| `POST` | `/cloud/schedules` | Create schedule |
| `GET` | `/cloud/schedules` | List (filter by `deviceId`) |
| `PATCH` | `/cloud/schedules/:id/toggle` | Enable / disable |
| `DELETE` | `/cloud/schedules/:id` | Delete |

On creation, schedule is also pushed via MQTT retained: `luma/devices/{id}/schedule` (QoS 1) so ESP32 can execute autonomously when app is offline.

The existing `internal/worker/worker.go` gets a new tick for cloud-side schedule execution as offline fallback.

### 5.4 Structured AutomationRule Model (Mobile)

The flat `{ trigger: string, action: string }` type in `data/luma-data.ts` is replaced with the full typed model from §8.2 of the architecture doc:

```typescript
interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  trigger: AutomationTrigger;       // time | device_state | sensor | sunrise_sunset | manual
  conditions: AutomationCondition[];
  actions: AutomationAction[];      // device_command | scene_activate | notify | delay | webhook
  cooldownMs?: number;
  lastFiredAt?: number;
}
```

This type serializes directly to the `schedules.action` JSONB column.

### 5.5 AI Layer — Automation Suggestions

`AIContext.suggestAutomations()` runs on app foreground (if cache > 24h stale):

```typescript
// 1. Fetch: GET /cloud/sync/delta → device state history (last 7 days)
// 2. Build compact usage summary (not raw events)
// 3. Gemini Pro with function calling → AutomationRule[] (max 3 suggestions)
// 4. Cache result 24h in expo-secure-store
// 5. Dashboard shows suggestion card per result
```

Suggestions surface as a dismissable card: *"💡 You always turn off all lights at 11pm — automate it?"*. Tapping "Automate" saves via `POST /cloud/schedules`. Dismissing hides for 7 days.

Energy suggestion tap (from V4) deep-links into schedule creation pre-filled with device + time window.

### 5.6 Files Changed

| File | Change |
|---|---|
| `migrations/000008_rooms.up.sql` | New |
| `internal/engines/rooms/` | New (4 files) |
| `internal/engines/scenes/` | New (4 files) |
| `internal/engines/schedules/` | New (4 files) |
| `internal/worker/worker.go` | Add schedule tick handler |
| `cmd/api/main.go` | Wire 3 new engines |
| `data/luma-data.ts` | Replace flat `AutomationRule` with structured type |
| `app/scenes.tsx` | Wire to scenes API |
| `app/device/[id].tsx` | Wire schedule CRUD to schedules API |
| `app/(tabs)/index.tsx` | Add AI suggestion card component |
| `context/AIContext.tsx` | Add `suggestAutomations()` |

---

## 6. Vertical 4 — Energy

### Goal
The energy screen shows real power consumption from device telemetry. AI detects anomalies and surfaces actionable cost-saving suggestions.

### 6.1 Telemetry Ingestion (Backend)

ESP32 devices publish watt readings via MQTT QoS 0:
```
Topic:   luma/devices/{id}/telemetry
Payload: { "watts": 42.5, "voltage": 230, "ts": 1720000000 }
```

`pkg/mqttadapter` gains a `Subscribe()` method. The backend subscribes to `luma/devices/+/telemetry` and writes each message to `analytics_events`:
```sql
INSERT INTO analytics_events (device_id, event_type, data, created_at)
VALUES ($1, 'telemetry', $2, now());
```

### 6.2 Analytics Engine (Backend)

New `internal/engines/analytics/` package.

**Worker ticks** (added to `internal/worker/worker.go`):
- **Hourly aggregation:** Roll `analytics_events` into `analytics_daily_rollups` (`total_kwh`, `peak_watts`, `on_duration_seconds`)
- **Daily pruning:** Delete raw events older than 30 days

**Routes:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/cloud/analytics/devices/:id/daily` | Daily rollups (last N days) |
| `GET` | `/cloud/analytics/devices/:id/summary` | Total kWh, cost estimate, peak hour |
| `GET` | `/cloud/analytics/home` | Aggregate across all owned devices |

Cost estimate uses `kwh_rate` from `users.preferences` JSONB. User sets their electricity rate in Settings.

### 6.3 Mobile Wiring

`app/(tabs)/energy.tsx` already has chart components, weekly/monthly toggles, and a donut — all on hardcoded data:
- Replace `INITIAL_ENERGY_DATA` with `GET /cloud/analytics/home`
- Wire per-device breakdown chart to `GET /cloud/analytics/devices/:id/daily`

`app/settings.tsx` gains an electricity rate input field stored via `PATCH /cloud/users/me/preferences`.

### 6.4 AI Layer — Energy Optimization

`AIContext.analyzeEnergy()` runs on energy tab focus (cache 6h):

```typescript
// 1. Fetch 30-day daily rollups for all devices
// 2. Build compact summary (total kWh, peak devices, usage patterns)
// 3. Gemini Pro → { anomalies: Anomaly[], suggestions: Suggestion[] }
// 4. Cache 6h, display as "Insights" card

// Anomaly: "Living Room Lamp used 340% more power than usual on Tuesday"
// Suggestion: "Switch off Bedroom Lamp during 2–6pm — saves ~$4/month"
```

Anomaly threshold: device `peak_watts` in last 7 days > 200% of 30-day average triggers a push notification via `POST /cloud/notifications`.

Tapping an energy suggestion deep-links to V3 schedule creation, pre-filled with the device and suggested time window.

### 6.5 Files Changed

| File | Change |
|---|---|
| `pkg/mqttadapter/` | Add `Subscribe()` + telemetry handler |
| `internal/engines/analytics/` | New (4 files) |
| `internal/worker/worker.go` | Add telemetry aggregation + pruning ticks |
| `cmd/api/main.go` | Wire analytics engine |
| `app/(tabs)/energy.tsx` | Replace hardcoded data with API calls |
| `app/settings.tsx` | Add electricity rate input |
| `context/AIContext.tsx` | Add `analyzeEnergy()` |

---

## 7. Vertical 5 — Firmware & Microcontrollers

### Goal
Microcontrollers are first-class cloud entities. OTA firmware updates are pushed from the app. Anthropic Claude generates complete ESP32 firmware code from plain English descriptions.

### 7.1 Microcontrollers Engine (Backend)

The single largest schema gap — `microcontroller_id` is currently an opaque `TEXT` field on `devices`.

**Migration:** `000009_microcontrollers.up.sql`

```sql
CREATE TABLE microcontrollers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name             TEXT NOT NULL,
    model            TEXT NOT NULL,
    mac_address      MACADDR NOT NULL UNIQUE,
    ip_address       INET,
    firmware_version TEXT,
    hardware_version TEXT,
    config_version   INTEGER NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','online','offline','suspended','decommissioned')),
    registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at     TIMESTAMPTZ,
    last_sync_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE devices
    ADD COLUMN microcontroller_uuid UUID REFERENCES microcontrollers(id) ON DELETE CASCADE;
```

**Routes** (`/cloud/microcontrollers`, `requireAuth`):

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Register MCU → returns MQTT credentials |
| `GET` | `/` | List owned MCUs |
| `GET` | `/:id` | Detail + child devices |
| `PATCH` | `/:id` | Rename, update firmware/hardware version |
| `DELETE` | `/:id` | Decommission (cascade-deletes devices) |

MQTT heartbeat: backend subscribes to `luma/microcontrollers/+/heartbeat`, updates `last_seen_at`, flips `status` to `online`.

### 7.2 Firmware Engine Completion

The firmware engine already exists. Two endpoints to fully implement:
- `POST /cloud/firmware/releases` — upload binary metadata (version, checksum SHA-256, channel: `stable|beta`)
- `POST /cloud/deployments` — push OTA to device: publishes to `luma/devices/{id}/firmware` with `{ version, url, checksum }`

Deployment status tracking polls `luma/devices/{id}/telemetry` for OTA progress events.

### 7.3 Mobile Wiring

- `app/microcontroller-register.tsx` — already built, wire to `POST /cloud/microcontrollers`, store returned MQTT credentials in `expo-secure-store`
- `app/microcontroller-workspace.tsx` — already built, wire device list to `GET /cloud/microcontrollers/:id`, surface real `status` / `last_seen_at`

### 7.4 AI Layer — Firmware Code Generation

New screen `app/firmware-generate.tsx`, accessible from MC Workspace.

```typescript
// User types: "Read temperature every 30s, publish to MQTT, blink LED on error"
// AIContext.generateFirmware({ mcModel, description, existingCode? })
//   → Anthropic claude-3-5-sonnet
//       system: ESP32 expert + full LUMA MQTT topic spec + Arduino template
//       user:   description + hardware model
//   → streams response → syntax-highlighted code viewer
//   → "Copy" button + "Save as backup" → POST /cloud/backups (base64 encoded)
```

**Why Claude (not Gemini):** Superior long-context code generation. The system prompt includes the full LUMA MQTT topic spec, LWT format, QoS policy table, and credential injection template simultaneously — requires 8K+ context with high coherence. Generated firmware always uses the correct `luma/devices/{id}/...` topic namespace.

### 7.5 Firmware Generation Data Flow

```
User opens MC Workspace → taps "Generate Firmware"
  → Describes MCU behaviour in text input
  → AIContext.generateFirmware(description, mcModel)
      → Anthropic claude-3-5-sonnet (streaming)
          system: LUMA MQTT spec + Arduino template + device model capabilities
          user: user description
      → Code viewer renders progressively as tokens stream
  → User reviews → taps "Save to Cloud"
      → POST /cloud/backups { type: "firmware_code", mcId, content: base64(code) }
  → User compiles externally → taps "Push OTA"
      → POST /cloud/deployments { mcId, firmwareReleaseId, targetDeviceIds }
      → Backend: publish luma/devices/{id}/firmware { version, url, checksum }
      → ESP32: OTA download + apply
```

### 7.6 Files Changed

| File | Change |
|---|---|
| `migrations/000009_microcontrollers.up.sql` | New |
| `internal/engines/microcontrollers/` | New (4 files) |
| `internal/engines/firmware/handlers.go` | Wire upload + deploy endpoints |
| `internal/engines/deployment/service.go` | MQTT publish on deploy |
| `cmd/api/main.go` | Wire microcontrollers engine |
| `app/microcontroller-register.tsx` | Wire to `POST /cloud/microcontrollers` |
| `app/microcontroller-workspace.tsx` | Wire to real MCU API |
| `app/firmware-generate.tsx` | New screen |
| `context/AIContext.tsx` | Add `generateFirmware()` using Anthropic SDK |

---

## 8. AI Provider Strategy

| Provider | Role | Model | When Called | Key Constraint |
|---|---|---|---|---|
| **Gemini Flash** | NL device control, voice, in-app chat | `gemini-2.0-flash` | On every voice/text command (real-time) | Must complete < 2s; use function calling for structured output |
| **Gemini Pro** | Automation suggestions, energy insights, permission suggestions | `gemini-1.5-pro` | On app foreground (cached 24h / 6h) | Structured JSON output via function calling |
| **Anthropic Claude** | ESP32 firmware code generation | `claude-3-5-sonnet-20241022` | On explicit user trigger (firmware-generate screen) | Streaming response; long system prompt (MQTT spec) |
| **OpenAI** | Optional — semantic search, embeddings | `text-embedding-3-small` | Not in initial scope | Added later if device/scene search becomes complex |

### API Key Storage

All AI API keys stored in `expo-secure-store`. Keys are loaded into `AIContext` at boot via `SecureStore.getItemAsync('@luma/ai_keys')`. The user sets keys once in Settings → Advanced → AI Configuration. Keys **never** leave the device.

### Cost Controls

- Gemini Flash responses: max 200 output tokens for device commands (always function call, no prose)
- Gemini Pro suggestions: max 3 items per call, cached aggressively (24h for automations, 6h for energy)
- Claude firmware generation: one call per user trigger, streamed, no caching needed

---

## 9. Migration Inventory

| Migration File | Content | Status |
|---|---|---|
| `000001_init_schema.up.sql` | Core tables (users, devices, sessions, etc.) | ✅ Exists |
| `000002_firmware_deployments.up.sql` | `firmware_deployments`, `device_deployments` | ✅ Exists |
| `000003_notifications.up.sql` | Notifications table update | ✅ Exists |
| `000004_cloud_sync.up.sql` | Sync state tables | ✅ Exists |
| `000005_username_auth.up.sql` | `ALTER TABLE users ADD COLUMN username` | ✅ Exists |
| `000006_invitations.up.sql` | `invitations` table + indexes | 🔲 To create |
| `000007_access_requests.up.sql` | `access_requests` table + indexes | 🔲 To create |
| `000008_rooms.up.sql` | `rooms` table + `devices.room_id` column (`scenes`/`schedules` already in 000001) | 🔲 To create |
| `000009_microcontrollers.up.sql` | `microcontrollers` table + `devices.microcontroller_uuid` column | 🔲 To create |

---

## 10. New File Inventory

### Backend (Go) — New Engines

```
internal/engines/invitations/
  dto.go           handler.go        repository.go     service.go
internal/engines/access-requests/
  dto.go           handler.go        repository.go     service.go
internal/engines/rooms/
  dto.go           handler.go        repository.go     service.go
internal/engines/scenes/
  dto.go           handler.go        repository.go     service.go
internal/engines/schedules/
  dto.go           handler.go        repository.go     service.go
internal/engines/analytics/
  dto.go           handler.go        repository.go     service.go
internal/engines/microcontrollers/
  dto.go           handler.go        repository.go     service.go
```

### Backend (Go) — Modified Files

```
pkg/mqttadapter/           Add Subscribe() + telemetry handler
internal/worker/worker.go  Add schedule execution + telemetry aggregation ticks
internal/engines/devices/service.go    Wire previousOwnerBecomesAdmin flag
internal/engines/firmware/handlers.go  Wire upload + deploy endpoints
internal/engines/deployment/service.go MQTT publish on deploy
cmd/api/main.go            Wire 7 new engines
```

### Mobile (TypeScript/React Native) — New Files

```
context/AIContext.tsx
app/firmware-generate.tsx
```

### Mobile — Modified Files

```
src/modules/mqtt/MQTTConnection.ts    react-native-mqtt-client re-wire
src/modules/mqtt/MQTTTopics.ts        Fix namespace
services/cloud-api.ts                 MQTT creds + 5 invitation/access methods
data/luma-data.ts                     Structured AutomationRule type
context/LumaContext.tsx               (minor) remove hardcoded initial lamps
app/(tabs)/index.tsx                  Voice button + AI suggestion cards
app/(tabs)/energy.tsx                 Real analytics data
app/invitations.tsx                   Real API calls
app/access.tsx                        Real API calls
app/scenes.tsx                        Real API calls
app/device/[id].tsx                   Schedule CRUD wired
app/microcontroller-register.tsx      Wire to POST /cloud/microcontrollers
app/microcontroller-workspace.tsx     Wire to real MCU API
app/settings.tsx                      Electricity rate + AI key settings
```

---

## 11. Delivery Schedule

| Week | Vertical | Backend Deliverables | Mobile Deliverables | AI Deliverables |
|---|---|---|---|---|
| 1–2 | V1 Device Control | — (existing endpoints) | MQTT re-wire, topic fix, creds on login | AIContext scaffold, NL control, voice button |
| 2–3 | V2 Users & Sharing | Invitations engine, access-requests engine, ownership transfer fix | Invitation/access screens wired | Permission suggestion |
| 3–4 | V3 Automations | Rooms + scenes + schedules engines, worker tick | Structured AutomationRule, scenes/schedules wired | Automation suggestion cards |
| 5 | V4 Energy | Analytics engine, MQTT telemetry subscribe, worker aggregation | Energy screen real data, electricity rate setting | Energy insights + anomaly alerts |
| 6 | V5 Firmware & MCUs | Microcontrollers engine, firmware deploy, OTA MQTT publish | MCU register/workspace wired, firmware-generate screen | Claude firmware code gen (streaming) |

---

## 12. Error Handling & Resilience

| Layer | Failure Mode | Behaviour |
|---|---|---|
| MQTT | Broker unreachable | Command queued in MQTTQueue; drained FIFO on reconnect; max 3 retries then DLQ |
| MQTT | Command timeout (5s no response) | Optimistic UI reverted; toast shown; cloud sync still fires |
| Gemini / Claude | API error or timeout | Silent fallback; UI shows degraded state (no AI card, default role); never crashes |
| Gemini | Unparseable function call output | Caught by schema validation; disambiguation UI shown for NL control; skip for background tasks |
| Backend | New engine 404 (deploy lag) | Mobile uses `apiFetchOptional` pattern; returns `[]` gracefully |
| Analytics | No telemetry data | Energy screen shows "No data yet — check back after 24h of device uptime" |
| Firmware gen | Claude API failure | Error state shown in code viewer; retry button; error message displayed (never swallowed silently) |
| MQTT credentials | Expired / missing from SecureStore | Re-fetch from `/cloud/devices/{id}/mqtt-credentials` transparently, retry connect |

---

## 13. Security Constraints

| Constraint | Implementation |
|---|---|
| AI API keys never on backend | Keys stored in `expo-secure-store` only; set by user in Settings |
| JWT + MQTT creds never in AsyncStorage | All sensitive tokens use `expo-secure-store` (iOS Keychain / Android Keystore) |
| MQTT topic scope isolation | Broker ACLs enforced per device identity (existing EMQX adapter); phones can only publish commands to their authorized devices |
| AI-generated automations go through normal auth | `POST /cloud/schedules` requires valid JWT — AI suggestions cannot bypass permission model |
| Firmware backup content | Stored as base64 in `backups` table; accessible only to device owner via `RequireAuth` + `ownerOnly()` guard |
| Command replay prevention | MQTT command payload includes `nonce` + `ts` (existing `MQTTSecurity.ts`); ESP32 firmware must validate within ±60s window |
| Invitation expiry | Checked at request time on accept endpoint; expired invitations return `400 INVITATION_EXPIRED` |
| Access request blocking | `blocked` status on `access_requests` prevents re-submission silently (no notification to prevent harassment escalation) |
