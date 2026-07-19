# LUMA AI — Full System Design Specification
**Phases 0–2 · 5 AI Verticals**
_Version 1.0 · July 19, 2026_

---

## Executive Summary

LUMA is an edge-first smart home platform that coordinates device control, firmware management, and mesh networking across a mobile app, a local gateway API server, and a cloud backend. This document specifies how AI capabilities are layered onto that foundation across three phases — **MVP (Phase 0)**, **Beta AI (Phase 1)**, and **Production Closed Loop (Phase 2)** — and details five AI verticals that together deliver a self-managing, learning home environment.

**The central design principle: inference runs at the edge.** Every AI decision is made on the local gateway (Node.js process) or on the user's phone (Expo/React Native), using models packaged and versioned through the existing OTA firmware pipeline. Cloud infrastructure handles model training, telemetry aggregation, and update delivery — but a home with no internet connection retains full AI capability.

**The five AI verticals:**

| # | Vertical | Core Capability |
|---|---|---|
| 1 | Digital Twin Simulation | Virtual device modeling, what-if scenario testing |
| 2 | Predictive Automation | Routine learning, proactive rule suggestion/execution |
| 3 | Mesh Network Intelligence | Self-healing topology, signal-quality-based rerouting |
| 4 | AI-Assisted Firmware Rollout | Risk scoring, staged OTA with automatic rollback |
| 5 | Computer Vision | Occupancy detection, scene-triggered automation |

**Business impact by Phase 2:**
- Reduction in user-configured automation rules (predictive engine handles routine patterns)
- Failed firmware updates caught by risk scorer before rollout
- Mesh self-healing reduces manual device reconnection steps
- CV occupancy enables energy-aware automation without explicit schedules

---

## 1. System Context

### 1.1 Current Architecture (as of Phase 0 entry)

```
┌─────────────────────────────────────────────────────────────────┐
│  Mobile App (Expo/React Native)                                 │
│  Screens: Devices · Energy · Users · Connectivity · Firmware   │
│  Engines: AutomationEngine · DeviceManagementEngine ·          │
│           FirmwareEngine · MQTTCommunicationEngine              │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTPS REST / MQTT
┌──────────────────────────▼──────────────────────────────────────┐
│  API Server (Node.js / Express 5)  — Port 8080                  │
│  Engines: device_engine · firmware_engine · mqtt_engine ·       │
│           usb_engine · wifi_engine · firmware_upload_engine     │
│  DB:  PostgreSQL (engine_devices, engine_firmware,              │
│              engine_firmware_jobs) + MongoDB (optional mirror)  │
└──────────┬────────────────────────┬───────────────────────────┘
           │ USB serial              │ MQTT (luma/device/{id}/state)
     ┌─────▼──────┐           ┌─────▼───────┐
     │ USB Devices│           │ MQTT Devices│
     └────────────┘           └─────────────┘
                           ┌──────────────────────────────────────┐
                           │  Cloud Backend (Go / Gin) — Port 8090│
                           │  /cloud/auth · /cloud/devices ·      │
                           │  /cloud/firmware · /cloud/sync ·     │
                           │  /cloud/backups · /cloud/analytics   │
                           │  DB: PostgreSQL (users, devices,     │
                           │      firmware_releases, sync_states, │
                           │      analytics_events)               │
                           └──────────────────────────────────────┘
```

### 1.2 Data Already Available at Phase 0

| Source | Table / Topic | Fields of AI interest |
|---|---|---|
| Device state | `engine_devices` | `config`, `status`, `last_seen` |
| MQTT stream | `luma/device/{id}/state` | Voltage, temperature, error flags |
| Firmware jobs | `engine_firmware_jobs` | `status`, `method`, `started_at`, `completed_at` |
| Automation rules | `automation_rules` (mobile) | Trigger, condition, action, created/modified |
| Analytics events | `analytics_events` (cloud PG) | Event type, device_id, user_id, payload, timestamp |

---

## 2. Design Philosophy

### 2.1 Edge-First Inference

All five AI verticals run their inference loop on one of two edge nodes:

- **Gateway node**: The Node.js API server process. Models load as ONNX Runtime (`onnxruntime-node`) or TensorFlow.js (`@tensorflow/tfjs-node`) workers. Inference latency target: < 50 ms per prediction.
- **Phone node**: Expo / React Native app, using `@tensorflow/tfjs-react-native`. Used exclusively for Computer Vision (vertical 5) where the camera source is the phone.

Cloud AI services (OpenAI, Vertex AI, etc.) are explicitly **not** in the inference path for any vertical. They may be used during model training (Phase 1) and fine-tuning (Phase 2), but the resulting weights are packaged and shipped to the edge.

### 2.2 Shadow Mode Gate

