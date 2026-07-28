package models

import (
	"time"

	"github.com/google/uuid"
)

type Schedule struct {
	ID         uuid.UUID `gorm:"column:id;primaryKey"`
	DeviceID   uuid.UUID `gorm:"column:device_id"`
	OwnerID    uuid.UUID `gorm:"column:owner_id"`
	Name       string    `gorm:"column:name"`
	TimeConfig JSONMap   `gorm:"column:time_config"`
	Action     JSONMap   `gorm:"column:action"`
	Enabled    bool      `gorm:"column:enabled"`
	Version    int       `gorm:"column:version"`
	CreatedAt  time.Time `gorm:"column:created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at"`
}

func (Schedule) TableName() string { return "schedules" }
