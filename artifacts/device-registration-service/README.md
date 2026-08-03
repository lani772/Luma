# LUMA Device Registration & Device Management Service (DRDMS)

Welcome to the **LUMA Device Registration & Device Management Service (DRDMS)**. This is a fully independent enterprise Go microservice developed using Clean Architecture.

## Features

- **Simulation-First Device Onboarding**: Onboard and mock smart devices prior to hardware purchases.
- **AI-Assisted Layout Generation**: Natural language parsing allocates GPIO and resources dynamically.
- **Auto-Generated Compile-Ready Firmware**: Download compile-ready ESP32 Arduino ZIP archives configured for automatic registration.
- **Microcontroller Handshake & Claim**: Unregistered ESP32 chips auto-configure themselves.
- **Security Protections**: Sensitive physical metrics are restricted to device owners only.

## Getting Started

### Local Development

1. Run the service locally:
```bash
cd artifacts/device-registration-service
go run ./cmd/server/main.go
```

By default, the service uses SQLite as a fallback database if no PostgreSQL `DATABASE_URL` is set, making it highly portable.

### Run tests

```bash
cd artifacts/device-registration-service
go test -v ./...
```
