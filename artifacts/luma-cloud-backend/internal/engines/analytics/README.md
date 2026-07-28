# Analytics Engine

## Purpose

The Analytics Engine collects and aggregates telemetry data, usage stats, and system performance metrics.

## Architecture

- Decoupled services, repositories, and handlers.
- Background worker task aggregates raw events into daily rollups.

## API Endpoints

- `POST /events` — Ingest raw analytics event
- `GET /dashboard` — Query dashboard stats
