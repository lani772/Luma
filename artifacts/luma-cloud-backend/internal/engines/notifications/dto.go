package notifications

import "time"

type CreateNotificationRequest struct {
	UserID string         `json:"userId" binding:"required,uuid"`
	Type   string         `json:"type" binding:"required,oneof=firmware device automation schedule user system"`
	Title  string         `json:"title" binding:"required"`
	Body   string         `json:"body" binding:"required"`
	Data   map[string]any `json:"data,omitempty"`
}

type MarkReadRequest struct {
	NotificationIDs []string `json:"notificationIds" binding:"required"`
}

type UpdatePreferencesRequest struct {
	Preferences map[string]any `json:"preferences" binding:"required"`
}

type NotificationDTO struct {
	ID        string         `json:"id"`
	UserID    string         `json:"userId"`
	Type      string         `json:"type"`
	Title     string         `json:"title"`
	Body      string         `json:"body"`
	Data      map[string]any `json:"data,omitempty"`
	ReadAt    *time.Time     `json:"readAt,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
}

type QueueItemDTO struct {
	ID             string     `json:"id"`
	UserID         string     `json:"userId"`
	NotificationID *string    `json:"notificationId,omitempty"`
	Title          string     `json:"title"`
	Body           string     `json:"body"`
	Provider       string     `json:"provider"`
	Status         string     `json:"status"`
	RetryCount     int        `json:"retryCount"`
	NextAttemptAt  time.Time  `json:"nextAttemptAt"`
	ErrorMessage   *string    `json:"errorMessage,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}