Every new AI vertical enters **shadow mode** first: the model predicts and logs, but does not act. Predictions are stored in `ai_shadow_predictions` (see §5.3). Promotion to **active mode** requires:

1. ≥ 7 days of shadow data collected
2. Precision and recall metrics meet vertical-specific thresholds (defined per vertical in §6)
3. Manual approval via the Go backend's `/cloud/ai/models/{id}/promote` endpoint

This gate applies independently per home (per `user_id` / `home_id`). A model can be in shadow mode in one home and active in another.

### 2.3 Explainability Contract

Every AI decision surfaced to the user includes a `reason` field — a short human-readable string generated by the model. The mobile app's Automation and Devices screens render this string alongside any AI-originated suggestion or action. Example:

> _"Suggested because your lights turn on at 07:30 on weekdays 94% of the time."_

The `reason` is mandatory in the `AIDecision` type. Models that cannot generate reasons are not promoted to active mode.

### 2.4 Rollback Contract

Any AI-originated actuation that fails (device error response, MQTT timeout, or user explicit rejection) increments the model's `failure_count` for that prediction class. When `failure_rate` over a 24-hour window exceeds `rollback_threshold` (per-vertical default: 15%), the engine auto-demotes to shadow mode and emits a `model_demoted` analytics event.

---

## 3. Phase 0 — MVP Foundation

**Goal:** The current system runs reliably and generates the telemetry that AI models will train on. No inference occurs in Phase 0.

### 3.1 Deliverables

| Deliverable | Owner | Status |
|---|---|---|
| All three workflows healthy (Node API, Go Cloud, Expo Mobile) | Infra | ✅ Complete |
| PostgreSQL schema auto-migrated at API server boot | API Server | ✅ Complete |
| MongoDB dual-write layer (optional, graceful no-op) | API Server | ✅ Complete |
| `analytics_events` table populated from all engine actions | API Server + Cloud | 🔲 Needed |
| `device_telemetry` time-series table structured for ML feature extraction | Cloud DB | 🔲 Needed |
| Event schema v1 standardized across all engines | API Server | 🔲 Needed |

### 3.2 Analytics Event Schema (Phase 0 requirement)

All engines in the API server must emit structured events to the `analytics_events` table (cloud PG) via a shared `emitEvent(type, payload)` helper. This is the training data for every Phase 1 model.

```typescript
// artifacts/api-server/src/lib/analytics.ts
interface AnalyticsEvent {
  id: string;              // UUIDv4
  home_id: string;         // derived from JWT / gateway registration
  device_id: string | null;
  engine_id: string;       // e.g. "device_engine", "mqtt_engine"
  event_type: string;      // namespaced: "device.state_change", "firmware.job_completed"
  payload: Record<string, unknown>;
  occurred_at: string;     // ISO 8601
  schema_version: "1.0";
}
```

**Required event types for Phase 0:**

| Event type | Emitted by | Key payload fields |
|---|---|---|
| `device.state_change` | `device_engine` | `device_id`, `prev_status`, `next_status`, `source` |
| `device.command_sent` | `device_engine` | `device_id`, `command`, `success` |
| `firmware.job_started` | `firmware_engine` | `job_id`, `device_id`, `method`, `version` |
| `firmware.job_completed` | `firmware_engine` | `job_id`, `duration_ms`, `success`, `error_code` |
| `mqtt.message_received` | `mqtt_engine` | `topic`, `device_id`, `signal_quality`, `latency_ms` |
| `automation.rule_triggered` | (mobile → cloud sync) | `rule_id`, `trigger_type`, `action_type`, `executed` |
| `wifi.provision_attempt` | `wifi_engine` | `device_id`, `success`, `duration_ms` |

### 3.3 Device Telemetry Table

A new `device_telemetry` table is added to the cloud PG schema to store time-series readings from MQTT device state messages. This is the primary dataset for the Digital Twin, Mesh Intelligence, and Predictive Automation models.

```sql
CREATE TABLE device_telemetry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id       UUID NOT NULL,
  device_id     UUID NOT NULL REFERENCES devices(id),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voltage       NUMERIC(6,3),
  temperature_c NUMERIC(5,2),
  rssi_dbm      INTEGER,
  error_flags   INTEGER,
  raw_payload   JSONB,
  INDEX (device_id, recorded_at DESC),
  INDEX (home_id, recorded_at DESC)
);
```

Retention policy: 90 days rolling at Phase 1 entry; extended to 1 year in Phase 2.

### 3.4 Phase 0 Exit Criteria

- `analytics_events` receiving ≥ 500 events/day per active home in staging
- `device_telemetry` populated from live MQTT stream
- Zero breaking schema changes pending before Phase 1 model training begins

