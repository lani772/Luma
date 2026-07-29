# LUMA Authentication Service: Database Schema Documentation

This document describes the PostgreSQL relational database tables, unique constraints, index plans, and relationships designed for the standalone Authentication Service.

---

## 1. Relational Entity Schema

### `users` Table
Stores primary user identity fields.
- `id` (UUID, PK): Unique identifier.
- `email` (VARCHAR, UNIQUE, NOT NULL): User email address.
- `username` (VARCHAR, UNIQUE, NULL): Non-mandatory user login handle.
- `password_hash` (VARCHAR, NOT NULL): Argon2id password hash.
- `phone` (VARCHAR, NULL): Mobile number of the user.
- `email_verified` (BOOLEAN, NOT NULL): Identity verification state.
- `phone_verified` (BOOLEAN, NOT NULL): Phone verification state.
- `status` (VARCHAR, NOT NULL): Account state (`active`, `suspended`, `deleted`).
- `created_at` (TIMESTAMP): Creation date.
- `updated_at` (TIMESTAMP): Last modification date.

### `sessions` Table
Tracks active user session contexts.
- `id` (UUID, PK): Session UUID.
- `user_id` (UUID, FK -> users.id): Associated user profile.
- `device_id` (VARCHAR, NOT NULL): Hardware fingerprint device ID.
- `ip_address` (VARCHAR, NOT NULL): IP address logged.
- `browser` (VARCHAR): User Agent browser name.
- `location` (VARCHAR): Decoded geo location.
- `expires_at` (TIMESTAMP): Expiration timestamp.
- `last_activity` (TIMESTAMP): Last active timestamp.
- `status` (VARCHAR): Session status (`active`, `revoked`).

### `refresh_tokens` Table
Supports rotation and security validation.
- `id` (UUID, PK): Token ID.
- `session_id` (UUID, FK -> sessions.id): Associated session ID.
- `token_hash` (VARCHAR, UNIQUE): Secure hash of the refresh token.
- `expires_at` (TIMESTAMP): Absolute expiration duration.
- `revoked` (BOOLEAN): Invalidation state flag.

### `email_verifications` Table
Handles step-up verification status and credentials.
- `id` (UUID, PK): Verification unique ID.
- `user_id` (UUID, FK -> users.id): Target user.
- `magic_link_hash` (VARCHAR, UNIQUE): Secure hash of Magic Link token.
- `magic_link_expires` (TIMESTAMP): Expiration of Link.
- `magic_link_verified` (BOOLEAN): Link status state.
- `otp_code_hash` (VARCHAR): Secure hash of 6-digit OTP code.
- `otp_expires` (TIMESTAMP): Expiration of OTP.
- `otp_verified` (BOOLEAN): OTP status state.
- `otp_attempts` (INTEGER): Attempt count to enforce limit constraints.

### `service_accounts` Table
Configures service-to-service credentials.
- `id` (UUID, PK): UUID.
- `service_name` (VARCHAR): Microservice name.
- `client_id` (VARCHAR, UNIQUE): Unique identifier key.
- `client_secret_hash` (VARCHAR): Argon2id hashed secret.
- `status` (VARCHAR): Account state (`active`, `suspended`).

### `audit_logs` Table
Maintains a security ledger.
- `id` (UUID, PK): Log UUID.
- `user_id` (UUID, FK -> users.id, NULL): Actor user id.
- `event_type` (VARCHAR): Activity name (e.g., `UserLoggedIn`, `PasswordReset`).
- `description` (TEXT): Text context description.
- `ip_address` (VARCHAR): Network origin address.
- `user_agent` (VARCHAR): Hardware browser details.

---

## 2. Indices Configuration Plan
Indexes are programmatically added to ensure optimal querying at scale:
- `idx_users_email`: B-Tree index on `users(email)`.
- `idx_users_username`: B-Tree index on `users(username)`.
- `idx_sessions_user_id`: B-Tree index on `sessions(user_id)`.
- `idx_refresh_tokens_session_id`: B-Tree index on `refresh_tokens(session_id)`.
- `idx_email_verifications_user_id`: B-Tree index on `email_verifications(user_id)`.
- `idx_service_accounts_client_id`: B-Tree index on `service_accounts(client_id)`.
