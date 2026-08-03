# DRDMS System Architecture

The **LUMA Device Registration & Device Management Service (DRDMS)** is designed as an independent microservice using Clean Architecture, implemented in Go. It acts as the absolute source of truth for physical devices (microcontrollers, smart devices, rooms, capabilities, configurations, and secure device credentials) in the LUMA ecosystem.

## Clean Architecture Structure

DRDMS is organized following strict Clean Architecture boundaries:

```
device-registration-service/
├── cmd/
│   └── server/                 # Entrypoint & DI wireup
├── internal/
│   ├── domain/                 # Pure domain entities, values, interfaces
│   ├── security/               # Token validation, AES-256-GCM encryption, hashing
│   ├── ai/                     # Mock LLM and simulation layout parsing
│   ├── simulation/             # Virtual controller creation & lifecycle
│   ├── firmware/               # Arduino / PlatformIO project zip structure generation
│   ├── device/                 # Microcontroller registration core
│   ├── resources/              # Resource (lamps, fans, etc.) management
│   ├── hardware/               # GPIO and Pin mapping, conflict validation
│   ├── capabilities/           # Capabilities profile defining possible device actions
│   ├── credentials/            # API key generation, MQTT credentials rotation
│   ├── repository/             # GORM-based PostgreSQL / SQLite database access
│   ├── services/               # Combined business use-case orchestrators
│   ├── handlers/               # Gin Web framework HTTP handlers with DTO mapping
│   ├── routes/                 # Gin REST endpoint route register
│   └── events/                 # Message broker event dispatch interfaces
```

## Security Separation of Concerns

DRDMS separates logic cleanly between related systems:
1. **Authentication Service**: Who is the user? (DRDMS validates using the RS256/Ed25519 public key provided by the Auth Service to decode JWTs)
2. **User Management Service**: User profiles and preferences.
3. **User Access Management Service (UAMS)**: Authorization & Roles. (DRDMS initializes and publishes owner assignment events to UAMS upon registration).
4. **Device Registration Service (DRDMS)**: What physical hardware resources exist?
5. **MQTT Service**: Scoped device-to-broker username/password validation and credentials.