---

## 4. Phase 1 — Beta AI Features

**Goal:** All five AI verticals deployed to edge. Each starts in shadow mode, with a defined promotion path.

### 4.1 New Infrastructure Components

#### 4.1.1 `AIEngineBase` (API Server)

Abstract base class for all AI engines in the Node.js API server. Extends the existing `EngineBase` pattern.

```typescript
// artifacts/api-server/src/engines/ai/AIEngineBase.ts
abstract class AIEngineBase extends EngineBase {
  protected model: ort.InferenceSession | tf.LayersModel | null = null;
  protected shadowMode: boolean = true;

  abstract predict(input: unknown): Promise<AIDecision>;
  abstract extractFeatures(raw: unknown): Float32Array | Record<string, number>;

  protected async makeDecision(input: unknown): Promise<AIDecision | null> {
    const decision = await this.predict(input);
    if (this.shadowMode) {
      await this.logShadowPrediction(decision);
      return null; // do not act
    }
    await this.logActivePrediction(decision);
    return decision;
  }
}

interface AIDecision {
  action: string;
  target_id: string;
  confidence: number;      // 0–1
  reason: string;          // human-readable, mandatory
  predicted_at: string;    // ISO 8601
  model_version: string;
}
```

#### 4.1.2 `ai_models` Table (Cloud PG)

Versioned model registry. The Go backend serves models to gateways on boot and on update.

```sql
CREATE TABLE ai_models (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical       TEXT NOT NULL,         -- 'digital_twin' | 'automation' | 'mesh' | 'firmware' | 'cv'
  version        TEXT NOT NULL,         -- semver e.g. '1.0.0'
  format         TEXT NOT NULL,         -- 'onnx' | 'tfjs' | 'rule_graph'
  storage_url    TEXT NOT NULL,         -- path to model artifact in object storage
  checksum_sha256 TEXT NOT NULL,
  target_node    TEXT NOT NULL,         -- 'gateway' | 'phone'
  promoted_at    TIMESTAMPTZ,
  deprecated_at  TIMESTAMPTZ,
  metadata       JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.1.3 `ai_shadow_predictions` Table (Cloud PG)

Stores all shadow-mode predictions for offline evaluation before promotion.

```sql
CREATE TABLE ai_shadow_predictions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id        UUID NOT NULL,
  vertical       TEXT NOT NULL,
  model_version  TEXT NOT NULL,
  predicted_action TEXT NOT NULL,
  target_id      TEXT,
  confidence     NUMERIC(4,3),
  reason         TEXT,
  actual_outcome TEXT,          -- populated by reconciliation job
  outcome_at     TIMESTAMPTZ,
  predicted_at   TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.1.4 Model Delivery via OTA

AI models are packaged as firmware artifacts with `type: "ai_model"` and delivered through the existing firmware upload pipeline. A new `firmware_engine` handler recognises this type, writes the model file to `~/.luma/models/{vertical}/`, and signals the relevant AI engine to hot-reload.

```
Cloud storage → /cloud/firmware (Go) → firmware_engine (Node) → disk → AI engine reload
```

This reuses all existing staged rollout, risk scoring, and rollback infrastructure — AI model updates go through the same safety gates as device firmware.

### 4.2 API Gateway Routes (new in Phase 1)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ai/status` | Shadow/active mode + model version per vertical |
| `POST` | `/api/ai/{vertical}/predict` | Manual prediction trigger (for testing) |
| `GET` | `/api/ai/shadow` | Recent shadow predictions (last 100) |
| `POST` | `/api/ai/{vertical}/feedback` | User accepts/rejects a prediction |
| `GET` | `/api/twin/:id/state` | Current virtual state of a device |
| `POST` | `/api/twin/:id/simulate` | Run what-if scenario |
| `GET` | `/api/mesh/topology` | Live mesh graph with link quality |

---

## 5. The Five AI Verticals

### 5.1 Vertical 1 — Digital Twin Simulation

**Purpose:** Maintain a virtual model of each device's internal state, allowing the system to simulate "what happens if…" scenarios before issuing real commands.

#### 5.1.1 Architecture

A new `digital_twin_engine` runs in the API server alongside existing engines. It maintains an in-memory registry of `DeviceTwin` objects, one per registered device. Each twin mirrors the real device state via MQTT and exposes a simulation interface.

> **Note:** `digital_twin_engine` extends `EngineBase` directly, **not** `AIEngineBase`. It is an interactive simulation tool — it responds to explicit requests rather than making autonomous decisions — so the `AIDecision` pattern does not apply. It does not participate in shadow mode; instead it is always available as a read-only simulation layer from Phase 1 onward.

