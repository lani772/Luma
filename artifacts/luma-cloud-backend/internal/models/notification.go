package models

import (
	"time"

	"github.com/google/uuid"
)

type Notification struct {
	ID        uuid.UUID  `gorm:"column:id;primaryKey"`
	UserID    uuid.UUID  `gorm:"column:user_id"`
	Type      string     `gorm:"column:type"`
	Title     string     `gorm:"column:title"`
	Body      string     `gorm:"column:body"`
	Data      JSONMap    `gorm:"column:data"`
	ReadAt    *time.Time `gorm:"column:read_at"`
	CreatedAt time.Time  `gorm:"column:created_at"`
}

func (Notification) TableName() string { return "notifications" }

type NotificationQueueItem struct {
	ID             uuid.UUID  `gorm:"column:id;primaryKey"`
	UserID         uuid.UUID  `gorm:"column:user_id"`
	NotificationID *uuid.UUID `gorm:"column:notification_id"`
	Title          string     `gorm:"column:title"`
	Body           string     `gorm:"column:body"`
	Provider       string     `gorm:"column:provider"`
	Status         string     `gorm:"column:status"`
	RetryCount     int        `gorm:"column:retry_count"`
	NextAttemptAt  time.Time  `gorm:"column:next_attempt_at"`
	ErrorMessage   *string    `gorm:"column:error_message"`
	CreatedAt      time.Time  `gorm:"column:created_at"`
	UpdatedAt      time.Time  `gorm:"column:updated_at"`
}

func (NotificationQueueItem) TableName() string { return "notification_queue" }
