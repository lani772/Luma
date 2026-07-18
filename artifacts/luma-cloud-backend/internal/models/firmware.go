package models

import (
	"time"

	"github.com/google/uuid"
)

type FirmwareRelease struct {
	ID               uuid.UUID  `bson:"_id"`
	DeviceType       string     `bson:"device_type"`
	Version          string     `bson:"version"`
	Channel          string     `bson:"channel"`
	StoragePath      string     `bson:"storage_path"`
	ChecksumSHA256   string     `bson:"checksum_sha256"`
	Signature        *string    `bson:"signature,omitempty"`
	SizeBytes        int64      `bson:"size_bytes"`
	ReleaseNotes     *string    `bson:"release_notes,omitempty"`
	IsRollbackTarget bool       `bson:"is_rollback_target"`
	CreatedBy        *uuid.UUID `bson:"created_by,omitempty"`
	CreatedAt        time.Time  `bson:"created_at"`
}

type FirmwareDownload struct {
	ID           uuid.UUID  `bson:"_id"`
	FirmwareID   uuid.UUID  `bson:"firmware_id"`
	DeviceID     *uuid.UUID `bson:"device_id,omitempty"`
	IPAddress    *string    `bson:"ip_address,omitempty"`
	DownloadedAt time.Time  `bson:"downloaded_at"`
}

type FirmwareDeployment struct {
	ID                uuid.UUID  `bson:"_id"`
	FirmwareID        uuid.UUID  `bson:"firmware_id"`
	Name              string     `bson:"name"`
	Status            string     `bson:"status"`
	RolloutPercentage int        `bson:"rollout_percentage"`
	ScheduledAt       *time.Time `bson:"scheduled_at,omitempty"`
	CreatedAt         time.Time  `bson:"created_at"`
	UpdatedAt         time.Time  `bson:"updated_at"`
}

type DeviceDeployment struct {
	ID           uuid.UUID `bson:"_id"`
	DeploymentID uuid.UUID `bson:"deployment_id"`
	DeviceID     uuid.UUID `bson:"device_id"`
	Status       string    `bson:"status"`
	ErrorMessage *string   `bson:"error_message,omitempty"`
	Retries      int       `bson:"retries"`
	CreatedAt    time.Time `bson:"created_at"`
	UpdatedAt    time.Time `bson:"updated_at"`
}