```
MQTT state updates → digital_twin_engine → DeviceTwin.update(state)
                                          ↓
mobile app / other engines → /api/twin/:id/simulate → DeviceTwin.runScenario(delta)
                                          ↓
                              SimulationResult { projected_state, risk_flags, warnings }
```

#### 5.1.2 Twin Model Structure

Phase 1 uses a **physics-informed rule graph**: a directed graph of state variables with typed edges expressing causal relationships (e.g., "voltage drop → increased temperature → thermal protection trigger"). Rules are defined per device category (`lamp`, `microcontroller`, `sensor`, etc.) and seeded from device spec metadata already in `engine_devices.config`.

Phase 2 upgrades to a **learned transition model**: an LSTM trained on `device_telemetry` predicts the next-state distribution given current state + proposed action. The rule graph becomes the fallback when telemetry is insufficient.

#### 5.1.3 DeviceTwin Interface

```typescript
interface DeviceTwin {
  deviceId: string;
  deviceType: string;
  currentState: DeviceState;
  lastSyncedAt: Date;

  // Apply a real state update from MQTT
  update(state: Partial<DeviceState>): void;

  // Run a hypothetical scenario without touching the real device
  runScenario(delta: Partial<DeviceState>): SimulationResult;

  // Serialize twin for API response
  toSnapshot(): TwinSnapshot;
}

interface SimulationResult {
  projected_state: DeviceState;
  risk_flags: RiskFlag[];      // e.g. { flag: 'thermal_limit', severity: 'warning' }
  warnings: string[];
  confidence: number;
  simulated_at: string;
}
```

#### 5.1.4 Mobile Integration

The Devices screen gains a **"Simulate" CTA** on each device card (Phase 1). Tapping opens a simulation panel where the user adjusts sliders for controllable variables (brightness, duty cycle, target temperature) and sees projected outcomes rendered in plain language before committing.

#### 5.1.5 Shadow Mode Metrics

| Metric | Promotion threshold |
|---|---|
| Twin-to-real state divergence | < 5% mean absolute error on held-out telemetry |
| Simulation round-trip latency | < 100 ms p95 |
| Rule graph coverage | ≥ 80% of device commands produce a non-null simulation result |

---

### 5.2 Vertical 2 — Predictive Automation

**Purpose:** Learn user behavior patterns from device usage history and automation rule logs. Proactively suggest new rules; auto-execute high-confidence patterns with user consent.

#### 5.2.1 Architecture

A new `automation_ai_engine` runs on the gateway. It consumes two data streams:

1. **Historical rule triggers** from `analytics_events` (`automation.rule_triggered`)
2. **Device state change sequences** from `device_telemetry`

It runs a pattern miner at a configurable cadence (default: nightly, 02:00 local time) and maintains a ranked list of `AutomationSuggestion` objects, persisted to `engine_devices` JSON config (lightweight, no new table needed in Phase 1).

```
analytics_events + device_telemetry
         ↓
  PatternMiner (N-gram Phase 1 / LSTM Phase 2)
         ↓
  AutomationSuggestion[]  →  /api/ai/automation/suggestions (REST)
                          →  mobile Automation tab (push via SSE)
```

#### 5.2.2 Pattern Miner (Phase 1)

Phase 1 uses a **temporal N-gram model**: sliding windows (1 hour, 4 hour, 24 hour) over device event sequences. Sequences that repeat with ≥ 70% frequency across ≥ 5 occurrences are promoted to suggestion candidates.

```typescript
interface AutomationSuggestion {
  id: string;
  trigger: { type: string; device_id?: string; time_of_day?: string; scene?: string };
  action: { type: string; device_id: string; params: Record<string, unknown> };
  confidence: number;
  occurrence_count: number;
  reason: string;          // e.g. "You turn off the hall light after locking the front door 91% of the time"
  suggested_at: string;
  status: "pending" | "accepted" | "rejected" | "auto_executed";
}
```

#### 5.2.3 Execution Modes

| Mode | Condition | Behavior |
|---|---|---|
| **Suggest** | Confidence < 0.85 | Push notification + in-app card. User taps to add rule. |
| **Suggest with countdown** | 0.85 ≤ confidence < 0.95 | Show card with 30-second cancel window before auto-applying. |
| **Auto-execute** | Confidence ≥ 0.95, user has opted in | Execute silently; log to activity feed with `reason`. |

Auto-execute requires explicit user opt-in in Settings (default: off). Opt-in is per-home, not global.

#### 5.2.4 Mobile Integration

The Automation tab gains an **"AI Suggestions"** section at the top (Phase 1). Each card shows the suggested rule, the reason string, and Accept/Dismiss actions. Accepted suggestions are written to `automation_rules` as normal rules with `source: "ai"` metadata. Dismissed suggestions decrement the suggestion's training weight.

