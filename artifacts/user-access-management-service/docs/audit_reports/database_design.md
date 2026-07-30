# LUMA User Access Management Service (UAMS)
## Phase 4 — Database Design Report

This report reviews the schema organization, index performance tuning, and unique constraints implemented within the UAMS MongoDB persistent layer.

### 1. MongoDB Schema Design & Collections

UAMS uses high-performance MongoDB collection schemas with embedded BSON tags:

* **role_assignments**: Maps physical microcontrollers to authorized users and specific roles. Includes compound index for speedy lookup of active roles.
* **permissions**: Stores resource-specific custom permission matrices. Tracks start/end times for time-bound permissions.
* **permission_keys**: Stores cryptographic SHA-256 hashed keys. Prevents replay attacks.
* **invitations**: Stores pending shared invitation metadata (email, phone, permission levels, expiration bounds).
* **access_requests**: Holds requester-initiated requests with statuses (`pending`, `approved`, `rejected`, `withdrawn`).
* **ownership_transfers**: Tracks pending two-step microcontroller transfers.
* **cloud_sync_records**: Holds serialized JSON data with resource versions to synchronize state across devices and offline clients.
* **audit_logs**: Immutable collection tracking administrative activities.

### 2. Indexes & Performance Optimization Review

The following query-performance and integrity indexes are ensured on startup:

| Collection | Key Structure | Index Type | Purpose |
|---|---|---|---|
| `role_assignments` | `{"user_id": 1, "microcontroller_id": 1}` | Unique Compound | Fast role resolution; prevents double-roles |
| `permissions` | `{"user_id": 1, "microcontroller_id": 1, "resource_id": 1, "resource_type": 1}` | Unique Compound | Fast permission matches; prevents duplicate permissions |
| `permission_keys` | `{"key_hash": 1}` | Unique | O(1) secure key lookup |
| `cloud_sync_records`| `{"user_id": 1, "resource_type": 1, "version": 1}`| Compound | Highly performant incremental sync pulling |
| `audit_logs` | `{"actor_user_id": 1, "created_at": -1}` | Compound | Fast reverse-chronological administrative trace audits |

### 3. TTL (Time-To-Live) Strategy
For temporary permissions and invitations, background worker cleanups run programmatically rather than relying purely on Mongo TTL indexes. This ensures that when a permission or invitation expires, UAMS can automatically perform multi-collection side effects (e.g. revoking associated permission keys, logging audit records, and issuing sync records).
