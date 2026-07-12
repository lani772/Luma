package deployment

import "time"

type CreateDeploymentRequest struct {
	FirmwareID        string     `json:"firmwareId" binding:"required,uuid"`
	Name              string     `json:"name" binding:"required"`
	RolloutPercentage int        `json:"rolloutPercentage" binding:"required,min=0,max=100"`
	ScheduledAt       *time.Time `json:"scheduledAt"`
}

type RetryDeploymentRequest struct {
	DeviceID string `json:"deviceId" binding:"required,uuid"`
}

type DeploymentDTO struct {
	ID                string              `json:"id"`
	FirmwareID        string              `json:"firmwareId"`
	Name              string              `json:"name"`
	Status            string              `json:"status"`
	RolloutPercentage int                 `json:"rolloutPercentage"`
	ScheduledAt       *time.Time          `json:"scheduledAt,omitempty"`
	CreatedAt         time.Time           `json:"createdAt"`
	UpdatedAt         time.Time           `json:"updatedAt"`
	Devices           []DeviceStatusDTO   `json:"devices,omitempty"`
	Stats             *DeploymentStatsDTO `json:"stats,omitempty"`
}

type DeviceStatusDTO struct {
	DeviceID     string     `json:"deviceId"`
	Status       string     `json:"status"`
	ErrorMessage *string    `json:"errorMessage,omitempty"`
	Retries      int        `json:"retries"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type DeploymentStatsDTO struct {
	Total     int `json:"total"`
	Pending   int `json:"pending"`
	Running   int `json:"running"`
	Completed int `json:"completed"`
	Failed    int `json:"failed"`
}
