# Firmware Deployment Engine

## Purpose

The Firmware Deployment Engine handles Over-The-Air (OTA) rollout campaigns to devices. It coordinates deterministic percentage rollouts, scheduling, retry triggers, and rollbacks.

## Architecture

- **Clean Layer Separation:** Strict modular structure separating persistence, services, and HTTP routes.
- **Deterministic Rollout:** Device inclusion in fractional rollouts is decided using the device's unique ID modulo 100 (`hash(DeviceID) % 100`). This ensures consistent rollout groups.
- **State transitions:** Orchestrates Pending -> Scheduled -> Running -> Completed/Failed/Rolled Back status progression via a background worker or direct calls.

## Database Schema

- **firmware_deployments:** Defines rollout campaigns, targeting specific firmware IDs and defining schedule times and rollout proportions.
- **device_deployments:** Tracks individual status progression (Pending, Running, Completed, Failed, Rolled Back) and errors for each device targeted in a campaign.

## API Endpoints

Mounted under `/cloud/deployments` and `/cloud/api/engines/deployments`.

- `POST /` — Create and trigger a rollout campaign (Auth required)
- `GET /` — List campaigns with paginated stats (Auth required)
- `GET /:id` — Get comprehensive stats, status, and targeted device logs (Auth required)
- `POST /:id/rollback` — Trigger rolled back state for all campaign devices (Auth required)
- `POST /:id/devices/:deviceId/retry` — Re-queue a failed device within the rollout campaign (Auth required)
