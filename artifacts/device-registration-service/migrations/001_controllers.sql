-- 001_controllers.sql
CREATE TABLE IF NOT EXISTS controllers (
    id UUID PRIMARY KEY,
    owner_reference UUID NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    chip_id VARCHAR(100),
    hardware_version VARCHAR(50),
    firmware_version VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    mac_address VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    registered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_controllers_owner ON controllers (owner_reference);
CREATE INDEX IF NOT EXISTS idx_controllers_status ON controllers (status);
