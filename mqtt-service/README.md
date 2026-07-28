# LUMA MQTT Service

An enterprise-grade, highly scalable, and production-ready MQTT Gateway microservice written in Go. It connects securely to **EMQX Cloud** using TLS and the Eclipse Paho MQTT client, and exposes a robust REST API for the rest of the LUMA platform.

This microservice follows **Clean Architecture** patterns, is fully stateless, supports horizontal scaling, and integrates PostgreSQL for persistent metadata storage and Redis for high-performance session cache, presence tracking, and message queuing.

---

## 1. System Architecture

The microservice is designed using hexagonal/Clean Architecture boundaries, ensuring code layers remain loosely coupled and fully testable:

```
                  ┌──────────────────────────────────────────────┐
                  │                 HTTP Client                  │
                  └──────────────────────┬───────────────────────┘
                                         │ REST APIs
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API LAYER (internal/api)                                                        │
│ - Gin HTTP Router & Route Mounts (router.go)                                    │
│ - Request/Response DTO Serialization (dto/)                                     │
│ - Auth (JWT, api key) & RBAC Middlewares (middleware/)                          │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Interface Calls
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SERVICE / DOMAIN LAYER (internal/service)                                       │
│ - Core Business Logic (Auth, Devices, Telemetry, Commands)                      │
│ - Background Workers & Schedulers (internal/worker)                             │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Repository/Client Interfaces
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER (internal/repository, pkg/mqttclient, pkg/emqxclient)     │
│ - GORM PostgreSQL Repository Impls (gorm_repos.go)                              │
│ - Redis Presence, Queuing, Rate Limiting Impls (redis.go)                      │
│ - Paho MQTT Client Wrapper (pkg/mqttclient/)                                    │
│ - EMQX Public REST API v1 Client (pkg/emqxclient/)                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Flows

- **Dual-Authentication Middleware**: Supports standard JWT Access tokens for end-user app sessions (with refresh token rotation and revocation) AND specialized `X-API-Key` headers for secure service-to-service communication from other LUMA microservices.
- **Device Status and Presence Tracking**: Leverages Redis-based presence maps. When devices disconnect unexpectedly, EMQX triggers the **Last Will and Testament (LWT)** message, which immediately marks the device `offline`. A background timeout scanner ensures stale device records are cleaned up.
- **Offline Commands Queue**: If a device is offline, command messages published to it are placed into a Redis-backed offline queue. When the device reconnects and publishes its status, the background worker immediately flushes and delivers all pending commands.
- **Reliable Publish Retry Queue**: Failed publishes due to temporary broker network issues are recorded in a hash-map retry queue with exponential backoff calculation (up to 5 attempts before marking as `failed`).

---

## 2. MQTT Topic Hierarchy

All devices and cloud gateways communicate using a structured, device-scoped topic hierarchy. This enables easy Access Control List (ACL) configuration in EMQX Cloud:

| Topic Pattern | Direction | Description |
|---|---|---|
| `luma/device/{deviceId}/status` | Device -> Cloud | Online/offline presence state (with LWT) |
| `luma/device/{deviceId}/telemetry` | Device -> Cloud | Sensor readings and telemetry streams |
| `luma/device/{deviceId}/command` | Cloud -> Device | Incoming action command with correlation ID |
| `luma/device/{deviceId}/response` | Device -> Cloud | Command execution acknowledgement (Correlation) |
| `luma/device/{deviceId}/config` | Cloud -> Device | Device configuration parameters |
| `luma/device/{deviceId}/firmware` | Cloud -> Device | Firmware update metadata / check requests |
| `luma/device/{deviceId}/heartbeat` | Device -> Cloud | Periodic keep-alive ping |
| `luma/device/{deviceId}/event` | Device -> Cloud | Criticial events / immediate alarms |
| `luma/system/broadcast` | Cloud -> Devices | System-wide broadcast messages |
| `luma/user/{userId}/notification` | Cloud -> User | Cloud-relayed user notification messages |

---

## 3. Configuration & Environment Variables

Create a `.env` file or define the following environment variables:

```env
# Server
PORT=8091
ENV=development
JWT_SECRET=luma-gateway-very-secure-jwt-secret-key-change-me
JWT_REFRESH_SECRET=luma-gateway-very-secure-refresh-token-secret-key
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h

# Database (PostgreSQL)
DATABASE_URL=postgres://luma:luma_password@localhost:5432/luma_mqtt?sslmode=disable
DB_HOST=localhost
DB_PORT=5432
DB_USER=luma
DB_PASSWORD=luma_password
DB_NAME=luma_mqtt
DB_SSLMODE=disable

# Cache & Queues (Redis)
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# EMQX Broker & TLS Configuration
EMQX_BROKER_HOST=localhost
EMQX_BROKER_PORT=1883
EMQX_USERNAME=luma_backend
EMQX_PASSWORD=luma_password
EMQX_TLS_ENABLED=false
EMQX_CA_CERT_PATH=

# EMQX Cloud Public API Configuration
EMQX_API_ENDPOINT=https://cloud-intl.emqx.com/public_api/v1
EMQX_API_KEY=your_emqx_api_key
EMQX_API_SECRET=your_emqx_api_secret

# Service API Key (for backend microservices auth)
SERVICE_API_KEY=test-api-key
```

---

## 4. API Reference

### Authentication
- `POST /api/v1/auth/register` - Register a new user.
- `POST /api/v1/auth/login` - Login and get access + refresh token pair.
- `POST /api/v1/auth/refresh` - Rotate and get a new token pair using the refresh token.
- `POST /api/v1/auth/logout` - Revoke active refresh token.

### Device Control
- `POST /api/v1/devices/register` - Register a new IoT device and establish ownership.
- `POST /api/v1/mqtt/publish` - Publish a raw MQTT message (Admin / Service key required).
- `POST /api/v1/mqtt/subscribe` - Subscribe the gateway client to a topic wildcard.
- `POST /api/v1/mqtt/unsubscribe` - Unsubscribe gateway from topic.
- `POST /api/v1/mqtt/devices/:deviceId/commands` - Correlate and dispatch a command to a device.
- `GET /api/v1/mqtt/devices/:deviceId/status` - Fetch device online/offline status and last heartbeat.
- `GET /api/v1/mqtt/devices/:deviceId/telemetry` - Fetch historical telemetry stream.

### System Diagnostics
- `GET /health` - Service health status.
- `GET /ready` - Server readiness probe.
- `GET /live` - Server liveness probe.
- `GET /metrics` - Prometheus metrics scraper endpoint.
- `GET /api/v1/mqtt/health` - Broker connectivity diagnostics.
- `GET /api/v1/mqtt/stats` - Connection, message, and queue telemetry counters.
- `GET /api/v1/mqtt/connections` - List current active MQTT clients.

---

## 5. Local Execution & Testing

### Running Tests

Run the complete test suite (unit + E2E integration tests):
```bash
cd mqtt-service
go test ./...
```

### Running Locally

To run the application locally:
```bash
cd mqtt-service
go run ./cmd/server/main.go
```
This loads configuration from `configs/*.yaml` and applies any overrides from the environment.
