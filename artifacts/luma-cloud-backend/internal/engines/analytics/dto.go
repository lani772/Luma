package analytics

import "time"

type IngestEventRequest struct {
	DeviceID  *string        `json:"deviceId,omitempty" binding:"omitempty,uuid"`
	EventType string         `json:"eventType" binding:"required"`
	Payload   map[string]any `json:"payload" binding:"required"`
}

type RollupDTO struct {
	DeviceID string    `json:"deviceId"`
	Date     time.Time `json:"date"`
	Metric   string    `json:"metric"`
	Value    float64   `json:"value"`
}

type DashboardSummaryDTO struct {
	TotalEvents int                  `json:"totalEvents"`
	Metrics     map[string]float64   `json:"metrics"`
	Rollups     []RollupDTO          `json:"rollups"`
}
