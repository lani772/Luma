-- 004_credentials_and_simulations.sql
CREATE TABLE IF NOT EXISTS device_credentials (
    id UUID PRIMARY KEY,
    controller_id UUID NOT NULL,
    registration_token VARCHAR(255) UNIQUE,
    api_key_hash VARCHAR(255),
    mqtt_username VARCHAR(100),
    encrypted_mqtt_password TEXT,
    encrypted_device_secret TEXT,
    nonce VARCHAR(50),
    key_version INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_credentials_controller FOREIGN KEY (controller_id) REFERENCES controllers (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_controller ON device_credentials (controller_id);

CREATE TABLE IF NOT EXISTS device_simulations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    controller_type VARCHAR(50) NOT NULL,
    layout_blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_simulations_user ON device_simulations (user_id);