#### 5.2.5 Shadow Mode Metrics

| Metric | Promotion threshold |
|---|---|
| Suggestion acceptance rate | ≥ 40% of suggestions accepted by users in beta cohort |
| False positive rate | ≤ 20% (user rejects suggestion within 24 hours of it triggering) |
| Pattern mining latency | < 30 seconds on 90-day window of telemetry |

---

### 5.3 Vertical 3 — Mesh Network Intelligence

**Purpose:** Monitor link quality across the device mesh, detect degraded paths, and automatically propose or execute rerouting to maintain reliable connectivity.

#### 5.3.1 Architecture

The existing `mqtt_engine` already processes all device messages. A new `mesh_ai_engine` subscribes to the engine bus and ingests a `signal_quality` field that will be added to each MQTT message payload (Phase 0 telemetry requirement).

The engine maintains a **live weighted graph** (`MeshGraph`) in memory, with edges representing device-to-gateway and device-to-device communication links, weighted by rolling RSSI and packet loss rate.

```
mqtt_engine → MeshGraph.updateEdge(source, target, quality)
                      ↓
            MeshGraph.detectDegradedPaths()   (runs every 30 s)
                      ↓
  degraded path → PathHealingPlanner.plan(graph, degradedEdge)
                      ↓
  HealingAction { type: 'reroute' | 'reconnect' | 'alert', reason }
                      ↓
  shadow: log only  |  active: emit to wifi_engine + notify mobile
```

#### 5.3.2 MeshGraph Data Model

```typescript
interface MeshNode {
  deviceId: string;
  type: "gateway" | "device";
  lastSeen: Date;
}

interface MeshEdge {
  source: string;
  target: string;
  rssi_dbm: number;          // rolling 5-sample average
  packet_loss_pct: number;
  latency_ms: number;
  quality_score: number;     // computed: 0–1 composite
  updated_at: Date;
}

interface HealingAction {
  type: "reroute" | "reconnect" | "alert_only";
  affected_device_id: string;
  proposed_relay_id?: string;  // for reroute
  reason: string;
  confidence: number;
}
```

#### 5.3.3 Path Healing Algorithm (Phase 1)

Phase 1 uses a **greedy Dijkstra reroute**: when a link drops below `quality_score < 0.4` for three consecutive samples, the engine computes the next-best path to the gateway using current graph weights and emits a `reroute` action to `wifi_engine`. `wifi_engine` translates this to a provisioning update for the affected device.

Phase 2 adds a **predictive degradation model**: an LSTM trained on historical RSSI patterns predicts link quality 5 minutes ahead. Pre-emptive rerouting before a link fails, not after.

#### 5.3.4 Mobile Integration

The existing **Connectivity screen** is extended with:
- Live mesh topology visualization (D3-style force graph, edge thickness = link quality)
- Degraded links highlighted in amber; failed links in red
- AI healing actions shown as an activity feed ("Mesh rerouted device X through Y · reason · 2 min ago")
- Manual override: user can force a reconnect or lock a routing path

#### 5.3.5 Shadow Mode Metrics

| Metric | Promotion threshold |
|---|---|
| True positive rate (detected real link degradation) | ≥ 80% |
| False alarm rate | ≤ 5% per 24 h per home |
| Reroute success rate (device back online after action) | ≥ 70% |

---

### 5.4 Vertical 4 — AI-Assisted Firmware Rollout

**Purpose:** Score the risk of a firmware update before it executes, gate high-risk jobs to staged rollout, and automatically roll back updates that degrade device health post-flash.

#### 5.4.1 Architecture

The risk scorer integrates into the existing firmware pipeline as a **pre-execution interceptor** inside `firmware_engine`. Before any OTA or USB flash job transitions from `pending` to `in_progress`, the interceptor calls `FirmwareRiskScorer.score(job)` and writes the result to `engine_firmware_jobs`.

```
POST /api/firmware/update
         ↓
firmware_engine creates job (status: "pending")
         ↓
FirmwareRiskScorer.score(job)   → risk_score: number (0–1)
                                → risk_factors: RiskFactor[]
                                → rollout_strategy: "immediate" | "canary" | "staged" | "blocked"
         ↓
job updated with risk_score + strategy
         ↓
  strategy = "immediate"  → execute now
  strategy = "canary"     → flash 1 device, 30-min soak, then continue
  strategy = "staged"     → canary → 10% → 50% → 100% with soak periods
  strategy = "blocked"    → require manual approval via cloud admin endpoint
```

#### 5.4.2 Risk Scorer Model

Phase 1 uses a **gradient-boosted decision tree** (XGBoost, ONNX-exported) with the following features:

