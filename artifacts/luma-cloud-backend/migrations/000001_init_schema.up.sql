-- LUMA Cloud Backend — initial schema.
--
-- This is the source of truth for the database shape. GORM models in
-- internal/models mirror these tables via column tags but AutoMigrate is
-- never used in this project — schema changes always go through a new
-- numbered migration file (see scripts/migrate.sh).
--
-- Phase 1 (implemented engines): users, user_phones, sessions,
-- password_reset_tokens, email_verification_tokens, devices, device_admins,
-- device_history, mqtt_device_identities.
--
-- Phase 2 (schema only for now — engines land in a follow-up pass):
-- firmware_releases, firmware_downloads, permissions, schedules, scenes,
-- notifications, audit_logs, analytics_events, analytics_daily_rollups,
-- sync_states, sync_history, backups.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive email column

-- ============================================================================
-- Phase 1 — Auth / User / Device Registration / MQTT Adapter
-- ============================================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT NOT NULL,
    password_hash       TEXT NOT NULL,
    full_name           TEXT NOT NULL DEFAULT '',
    role                TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    email_verified_at   TIMESTAMPTZ,
    subscription_tier   TEXT NOT NULL DEFAULT 'free',
    preferences         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_users_email ON users (email);

CREATE TABLE user_phones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name     TEXT NOT NULL,
    platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'other')),
    push_token      TEXT,
    push_provider   TEXT CHECK (push_provider IN ('fcm', 'apns', NULL)),
    app_version     TEXT,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);
CREATE INDEX idx_user_phones_user_id ON user_phones (user_id);

CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_id            UUID REFERENCES user_phones(id) ON DELETE SET NULL,
    refresh_token_hash  TEXT NOT NULL,
    user_agent          TEXT,
    ip_address          INET,
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE UNIQUE INDEX idx_sessions_refresh_token_hash ON sessions (refresh_token_hash);

CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_password_reset_token_hash ON password_reset_tokens (token_hash);

CREATE TABLE email_verification_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_email_verification_token_hash ON email_verification_tokens (token_hash);

CREATE TABLE devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name                TEXT NOT NULL,
    device_type         TEXT NOT NULL,
    microcontroller_id  TEXT NOT NULL,
    mac_address         MACADDR NOT NULL,
    firmware_version    TEXT,
    capabilities        JSONB NOT NULL DEFAULT '[]'::jsonb,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'online', 'offline', 'decommissioned')),
    registered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_online_at      TIMESTAMPTZ,
    last_sync_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_devices_mac_address ON devices (mac_address);
CREATE INDEX idx_devices_owner_id ON devices (owner_id);

-- Admin users a device is shared with, distinct from the owner.
CREATE TABLE device_admins (
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, user_id)
);

CREATE TABLE device_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL CHECK (event_type IN ('registered', 'updated', 'ownership_transferred', 'removed', 'admin_granted', 'admin_revoked')),
    actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_device_history_device_id ON device_history (device_id, created_at DESC);

-- Per-device MQTT identity issued by the adapter engine. The backend never
-- shares the broker's own admin credentials with a device or phone — it
-- issues scoped identities that the adapter's chosen broker implementation
-- knows how to authenticate/authorize.
CREATE TABLE mqtt_device_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    mqtt_client_id  TEXT NOT NULL,
    mqtt_username   TEXT NOT NULL,
    credential_hash TEXT NOT NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_mqtt_identities_client_id ON mqtt_device_identities (mqtt_client_id);
CREATE INDEX idx_mqtt_identities_device_id ON mqtt_device_identities (device_id);

-- ============================================================================
-- Phase 2 — schema reserved for engines landing in a follow-up pass
-- ============================================================================

CREATE TABLE firmware_releases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_type         TEXT NOT NULL,
    version             TEXT NOT NULL,
    channel             TEXT NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable', 'beta')),
    storage_path        TEXT NOT NULL,
    checksum_sha256     TEXT NOT NULL,
    signature           TEXT,
    size_bytes          BIGINT NOT NULL DEFAULT 0,
    release_notes       TEXT,
    is_rollback_target  BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_firmware_device_version ON firmware_releases (device_type, version);
CREATE INDEX idx_firmware_channel ON firmware_releases (device_type, channel, created_at DESC);

CREATE TABLE firmware_downloads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firmware_id     UUID NOT NULL REFERENCES firmware_releases(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    ip_address      INET,
    downloaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_firmware_downloads_firmware_id ON firmware_downloads (firmware_id);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
    granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ,
    UNIQUE (device_id, user_id)
);

CREATE TABLE schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    time_config     JSONB NOT NULL,
    action          JSONB NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_schedules_device_id ON schedules (device_id);
CREATE INDEX idx_schedules_owner_id ON schedules (owner_id);

CREATE TABLE scenes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    actions     JSONB NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenes_owner_id ON scenes (owner_id);

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('firmware', 'device', 'automation', 'schedule', 'user', 'system')),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    data        JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_id ON notifications (user_id, created_at DESC);

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);

CREATE TABLE analytics_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   UUID REFERENCES devices(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_events_device ON analytics_events (device_id, created_at DESC);

CREATE TABLE analytics_daily_rollups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   UUID REFERENCES devices(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    metric      TEXT NOT NULL,
    value       NUMERIC NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (device_id, date, metric)
);

CREATE TABLE sync_states (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_id              UUID NOT NULL REFERENCES user_phones(id) ON DELETE CASCADE,
    resource_type         TEXT NOT NULL,
    last_synced_version   INTEGER NOT NULL DEFAULT 0,
    last_synced_at        TIMESTAMPTZ,
    UNIQUE (phone_id, resource_type)
);

CREATE TABLE sync_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type       TEXT NOT NULL,
    resource_id         TEXT NOT NULL,
    version             INTEGER NOT NULL,
    action              TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'conflict_resolved')),
    conflict_resolved   BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_history_user ON sync_history (user_id, created_at DESC);

CREATE TABLE backups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    size_bytes  BIGINT NOT NULL DEFAULT 0,
    checksum    TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_backups_user_id ON backups (user_id, created_at DESC);
