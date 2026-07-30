# LUMA User Access Management Service (UAMS)
## Phase 10 — Security Hardening & Zero-Trust Guide

This guide details the cryptographic practices, role hierarchy gates, and fields masking policies implemented to secure the LUMA ecosystem.

### 1. Zero-Trust Permission Key Lifecycle

UAMS manages permission keys (Module 9) using the same security standard as advanced session managers:

* **Cryptographic Generation**: Keys are generated using `crypto/rand` to yield 64 secure bytes (128-char hexadecimal token string).
* **At-Rest Protection**: Keys are never stored in plaintext inside MongoDB. Only the cryptographically secure SHA-256 hash is stored (`key_hash`).
* **Validation**: Clients present the raw key. UAMS hashes it and does an O(1) lookup on the hash. If matched, UAMS validates its status and expiration bounds.

### 2. Mandatory Serialization-Level Masking (Module 8)

To protect physical assets from exploitation, non-owners must never receive sensitive microcontroller details (MAC address, local Wi-Fi, GPIO assignments, MQTT topics, or credentials).
- The `resource_visibility` service programmatically sanitizes the microcontroller details at the Go struct serialization layer.
- If a user is not the owner of the microcontroller, they receive a sanitized, safe structural model.

### 3. State & Audit Trail Immobility
- Any authorization or ownership change writes a Chronological log in `audit_logs`.
- Audit logs contain the actor user ID, client IP, target, action metadata, and timestamps.
- These collections are structurally write-only to guarantee non-repudiation.