| Feature | Source |
|---|---|
| Device uptime hours since last reboot | `device_telemetry` |
| Error flag frequency (7-day window) | `device_telemetry` |
| Firmware delta size (bytes) | firmware artifact metadata |
| Target firmware version distance | semver delta |
| Device type + hardware revision | `engine_devices.config` |
| Historical flash success rate for this device | `engine_firmware_jobs` |
| Number of devices in same batch | firmware job metadata |
| Time of day (local) | runtime |

Output: `risk_score` (0–1), `risk_factors` (top 3 contributing features with direction), `rollout_strategy`.

#### 5.4.3 Post-Flash Health Monitor

After a firmware flash completes, `firmware_engine` starts a **30-minute monitoring window** for the affected device(s). It samples device state from MQTT and compares error flag frequency and telemetry distributions against the pre-flash baseline (stored in `engine_firmware_jobs.pre_flash_snapshot`).

```typescript
interface PostFlashMonitor {
  job_id: string;
  devices: string[];
  monitor_until: Date;            // now + 30 min (configurable)
  baseline_snapshot: TelemetryStats;
  rollback_threshold: {
    error_rate_increase_pct: number;  // default: 50
    telemetry_anomaly_score: number;  // default: 0.7
  };
}
```

If thresholds are breached: automatic rollback to the previous firmware version (stored in `firmware_releases`), analytics event emitted, user notified in mobile app.

#### 5.4.4 Schema Additions to `engine_firmware_jobs`

```sql
ALTER TABLE engine_firmware_jobs ADD COLUMN IF NOT EXISTS
  risk_score          NUMERIC(4,3),
  risk_factors        JSONB,
  rollout_strategy    TEXT,
  pre_flash_snapshot  JSONB,
  post_flash_health   JSONB,
  auto_rolled_back    BOOLEAN DEFAULT FALSE,
  rollback_reason     TEXT;
```

#### 5.4.5 Mobile Integration

The Firmware screen gains:
- **Risk badge** on each pending update: green (< 0.3), amber (0.3–0.7), red (> 0.7)
- **Risk factor breakdown** on tap: plain-language explanation of the top 3 factors
- **Rollout progress bar** for staged jobs
- **Rollback notification card** if auto-rollback fires

#### 5.4.6 Shadow Mode Metrics

| Metric | Promotion threshold |
|---|---|
| Risk score correlation with actual flash failure | Pearson r ≥ 0.6 on shadow dataset |
| Staged rollout catch rate (failures caught before 100% deploy) | ≥ 60% |
| False block rate (blocked jobs that would have succeeded) | ≤ 10% |

---

### 5.5 Vertical 5 — Computer Vision

**Purpose:** Use the phone camera to detect room occupancy and activity scenes, feeding CV-derived triggers into the automation engine to enable presence-aware home control without explicit scheduling.

#### 5.5.1 Architecture

CV inference runs entirely on the phone. A new **`CVEngine`** in the Expo mobile app loads a TensorFlow.js MobileNetV3-Small model (< 5 MB, bundled with the app binary) and processes camera frames in a background task.

```
Phone camera (background / periodic capture)
         ↓
CVEngine.captureFrame()   → JPEG frame (240×320)
         ↓
MobileNetV3.classify(frame)
         ↓
SceneClassifier.interpret(logits)
         → { scene: "occupied" | "empty" | "sleeping" | "active", confidence, room_id }
         ↓
  confidence ≥ threshold → publish to MQTT: luma/cv/{room_id}/scene
         ↓
API server mqtt_engine receives → routes to automation_ai_engine
         ↓
AutomationEngine evaluates cv_scene_change triggers in automation_rules
```

#### 5.5.2 Scene Classifications

| Scene label | Description | Example automation trigger |
|---|---|---|
| `occupied_active` | Movement detected, activity in frame | Turn on full lights |
| `occupied_idle` | Person present, no significant movement | Dim lights, lower temperature |
| `occupied_sleeping` | Low light, prone posture detected | Enable do-not-disturb mode |
| `empty` | No person detected for N consecutive frames | Turn off lights, arm security |

Phase 1 ships the first four labels. Phase 2 adds `occupied_guest` (unfamiliar face) and `occupied_multiple` (group detection) via a fine-tuned classifier.

#### 5.5.3 Privacy Model

CV processing is **fully local and ephemeral**. Strict constraints:

- Camera frames are **never stored** to disk, database, or transmitted over the network
- Only the classified scene label + confidence score is published to MQTT
- MQTT payload contains no image data: `{ scene, confidence, room_id, timestamp }`
- The initial model weights are **bundled in the app binary** at first install — no cloud call is made to load them. Subsequent model improvements are delivered as `ai_model` OTA packages through the firmware pipeline (§4.1.4), which writes updated weights to the phone's local storage and signals `CVEngine` to hot-reload. The bundled weights act as the permanent fallback if an OTA update is unavailable.
- CV engine requires explicit user permission grant in app Settings (separate from standard camera permission)
- User can disable CV per-room or globally from Settings

