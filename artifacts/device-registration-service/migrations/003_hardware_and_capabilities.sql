-- 003_hardware_and_capabilities.sql
CREATE TABLE IF NOT EXISTS device_configurations (
    id UUID PRIMARY KEY,
    controller_id UUID NOT NULL,
    gpio_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
    device_logic JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_configurations_controller FOREIGN KEY (controller_id) REFERENCES controllers (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_configurations_controller ON device_configurations (controller_id);

CREATE TABLE IF NOT EXISTS device_capabilities (
    id UUID PRIMARY KEY,
    resource_id UUID NOT NULL,
    capability_name VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_capabilities_resource FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_capabilities_resource ON device_capabilities (resource_id);
