# LUMA Cloud Backend

Go cloud backend for LUMA Smart Home. This is a **separate artifact** from
the existing Node/Express `api-server` — different product surface
(cloud sync/account services vs. the mobile app's embedded engines),
different runtime, own database schema.

The mobile app's embedded Core Engine keeps all local device-control logic
(LAN discovery, direct MQTT to in-home devices, offline operation). This
backend only handles things that inherently need a cloud: accounts, cross-
device sync, remote access, backups, firmware distribution, and analytics.
It never sits in the hot path of local device control.

## Status: Phase 1 (this build)

Implemented, tested end-to-end, and running:

- **Auth Engine** — register/login, JWT access tokens + opaque refresh
  tokens (rotated on use), per-phone session scoping, session
  listing/revocation, password reset, email verification (delivery is
  stubbed — see Phase 2 notes).
- **User Engine** — profile, preferences, phone/device-install management,
  "my devices" view.
- **Device Registration Engine** — register/list/update/remove devices,
  ownership + admin model, ownership transfer by email, per-device history.
- **MQTT Broker Adapter Engine** — per-device scoped MQTT credentials
  (never shares broker admin credentials), topic convention, health check.
  The adapter itself (`pkg/mqttadapter`) is a narrow interface with a real
  Paho implementation and a `NoopAdapter`; nothing else in the codebase
  imports the MQTT client library directly, so the broker can be swapped
  without touching engine code.
- Full Postgres schema for all 12 planned engines (see `migrations/`) —
  Phase 2 tables exist now so later engines don't need destructive schema
  changes, but only Phase 1 tables have Go models/services today.
- API Gateway skeleton: one Gin router, JWT auth + RBAC middleware,
  rate limiting, structured logging, panic recovery, CORS.

### Not yet built (Phase 2)

Firmware Repository, Notifications (FCM/APNs — will be mocked first),
Remote Sync, Cloud Backup, Analytics, Audit Log, Scene & Schedule engines.
Their tables exist in the schema; their Go code does not exist yet.

## Architecture

```
cmd/api/main.go         — composition root; all dependency wiring lives here
internal/config/        — env var loading, fails fast if required vars missing
internal/api/router.go  — Gin router assembly, mounts every engine's routes
internal/middleware/    — auth (JWT + session blacklist), RBAC, rate limit,
                           CORS, structured logging, panic recovery
internal/engines/       — one package per engine (auth, users, devices, mqtt),
                           each with dto.go / repository.go / service.go / handlers.go
internal/models/        — GORM models (schema truth is the SQL in migrations/,
                           never GORM AutoMigrate)
internal/storage/
  database/              — Postgres connection + golang-migrate runner
  cache/                 — Cache interface; Redis-backed and in-memory impls
internal/worker/        — background jobs (expired-token cleanup)
pkg/mqttadapter/        — MQTT broker adapter interface + Paho/Noop impls;
                           the ONLY package in the repo allowed to import
                           the MQTT client library
migrations/             — hand-written SQL migrations (source of truth for schema)
```

### Cross-engine coupling

Engines never import each other's concrete types across a cycle. Where one
engine needs data from another (e.g. Users needs "which devices does this
person own"), the dependency is a small interface defined by the *consumer*
(`DeviceOwnershipReader`, `UserLookup`, `TokenBlacklist`, `AuditRecorder`)
and satisfied by the producer, wired together in `main.go`. This keeps
Phase 2 engines pluggable later without refactoring Phase 1.

### Auth model

- Access tokens are short-lived JWTs (`JWT_ACCESS_TTL`, default 15m),
  signed with `SESSION_SECRET`.
- Refresh tokens are opaque random strings, hashed (SHA-256) at rest,
  rotated on every use, long-lived (`JWT_REFRESH_TTL`, default 30 days).
- Sessions are scoped **per phone** (`UserPhone`), not per user, so the
  same account can be logged in on multiple devices independently.
- Revoking a session marks it in the cache-backed blacklist immediately
  (TTL = access-token TTL) so it stops working before the JWT naturally
  expires — logout/revoke is not "wait up to 15 minutes."

### Cache

`internal/storage/cache` defines a `Cache` interface used for rate limiting
and session revocation. If `REDIS_URL` is set, it's used. If not, an
in-memory fallback is used automatically — this is safe for a single dev
instance but **logs a loud warning at startup** and does not share state
across multiple instances, so set `REDIS_URL` before running more than one
instance or before relying on immediate cross-instance session revocation.

## Local development (Replit)

The `LUMA Cloud Backend` workflow runs `go run ./cmd/api` on port 8090,
proxied under the `/cloud` path prefix. `DATABASE_URL` and `SESSION_SECRET`
are already available as project secrets/env vars; migrations run
automatically at startup (idempotent, tracked by `golang-migrate`).

Spec-literal paths from the original engine design (`/api/engines/<name>/...`)
are also mounted as aliases under `/cloud` alongside the more conventional
REST paths (`/cloud/auth/...`, `/cloud/devices/...`) — both work identically.

## Local development (outside Replit)

```bash
cp .env.example .env   # fill in SESSION_SECRET at minimum
docker compose up --build
```

This spins up Postgres + Redis + the API on `:8090`. `docker-compose.yml`
and the `Dockerfile` exist for portability (running this service somewhere
other than Replit) — Replit itself deploys the compiled Go binary directly
(see `.replit-artifact/artifact.toml`), not the Docker image.

## Deployment note on schema migrations

This service applies its own SQL migrations (`migrations/`, run via
`golang-migrate`) at startup in every environment, including production.
This is standard practice for a Go binary with no Replit-managed ORM/schema
diff tool behind it (unlike the project's Drizzle-based stacks, where
Replit's Publish flow diffs and applies schema automatically) — this
backend's migrations are its own source of truth and are additive/versioned,
so re-running them on every boot is a no-op once already applied.

## API docs

See `docs/openapi.yaml` for the full Phase 1 API surface.
