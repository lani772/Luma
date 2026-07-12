# Cloud Backup Engine

## Purpose

The Cloud Backup Engine allows users to perform full and partial backups and restores of their account configuration data (including homes, rooms, devices, scenes, schedules, permissions, and user preferences). It operates alongside the Cloud Sync Engine to serialize and store incremental state backups.

## Architecture

- **Clean Layer Separation:** Loose coupling between HTTP handlers, business services, and GORM database persistences.
- **StorageProvider Reusability:** Backups are securely written to and read from the generic `StorageProvider` interface, fully supporting interchangeable file systems or cloud object storage structures.
- **Incremental Re-push Triggering:** When a backup is restored (either fully or partially for specific rooms/controllers), target resource versions are incremented on the database, prompting subsequent client devices to sync the restored datasets.

## Database Schema

- **backups:** Contains primary metadata including storage paths, backup sizing metrics, hash integrity checksums, and user ownership parameters.

## API Endpoints

Mounted under `/cloud/backups` and `/cloud/api/engines/backups`.

- `POST /` — Generate a new manual backup archive (Auth required)
- `GET /` — List and query available backup history for the user (Auth required)
- `POST /:id/restore` — Perform a full or partial restore using the specified backup ID (Auth required)
- `DELETE /:id` — Delete a backup from both the database and file storage systems (Auth required)
