package models

import (
	"time"

	"github.com/google/uuid"
)

type FirmwareRelease struct {
	ID               uuid.UUID  `gorm:"column:id;primaryKey"`
	DeviceType       string     `gorm:"column:device_type"`
	Version          string     `gorm:"column:version"`
	Channel          string     `gorm:"column:channel"`
	StoragePath      string     `gorm:"column:storage_path"`
	ChecksumSHA256   string     `gorm:"column:checksum_sha256"`
	Signature        *string    `gorm:"column:signature"`
	SizeBytes        int64      `gorm:"column:size_bytes"`
	ReleaseNotes     *string    `gorm:"column:release_notes"`
	IsRollbackTarget bool       `gorm:"column:is_rollback_target"`
	CreatedBy        *uuid.UUID `gorm:"column:created_by"`
	CreatedAt        time.Time  `gorm:"column:created_at"`
}

func (FirmwareRelease) TableName() string { return "firmware_releases" }

type FirmwareDownload struct {
	ID           uuid.UUID  `gorm:"column:id;primaryKey"`
	FirmwareID   uuid.UUID  `gorm:"column:firmware_id"`
	DeviceID     *uuid.UUID `gorm:"column:device_id"`
	IPAddress    *string    `gorm:"column:ip_address"`
	DownloadedAt time.Time  `gorm:"column:downloaded_at"`
}

func (FirmwareDownload) TableName() string { return "firmware_downloads" }

type FirmwareDeployment struct {
	ID                uuid.UUID  `gorm:"column:id;primaryKey"`
	FirmwareID        uuid.UUID  `gorm:"column:firmware_id"`
	Name              string     `gorm:"column:name"`
	Status            string     `gorm:"column:status"`
	RolloutPercentage int        `gorm:"column:rollout_percentage"`
	ScheduledAt       *time.Time `gorm:"column:scheduled_at"`
	CreatedAt         time.Time  `gorm:"column:created_at"`
	UpdatedAt         time.Time  `gorm:"column:updated_at"`
}

func (FirmwareDeployment) TableName() string { return "firmware_deployments" }

type DeviceDeployment struct {
	ID           uuid.UUID `gorm:"column:id;primaryKey"`
	DeploymentID uuid.UUID `gorm:"column:deployment_id"`
	DeviceID     uuid.UUID `gorm:"column:device_id"`
	Status       string    `gorm:"column:status"`
	ErrorMessage *string   `gorm:"column:error_message"`
	Retries      int       `gorm:"column:retries"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func (DeviceDeployment) TableName() string { return "device_deployments" }
