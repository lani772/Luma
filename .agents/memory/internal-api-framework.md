---
name: Internal API Communication Framework
description: Architecture and file layout for the 8-engine internal message bus powering LUMA Smart Home
---

# Internal API Framework

## Architecture
- All engines communicate **only** through `InternalAPIGateway` — never directly to each other.
- The gateway wraps a `MessageBus` (Node.js `EventEmitter` on server, custom pub/sub on mobile).
- Every message uses `InternalMessage` format: `{ id, source, destination, type, action, payload, timestamp, priority }`.
- Messages to unavailable engines go into an offline queue with retry + dead-letter fallback.

## Server-side (api-server)
- `src/internal-api/` — types, message-bus, gateway, index (exports)
- `src/engines/base-engine.ts` — abstract base; engines extend it
- Six engines: `firmware/`, `device/`, `wifi/`, `mqtt/`, `usb/`, `firmware-upload/`
- `src/engines/index.ts` — `startAllEngines()` / `stopAllEngines()`; called from `app.ts`
- REST surface: `src/routes/engines.ts` mounted at `/api/engines/*`

## Mobile-side (luma-smart-home)
- `engines/internal-api/` — same architecture but uses plain pub/sub (no EventEmitter)
- UUID generation: **inline implementation** (no `expo-crypto` — not in dependencies)
- Seven mobile engines: firmware, device, wifi, mqtt-client, p2p, firmware-upload, usb
- `engines/index.ts` — `startAllMobileEngines()` / `stopAllMobileEngines()`; idempotent (guards double-start)
- React hook: `engines/hooks/useEngines.ts` — starts on mount, stops on unmount

## Key REST endpoints
- `GET /api/engines` — list all registered engines + stats
- `GET /api/engines/:engineId` — discover single engine
- `POST /api/engines/:engineId/command` — send action to engine
- `POST /api/engines/message/publish` — raw message publish
- `GET /api/engines/queue/offline` — pending offline queue
- `GET /api/engines/queue/dead-letters` — dead-letter queue
- `GET /api/engines/devices/all` — device registry
- `POST /api/engines/devices/command` — device control (TURN_ON/OFF/TOGGLE etc.)
- `GET /api/engines/mqtt/status` — MQTT broker status
- `GET /api/engines/wifi/networks` — WiFi scan results
- `GET /api/engines/usb/devices` — USB device list
- `GET /api/engines/firmware/jobs` — firmware update jobs
- `GET /api/engines/firmware-upload/jobs` — upload job tracking

## OpenAPI spec
Updated at `lib/api-spec/openapi.yaml`; regenerated codegen via `pnpm --filter @workspace/api-spec run codegen`.

**Why:** Engines communicate only through the gateway so adding a new engine never requires changing existing engines — only registering with the gateway.
