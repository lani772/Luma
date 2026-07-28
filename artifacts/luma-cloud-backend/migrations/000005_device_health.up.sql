CREATE TABLE device_health_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    firmware_version    TEXT,
    heap_free_bytes     BIGINT NOT NULL DEFAULT 0,
    flash_used_bytes    BIGINT NOT NULL DEFAULT 0,
    wifi_rssi           INTEGER NOT NULL DEFAULT 0,
    mqtt_connected      BOOLEAN NOT NULL DEFAULT false,
    restart_count       INTEGER NOT NULL DEFAULT 0,
    temperature_celsius NUMERIC,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_health_reports_device ON device_health_reports (device_id, created_at DESC);
