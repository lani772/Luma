package models

import (
	"time"

	"github.com/google/uuid"
)

type AnalyticsEvent struct {
	ID        uuid.UUID  `gorm:"column:id;primaryKey"`
	DeviceID  *uuid.UUID `gorm:"column:device_id"`
	UserID    *uuid.UUID `gorm:"column:user_id"`
	EventType string     `gorm:"column:event_type"`
	Payload   JSONMap    `gorm:"column:payload"`
	CreatedAt time.Time  `gorm:"column:created_at"`
}

func (AnalyticsEvent) TableName() string { return "analytics_events" }

type AnalyticsDailyRollup struct {
	ID        uuid.UUID `gorm:"column:id;primaryKey"`
	DeviceID  uuid.UUID `gorm:"column:device_id"`
	Date      time.Time `gorm:"column:date;type:date"`
	Metric    string    `gorm:"column:metric"`
	Value     float64   `gorm:"column:value"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (AnalyticsDailyRollup) TableName() string { return "analytics_daily_rollups" }
