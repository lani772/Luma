-- 002_rooms_and_resources.sql
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    location VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY,
    controller_id UUID NOT NULL,
    room_id UUID,
    name VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_resources_controller FOREIGN KEY (controller_id) REFERENCES controllers (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_resources_controller ON resources (controller_id);
CREATE INDEX IF NOT EXISTS idx_resources_room ON resources (room_id);
