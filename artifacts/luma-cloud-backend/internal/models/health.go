package models

import (
	"time"

	"github.com/google/uuid"
)

type DeviceHealthReport struct {
	ID                 uuid.UUID `gorm:"column:id;primaryKey"`
	DeviceID           uuid.UUID `gorm:"column:device_id"`
	FirmwareVersion    *string   `gorm:"column:firmware_version"`
	HeapFreeBytes      int64     `gorm:"column:heap_free_bytes"`
	FlashUsedBytes     int64     `gorm:"column:flash_used_bytes"`
	WifiRSSI           int       `gorm:"column:wifi_rssi"`
	MqttConnected      bool      `gorm:"column:mqtt_connected"`
	RestartCount       int       `gorm:"column:restart_count"`
	TemperatureCelsius *float64  `gorm:"column:temperature_celsius"`
	CreatedAt          time.Time `gorm:"column:created_at"`
}

func (DeviceHealthReport) TableName() string { return "device_health_reports" }
