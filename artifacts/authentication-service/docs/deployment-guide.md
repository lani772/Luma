# LUMA Authentication Service: Deployment Guide

This guide describes how to compile, deploy, run, and scale the standalone Authentication Service microservice in development and production environments.

---

## 1. Local Development Quickstart

### Prerequisites
- Go 1.24 or higher
- PostgreSQL
- Redis (Optional; falls back to in-memory)

### Setup Steps
1. Navigate to the service root:
   ```bash
   cd authentication-service/
   ```
2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Modify `.env` to supply local database credentials.
3. Download dependencies and run the server:
   ```bash
   go run cmd/server/main.go
   ```
   The service will boot up, automatically apply any necessary schema auto-migrations to the target PostgreSQL database, and start listening on:
   - REST API: `http://localhost:8081`
   - gRPC Mock Server: `localhost:50051`
   - Prometheus Metrics: `http://localhost:8081/metrics`

---

## 2. Deploying with Docker Compose

For quick multi-container setup including PostgreSQL, Redis, and Mailhog:

1. Build and boot all containers:
   ```bash
   docker compose up --build -d
   ```
2. Verify all components are healthy:
   ```bash
   docker compose ps
   ```
3. Check application logs:
   ```bash
   docker compose logs -f auth-service
   ```
4. Access Mailhog Web UI at `http://localhost:8025` to inspect simulated dispatch emails.

---

## 3. Production Deployment Hardening

### 1. Supply Base64 Encoded Cryptographic Keypairs
For production, generate safe Ed25519 asymmetric signing keys rather than relying on dynamic transient generation:
```bash
# Generate Ed25519 PEM Private Key
openssl genpkey -algorithm ed25519 -out private.pem

# Derive Public Key from Private Key
openssl pkey -in private.pem -pubout -out public.pem

# Base64 encode the keys to insert into environment variables
cat private.pem | base64 -w 0
cat public.pem | base64 -w 0
```
Update your deployment environment variables `JWT_PRIVATE_KEY_B64` and `JWT_PUBLIC_KEY_B64` with the output.

### 2. HTTPS/TLS Enforcement
Always run the Authentication Service behind an API gateway or reverse proxy (such as Nginx, Traefik, or AWS ALB) configured for HTTPS. The service extracts the correct client IPs from proxies automatically.
