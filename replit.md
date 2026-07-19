# LUMA Smart Home

A smart home management platform with a React Native/Expo mobile app and an Express API backend.

## Run & Operate

- **API Server** — workflow `API Server` runs `PORT=8080 pnpm --filter @workspace/api-server run dev` (port 8080)
- **Mobile App** — workflow `LUMA Smart Home` runs Expo on port 8000; scan the QR code in the workflow console with the Expo Go app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `DATABASE_URL` — runtime-managed by Replit (no manual setup needed)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Node.js API** (`artifacts/api-server/`): Express 5, port 8080
- **Go Cloud Backend** (`artifacts/luma-cloud-backend/`): Gin, port 8090, path prefix `/cloud`
- **Mobile** (`artifacts/luma-smart-home/`): React Native / Expo, port 20792
- **DB layer** (`lib/db/`): PostgreSQL (Drizzle ORM) + optional MongoDB dual-write
- Validation: Zod, `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/`)
- Build: esbuild (CJS bundle)

## Where things live

| Concern | Path |
|---|---|
| Engine device registry (PG) | `lib/db/src/schema/devices.ts` → table `engine_devices` |
| Firmware records (PG) | `lib/db/src/schema/firmware.ts` → tables `engine_firmware`, `engine_firmware_jobs` |
| MongoDB dual-write client | `lib/db/src/mongo.ts` |
| Dual-write repositories | `lib/db/src/repository/` |
| Device CRUD REST API | `artifacts/api-server/src/routes/devices.ts` |
| Firmware CRUD REST API | `artifacts/api-server/src/routes/firmware.ts` |
| Engine message bus | `artifacts/api-server/src/engines/` |
| Cloud backend schema | Go GORM models in `artifacts/luma-cloud-backend/internal/models/` |

> **Note:** The Go cloud backend owns the `devices` table (UUID primary keys, owner foreign keys). The Node.js engine layer uses separate `engine_devices` / `engine_firmware` / `engine_firmware_jobs` tables to avoid conflicts.

## Architecture decisions

- **MQTT communication engine** (`artifacts/luma-smart-home/src/modules/mqtt/`) — production-grade multi-connection MQTT manager (`MQTTManager`) with priority failover Cloud MQTT → Local MQTT → HTTP → Bluetooth mesh → offline queue. Built on the vendored `lib/react-native-mqtt-client` (Arduino's real native Kotlin/Swift MQTT library, `@arduino/react-native-mqtt-client`).
  - **This container cannot build or run the native transport.** Native modules only load inside a custom Expo dev client (`expo prebuild` + `eas build --profile development`, or a local Android Studio/Xcode build) — never inside Expo Go, and this environment has no Android SDK/macOS to build one. `MQTTService.ts` detects the native module at runtime (`NativeModules.MqttClient`) and falls back to bridging the existing simulated `engines/mqtt-client-engine.ts` when it's absent. The fallback is never silent — it fires `MQTT_EVENT.NATIVE_TRANSPORT_UNAVAILABLE`, surfaced as a visible banner in the dashboard's Communication Engine panel.
  - Discovery (`MQTTDiscovery.ts`) wraps the existing `mobileWiFiEngine`'s simulated mDNS/UDP discovery rather than reimplementing scanning; the Bluetooth channel delegates to the existing `mobileP2PEngine` mesh rather than a real BLE library (none is installed).
  - Security (`MQTTSecurity.ts`) issues JWT-*shaped* device tokens and signs commands with a keyed SHA-256 hash (`expo-crypto`) + nonce/timestamp replay protection — explicitly not RFC 2104 HMAC, since no HMAC primitive is available without heavier native crypto. Labeled as such in code comments to avoid overclaiming.
  - Wired into the app via `context/MQTTContext.tsx` (kept separate from `LumaContext` to avoid bloating it), mounted in `app/_layout.tsx`, surfaced via `CommsStatusPanel` on the dashboard and a live channel badge on `DeviceCard`.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Two separate device tables**: The Go cloud backend owns `devices` (UUID IDs); the Node.js engine layer owns `engine_devices` (string IDs like `ESP32_Lamp_01`). They serve different purposes — don't confuse them.
- **MongoDB dual-write is optional**: Set `MONGODB_URL` env var to enable it. Without it, the system runs PostgreSQL-only (logged as a warning, not an error).
- **Schema changes**: Use `psql "$DATABASE_URL"` to apply schema changes directly; `drizzle-kit push` requires a TTY and doesn't work in shell scripts.
- **Native MQTT transport**: Cannot run in Expo Go or this container — falls back to simulated engine automatically.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
