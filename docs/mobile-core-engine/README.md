# LUMA Mobile Core Engine — Architecture Knowledge Base

This directory is the engineering specification for LUMA's **modular extension
architecture**. It defines how the Smart Home Core Engine — the primary
runtime of the entire application — is decomposed into independent,
pluggable engines that can be built, tested, enabled, and disabled without
touching the rest of the app.

## The split: mobile is the application, the backend is a cloud service

LUMA is not "a mobile app that talks to a server." The **mobile application
is the primary runtime environment** — it owns device communication,
discovery, automation, security, and every other capability a user actually
depends on, and it must keep working when the backend is completely
unreachable (airplane mode, backend outage, no home Wi-Fi/Internet).

The **backend server (`artifacts/api-server`) is not the application's core
logic.** It exists purely to provide centralized *cloud services* that only
make sense off-device:

| Backend responsibility | Explicitly NOT the backend's job |
|---|---|
| Cloud MQTT broker (`mqtt.luma.local` today; a real managed broker later) | Device control logic — that lives in the mobile Core Engine |
| User authentication / account identity | Local device discovery (mDNS/UDP/Bluetooth) |
| Device registration database (source of truth across a user's phones) | Automation rule evaluation |
| Firmware repository (binary hosting, changelog, signing) | Command signing / device-key custody |
| Push notification dispatch | Offline queueing (each device keeps its own) |
| Remote sync / cloud backup | Permission enforcement (evaluated on-device before any command leaves the phone) |
| Remote monitoring, analytics, audit logs | Scene/schedule execution |
| API gateway (`/api/engines/*`) for cross-device/cross-phone state | — |

If a feature needs the phone to *do something to a device*, it belongs in a
mobile Core Engine extension. If a feature needs a durable, phone-independent
system of record or something that only makes sense centralized (billing,
push delivery, account recovery), it belongs in the backend.

## The Mobile Core Engine

The Core Engine is the always-on runtime inside the Expo app
(`artifacts/luma-smart-home`) that every extension plugs into. It owns:

- Application lifecycle (mount → engines start → ready → engines stop → unmount)
- The **Internal API Gateway** (`engines/internal-api/gateway.ts`) — the only
  channel through which engines communicate. No engine ever imports another
  engine's internals directly; everything is `EngineId` → `EngineId` messages.
- Service registry, dependency injection, and extension loading
- Background execution and resource cleanup

Every capability in the list below **must** be implementable as an
independent extension registered against this gateway — enabling or
disabling one must never break another.

## Engines documented here

| # | Engine | File | Status in current codebase |
|---|---|---|---|
| 1 | Core Engine | [CoreEngine.md](CoreEngine.md) | Partially implemented (`engines/index.ts`, `internal-api/`) |
| 2 | Extension Engine | [ExtensionEngine.md](ExtensionEngine.md) | Design spec — not yet implemented |
| 3 | MQTT Communication Engine | [MQTTCommunicationEngine.md](MQTTCommunicationEngine.md) | Implemented (`src/modules/mqtt/*`, `engines/mqtt-client-engine.ts`) |
| 4 | Bluetooth Engine | [BluetoothEngine.md](BluetoothEngine.md) | Implemented as simulation (`engines/p2p-engine.ts`) |
| 5 | Device Discovery Engine | [DiscoveryEngine.md](DiscoveryEngine.md) | Implemented as simulation (`engines/wifi-engine.ts`, `MQTTDiscovery.ts`) |
| 6 | Device Management Engine | [DeviceManagementEngine.md](DeviceManagementEngine.md) | Partially implemented (`engines/device-engine.ts`, `LumaContext.tsx`) |
| 7 | Security Engine | [SecurityEngine.md](SecurityEngine.md) | Implemented, scoped to MQTT (`MQTTSecurity.ts`) — spec generalizes it |
| 8 | Permission Engine | [PermissionEngine.md](PermissionEngine.md) | Implemented, scoped to MQTT (`MQTTPermissions.ts`) + UI (`LumaContext.tsx`) |
| 9 | Synchronization Engine | [SynchronizationEngine.md](SynchronizationEngine.md) | Implemented, scoped to MQTT (`MQTTSync.ts`, `MQTTQueue.ts`) |
| 10 | Automation Engine | [AutomationEngine.md](AutomationEngine.md) | Implemented as UI-layer state (`LumaContext.tsx`) — spec extracts it into an engine |
| 11 | Firmware Engine | [FirmwareEngine.md](FirmwareEngine.md) | Implemented (`firmware-engine.ts`, `firmware-upload-engine.ts`, `usb-engine.ts`) |
| 12 | Dashboard Engine | [DashboardEngine.md](DashboardEngine.md) | Design spec — currently ad hoc screen-level aggregation |
| 13 | Notification Engine | [NotificationEngine.md](NotificationEngine.md) | Implemented as UI-layer state (`LumaContext.tsx`) — spec extracts it into an engine |
| 14 | Local Database Engine | [DatabaseEngine.md](DatabaseEngine.md) | Implemented as AsyncStorage (`MQTTStorage.ts`) — spec generalizes + plans SQLite |
| 15 | Event Engine | [EventEngine.md](EventEngine.md) | Implemented, two parallel buses (`internal-api/message-bus.ts`, `MQTTEvents.ts`) — spec unifies them |

## How to read these documents

Each engine document is a **specification, not a changelog**. It describes
what the engine is responsible for, its public contract, and how it plugs
into the Core Engine as an extension — regardless of whether that code
exists yet in this exact shape. Where the engine (or a close ancestor of it)
already exists in the codebase, the document says so explicitly and treats
the current implementation as the reference baseline to refactor into the
extension shape. Where it doesn't exist yet, the document is the blueprint
to build it from.

Conventions used throughout:

- **Engine IDs** are `snake_case` and unique across the whole gateway (see
  each engine's `Extension Registration Process` section).
- **Events** are `SCREAMING_SNAKE_CASE` strings, matching the existing
  `MQTT_EVENT` / gateway `MessageType` conventions.
- All timestamps are Unix epoch milliseconds unless noted otherwise.
- "Honesty" callouts (marked ⚠️) flag places where the current
  implementation simulates real hardware/radio access rather than using it,
  consistent with this project's existing convention of never silently
  pretending simulated behavior is real.
