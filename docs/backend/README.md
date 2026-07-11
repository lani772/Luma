# LUMA Smart Home — Backend Developer Reference

This folder contains all the documentation needed to build, extend, and maintain the LUMA backend.

## Contents

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Stack, monorepo layout, request lifecycle |
| [internal-api.md](./internal-api.md) | Internal API Gateway — the message backbone |
| [engines/overview.md](./engines/overview.md) | All 6 engines at a glance |
| [engines/firmware-engine.md](./engines/firmware-engine.md) | Firmware version management & OTA coordination |
| [engines/device-engine.md](./engines/device-engine.md) | Device registry, state, and commands |
| [engines/mqtt-engine.md](./engines/mqtt-engine.md) | MQTT broker integration |
| [engines/wifi-engine.md](./engines/wifi-engine.md) | WiFi scanning, discovery, hotspot |
| [engines/usb-engine.md](./engines/usb-engine.md) | USB serial, flash, debug |
| [engines/firmware-upload-engine.md](./engines/firmware-upload-engine.md) | OTA upload, USB flash, rollback |
| [rest-api.md](./rest-api.md) | Complete REST API reference |
| [database.md](./database.md) | PostgreSQL + Drizzle ORM patterns |
| [adding-engine.md](./adding-engine.md) | Step-by-step guide to add a new engine |

## Quick-start commands

```bash
# Install all workspace dependencies
pnpm install

# Start API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Typecheck all packages
pnpm run typecheck

# Regenerate API client + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to dev database
pnpm --filter @workspace/db run push
```

## Core rule

**No engine ever calls another engine directly.**
All inter-engine communication flows through the `InternalAPIGateway` singleton.
This is the single most important architectural constraint in the backend.
