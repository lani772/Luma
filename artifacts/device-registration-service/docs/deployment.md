# Deployment Specification

The LUMA DRDMS service is built as an independent, portable Go microservice. It is configured for standard Docker container orchestration.

## Docker Configurations

### 1. Multi-Stage Dockerfile
- Stage 1 (`builder`): Compiles the static Go binary utilizing `golang:1.24-alpine`.
- Stage 2 (`runner`): A lightweight `alpine:latest` runner. Standardizes user roles, certificates, and exposes API port `8095`.

### 2. Docker Compose File
- Pins the DRDMS microservice and pairs it with an independent PostgreSQL service for full database autonomy.
- Configures environment variables:
  - `PORT=8095`
  - `DATABASE_URL=postgres://postgres:postgres@db:5432/luma_drdms?sslmode=disable`
  - `DEVICE_ENCRYPTION_KEY=12345678901234567890123456789012` (for AES-256-GCM)
  - `JWT_PUBLIC_KEY` (Auth service key verification parameter)