These constraints are enforced at the `CVEngine` API boundary. Any future modification that would transmit image data requires a new permission prompt and privacy policy update.

#### 5.5.4 Power Management

CV inference on a continuous camera feed is power-intensive. The engine uses **adaptive sampling**:

| Condition | Sampling rate |
|---|---|
| Charging | Every 5 seconds |
| Battery > 50% | Every 15 seconds |
| Battery 20–50% | Every 60 seconds |
| Battery < 20% | CV engine paused; last scene state held |

The user can override sampling rate in Settings. When CV is paused due to battery, the last known scene is held and automation rules continue to use it (stale data is preferable to no data for most automations).

#### 5.5.5 MQTT Topic Schema (new)

```
Topic:    luma/cv/{room_id}/scene
Payload:  { "scene": "occupied_active", "confidence": 0.92, "room_id": "living_room", "ts": "2026-07-19T07:30:00Z" }
QoS:      1 (at-least-once delivery)
Retain:   true  (last known scene persists for new subscribers)
```

#### 5.5.6 Shadow Mode Metrics

| Metric | Promotion threshold |
|---|---|
| `empty` precision | ≥ 90% (false empties trigger unnecessary automation) |
| `occupied_*` recall | ≥ 80% |
| Inference latency (p95) | < 200 ms on a mid-range phone |
| Battery impact | < 3% drain per hour above baseline |

---

## 6. Phase 2 — Production Closed Loop

**Goal:** AI verticals operating in active mode for opted-in users. Automated retraining pipeline, drift monitoring, and user-facing explainability.

### 6.1 Model Monitoring

A new `model_metrics` table tracks per-vertical inference quality over rolling windows:

```sql
CREATE TABLE model_metrics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical       TEXT NOT NULL,
  home_id        UUID NOT NULL,
  model_version  TEXT NOT NULL,
  window_start   TIMESTAMPTZ NOT NULL,
  window_end     TIMESTAMPTZ NOT NULL,
  total_predictions INTEGER,
  accepted_count    INTEGER,
  rejected_count    INTEGER,
  auto_executed_count INTEGER,
  rollback_count    INTEGER,
  mean_confidence   NUMERIC(4,3),
  precision_estimate NUMERIC(4,3),
  drift_score       NUMERIC(4,3),  -- KL divergence vs. training distribution
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drift_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical      TEXT NOT NULL,
  home_id       UUID NOT NULL,
  alert_type    TEXT NOT NULL,    -- 'concept_drift' | 'data_drift' | 'performance_drop'
  severity      TEXT NOT NULL,    -- 'warning' | 'critical'
  details       JSONB,
  triggered_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);
```

### 6.2 Automated Retraining Pipeline

The Go cloud backend runs a nightly retraining job (cron, configurable) that:

1. Pulls `ai_shadow_predictions` with `actual_outcome` populated (reconciled by a separate async job)
2. Merges with fresh `device_telemetry` and `analytics_events` from the past 30 days
3. Triggers a training job via a pluggable training backend (initially: a Python FastAPI microservice; Phase 2 may use Vertex AI custom training)
4. Packages the output weights as an ONNX/TFJS artifact and creates a new `ai_models` record
5. Deploys to shadow mode automatically; promotes to active after metric thresholds met (same gate as Phase 1, automated)

### 6.3 Explainability Layer — Mobile UI

Phase 2 adds an **AI Activity Log** screen accessible from the main navigation. It shows a chronological feed of every AI decision (shadow or active) with:

- Vertical name and icon
- Action taken or suggested
- Reason string
- Confidence score
- Outcome (accepted / rejected / auto-executed / rolled back)
- "Why did this happen?" expandable detail (top 3 contributing features, in plain language)

This screen is the primary transparency interface and is key to building user trust in the active-mode AI verticals.

### 6.4 Model Versioning and Rollback

The `/cloud/ai/models` endpoint supports:

| Endpoint | Description |
|---|---|
| `GET /cloud/ai/models` | List all versions per vertical, with metrics |
| `POST /cloud/ai/models/{id}/promote` | Promote shadow → active (manual or automated) |
| `POST /cloud/ai/models/{id}/demote` | Demote active → shadow |
| `POST /cloud/ai/models/{id}/rollback` | Roll back to previous active version |
| `DELETE /cloud/ai/models/{id}` | Deprecate a version (must not be active) |

Model rollback follows the same contract as firmware rollback: the previous active version is retained until a newer version has been active for ≥ 7 days without critical alerts.

