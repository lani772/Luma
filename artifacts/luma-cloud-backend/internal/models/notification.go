package models

import (
	"time"

	"github.com/google/uuid"
)

type Notification struct {
	ID        uuid.UUID  `bson:"_id"`
	UserID    uuid.UUID  `bson:"user_id"`
	Type      string     `bson:"type"`
	Title     string     `bson:"title"`
	Body      string     `bson:"body"`
	Data      JSONMap    `bson:"data"`
	ReadAt    *time.Time `bson:"read_at,omitempty"`
	CreatedAt time.Time  `bson:"created_at"`
}

type NotificationQueueItem struct {
	ID             uuid.UUID  `bson:"_id"`
	UserID         uuid.UUID  `bson:"user_id"`
	NotificationID *uuid.UUID `bson:"notification_id,omitempty"`
	Title          string     `bson:"title"`
	Body           string     `bson:"body"`
	Provider       string     `bson:"provider"`
	Status         string     `bson:"status"`
	RetryCount     int        `bson:"retry_count"`
	NextAttemptAt  time.Time  `bson:"next_attempt_at"`
	ErrorMessage   *string    `bson:"error_message,omitempty"`
	CreatedAt      time.Time  `bson:"created_at"`
	UpdatedAt      time.Time  `bson:"updated_at"`
}
