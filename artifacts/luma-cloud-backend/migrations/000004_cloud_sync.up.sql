CREATE TABLE cloud_sync_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id     TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    version         INTEGER NOT NULL DEFAULT 1,
    deleted         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, resource_type, resource_id)
);

CREATE INDEX idx_cloud_sync_records_lookup ON cloud_sync_records (user_id, resource_type, version);