### 6.5 Phase 2 Exit Criteria

| Criterion | Target |
|---|---|
| All 5 verticals in active mode for ≥ 50 opted-in homes | ✓ |
| Zero P0 AI incidents (hallucinated actions on critical devices) | ✓ |
| Retraining pipeline running on 30-day cadence | ✓ |
| AI Activity Log shipped in mobile app | ✓ |
| Drift monitoring alerting < 48 h of detection | ✓ |

---

## 7. Cross-Cutting Concerns

### 7.1 Security

- **Model integrity**: All model artifacts are signed with a SHA-256 checksum stored in `ai_models.checksum_sha256`. The gateway verifies the checksum before loading any model file. A checksum mismatch blocks loading and emits a `security.model_tamper_detected` analytics event.
- **Inference isolation**: AI engines run as workers (Node.js `worker_threads`) isolated from the main process. A crashing model worker does not take down the API server; the engine falls back to shadow mode.
- **CV privacy boundary**: CVEngine enforces a hard API contract that no image data leaves the device. This is reviewed at every CVEngine PR merge.
- **Audit trail**: Every AI-originated actuation is logged to `analytics_events` with `source: "ai"` and `model_version`. This log is append-only and cannot be deleted by normal app flows.

### 7.2 Graceful Degradation

| Failure | Behavior |
|---|---|
| Model file missing or corrupt | Engine starts in shadow mode with a no-op predictor; alerts `model_load_failed` |
| Inference timeout (> 500 ms) | Decision skipped; counter incremented; auto-demote if 10 consecutive timeouts |
| `analytics_events` table unavailable | Pattern miner skips the run; logs warning; does not crash |
| CV engine battery paused | Last scene state held; automation rules continue with stale data |
| Cloud unreachable | All 5 verticals continue at edge; model updates queued until reconnection |

### 7.3 Testing Strategy

| Layer | Approach |
|---|---|
| Unit | Each `AIEngineBase` subclass has deterministic test fixtures for `extractFeatures()` and `predict()` |
| Integration | Shadow mode end-to-end: inject synthetic telemetry → verify `ai_shadow_predictions` populated correctly |
| Model quality | Offline evaluation on holdout split before any model version enters shadow mode |
| Rollback | Chaos test: inject post-flash anomaly spike → verify `PostFlashMonitor` triggers rollback within 5 min |
| Privacy (CV) | Static analysis check that no frame buffer is passed to any network or storage API |

---

## 8. Dependency Map and Build Order

The following order minimizes blocking dependencies across phases:

```
Phase 0 (parallel):
  ├── P0-A: analytics_events emission from all API server engines
  └── P0-B: device_telemetry table + MQTT ingestion pipeline

Phase 1 (sequential within vertical, verticals in parallel):
  ├── Infra first:  AIEngineBase · ai_models table · model delivery via OTA
  ├── Vertical 4:   Firmware risk scorer (lowest data dependency — uses job history)
  ├── Vertical 3:   Mesh intelligence (depends on P0-B signal_quality field)
  ├── Vertical 2:   Predictive automation (depends on P0-A rule trigger events)
  ├── Vertical 1:   Digital twin (depends on P0-B telemetry volume for learned model)
  └── Vertical 5:   CV engine (phone-only, parallel with all gateway verticals)

Phase 2 (sequential):
  ├── Model metrics + drift monitoring
  ├── Retraining pipeline
  ├── AI Activity Log (mobile)
  └── Automated promotion pipeline
```

---

## 9. Open Questions

These items are explicitly deferred to implementation planning:

1. **Training backend choice**: Python FastAPI microservice vs. managed service (Vertex AI, AWS SageMaker). The spec is agnostic; the training backend is pluggable behind a `POST /train` interface.
2. **ONNX Runtime vs. TensorFlow.js for gateway**: Both are specified as options. Decision should be made once Phase 1 model prototypes are profiled for latency and memory on representative gateway hardware.
3. **Multi-home federation**: This spec covers single-home AI. Cross-home federated learning (train models on aggregated anonymized data without centralizing raw telemetry) is out of scope for Phase 2 but architecturally enabled by the `home_id` column present throughout.
4. **Room assignment for CV**: Phase 1 assumes a single `room_id` per phone. Multi-room support (user assigns phone to room, or uses multiple phones) is a UX question deferred to implementation.
5. **Automation confidence thresholds**: The values in §5.2.3 (0.85, 0.95) are initial defaults. They should be validated against the shadow dataset before Phase 1 goes live and will likely require per-home calibration in Phase 2.

---

_End of specification._
_Next step: implementation plan covering Phase 0 deliverables and Phase 1 infra bootstrapping._
