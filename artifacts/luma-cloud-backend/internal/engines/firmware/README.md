# Firmware Repository Engine

## Purpose

The Firmware Repository Engine manages all compiled binary files for microcontrollers, facilitating OTA (Over-The-Air) distribution. It supports version checking, multi-channel releases (stable vs beta), rollback markings, uploader/device association downloads, and file-integrity validation.

## Architecture

- **Clean Layer Separation:** High separation between REST handlers, Business Service, Database Repository, and Storage Provider.
- **StorageProvider Abstraction:** The Service uploads binaries to a configurable `StorageProvider` (such as `LocalStorageProvider` using filesystem or an S3 mock).

## Database Schema

- **firmware_releases:** Primary record containing device types, version strings, checksums, size, storage path, channel, notes, uploader identifier, and rollback safety indicators.
- **firmware_downloads:** Tracking system saving when, where (IP addresses), and which devices requested downloads of specific firmware versions.

## API Endpoints

All endpoints are hosted under both `/cloud/firmware` and spec-literal path `/cloud/api/engines/firmware`.

- `POST /upload` — Upload `.bin` with multipart payload + metadata (Auth required)
- `GET /` — Paginated and filterable list of releases
- `GET /compare` — Compare version with the latest for a device type and channel
- `GET /:id` — Get metadata for a specific release
- `DELETE /:id` — Delete a firmware release and its storage files (Auth required)
- `POST /:id/publish` — Update channel (e.g. from beta to stable)
- `POST /:id/archive` — Mark/Unmark as rollback target
- `GET /:id/download` — Download raw binary (no strict Auth token requirement)
