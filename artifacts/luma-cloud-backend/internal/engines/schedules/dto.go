package schedules

import "time"

type CreateScheduleRequest struct {
	DeviceID   string         `json:"deviceId" binding:"required,uuid"`
	Name       string         `json:"name" binding:"required"`
	TimeConfig map[string]any `json:"timeConfig" binding:"required"`
	Action     map[string]any `json:"action" binding:"required"`
	Enabled    *bool          `json:"enabled"`
}

type UpdateScheduleRequest struct {
	Name       *string        `json:"name,omitempty"`
	TimeConfig map[string]any `json:"timeConfig,omitempty"`
	Action     map[string]any `json:"action,omitempty"`
	Enabled    *bool          `json:"enabled,omitempty"`
}

type ScheduleDTO struct {
	ID         string         `json:"id"`
	DeviceID   string         `json:"deviceId"`
	OwnerID    string         `json:"ownerId"`
	Name       string         `json:"name"`
	TimeConfig map[string]any `json:"timeConfig"`
	Action     map[string]any `json:"action"`
	Enabled    bool           `json:"enabled"`
	Version    int            `json:"version"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
}
