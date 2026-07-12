# Cloud Sync Engine

## Purpose

The Cloud Sync Engine enables reliable cross-device data synchronization across multiple client devices (such as mobile applications). It manages state versioning, conflict detection, incremental changes, and last-write-wins (LWW) conflict resolution strategies on a per-resource basis.

## Architecture

- **Clean Layer Separation:** Fully independent repository layer, business service logic, and API routes.
- **Generic Synchronization Record Store:** Features a generic database representation `cloud_sync_records` capable of handling any resource type (Homes, Rooms, Devices, Scenes, Schedules, Preferences, etc.) in a unified manner.
- **Resource-Scoped Versioning:** Tracking and versioning occurs individually per resource, keeping pull sync requests highly performant and network-efficient.

## Database Schema

- **cloud_sync_records:** Holds the serialized JSON configuration data, version count, delete state, and resource identifiers.
- **sync_states:** Keeps track of the last synchronized version number for each specific phone/device and resource type.
- **sync_history:** Holds action log entries (create, update, delete, conflict_resolved) for historical synchronization tracing.

## API Endpoints

Mounted under `/cloud/sync` and `/cloud/api/engines/sync`.

- `POST /push` — Accepts a batch of resource changes from a client. Performs conflict checks and saves updates. (Auth required)
- `POST /pull` — Pulls incremental updates from the server since the client's last synchronized version number. (Auth required)
