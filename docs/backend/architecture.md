# Backend Architecture

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 24 |
| Language | TypeScript | 5.9 |
| HTTP Framework | Express | 5 |
| Database ORM | Drizzle ORM | catalog |
| Database | PostgreSQL | 16 |
| Validation | Zod v4 | catalog |
| API Codegen | Orval (from OpenAPI 3.1) | 8.x |
| Logging | Pino + pino-pretty | 9.x |
| Build | esbuild | 0.27 |
| Package Manager | pnpm workspaces | 10 |

---

## Monorepo Layout

```
workspace/
├── artifacts/
│   ├── api-server/          ← Express backend (this document's focus)
│   │   └── src/
│   │       ├── app.ts           Entry point: mounts middleware, engines, router
│   │       ├── index.ts         Binds to PORT, starts listening
│   │       ├── engines/         All 6 core engines
│   │       │   ├── base-engine.ts
│   │       │   ├── firmware/
│   │       │   ├── device/
│   │       │   ├── mqtt/
│   │       │   ├── wifi/
│   │       │   ├── usb/
│   │       │   └── firmware-upload/
│   │       ├── internal-api/    Gateway, message bus, types
│   │       │   ├── gateway.ts
│   │       │   ├── message-bus.ts
│   │       │   └── types.ts
│   │       ├── routes/
│   │       │   ├── health.ts    GET /api/healthz
│   │       │   └── engines.ts   All /api/engines/* routes
│   │       └── lib/
│   │           └── logger.ts    Pino logger singleton
│   │
│   └── luma-smart-home/     ← Expo React Native mobile app
│
└── lib/
    ├── api-spec/            ← OpenAPI 3.1 spec (source of truth for contracts)
    │   └── openapi.yaml
    ├── api-client-react/    ← Generated: React Query hooks (via Orval)
    ├── api-zod/             ← Generated: Zod schemas (via Orval)
    └── db/                  ← Drizzle ORM pool + schema
        └── src/
            ├── index.ts     Exports: pool, db, schema types
            └── schema/
                └── index.ts Add table definitions here
```

---

## Request Lifecycle

```
HTTP Request
     │
     ▼
Express (app.ts)
     │   pino-http middleware (logs method, url, status, responseTime)
     │   cors middleware
     │   json body parser
     ▼
Router (/api/*)
     │
     ├── /healthz       → health.ts
     └── /engines/*     → engines.ts
               │
               ▼
         InternalAPIGateway
               │
               ▼
         MessageBus (EventEmitter)
               │
     ┌─────────┴──────────┐
     ▼                    ▼
Target Engine         Broadcast
(e.g. mqtt_engine)  (all engines)
     │
     ▼
Engine handler → may send further messages to other engines
```

---

## Engine Bootstrap

Engines start in `app.ts` at import time:

```typescript
// app.ts
import { startAllEngines, stopAllEngines } from "./engines";

// ...middleware setup...

app.use("/api", router);

startAllEngines();  // registers all 6 engines with the gateway

process.on("SIGTERM", () => stopAllEngines());
process.on("SIGINT",  () => stopAllEngines());
```

Startup order (matters — lower engines may receive messages from higher ones):
1. `firmware_engine`
2. `device_engine`
3. `wifi_engine`
4. `mqtt_engine`
5. `usb_engine`
6. `firmware_upload_engine`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | ✅ | — | HTTP port (8080 in dev) |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `NODE_ENV` | — | `development` | `production` disables pino-pretty |
| `LOG_LEVEL` | — | `info` | Pino log level |
| `MQTT_HOST` | — | `mqtt.luma.local` | MQTT broker host |
| `MQTT_PORT` | — | `1883` | MQTT broker port |
| `MQTT_USER` | — | — | MQTT username |
| `MQTT_PASS` | — | — | MQTT password |

All secrets live in Replit's secret store. Never hardcode credentials.

---

## Build System

The API server uses **esbuild** (not `tsc`) to produce a CJS/ESM bundle:

```
src/index.ts  ──esbuild──▶  dist/index.mjs   (1.4 MB, includes all deps)
                         ▶  dist/pino-worker.mjs
                         ▶  dist/pino-pretty.mjs
                         ▶  dist/*.mjs.map   (source maps)
```

Build configuration lives in `artifacts/api-server/build.mjs`.
The dev workflow runs `build` then `start` on every change.

---

## Logging

All structured logging uses the shared `logger` singleton from `src/lib/logger.ts`.

```typescript
import { logger } from "../lib/logger";

logger.info({ engineId, port }, "Server listening");
logger.error({ err }, "Something went wrong");
logger.debug({ action, source }, "[MyEngine] received message");
logger.warn({ topic }, "[MQTT] queue full");
```

In development, logs render in colour via `pino-pretty`.
In production, logs are plain JSON (one object per line, machine-readable).

Log levels: `fatal` > `error` > `warn` > `info` > `debug` > `trace`
