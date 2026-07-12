package models

import (
	"time"

	"github.com/google/uuid"
)

type SyncState struct {
	ID                uuid.UUID `gorm:"column:id;primaryKey"`
	UserID            uuid.UUID `gorm:"column:user_id"`
	PhoneID           uuid.UUID `gorm:"column:phone_id"`
	ResourceType      string    `gorm:"column:resource_type"`
	LastSyncedVersion int       `gorm:"column:last_synced_version"`
	LastSyncedAt      time.Time `gorm:"column:last_synced_at"`
}

func (SyncState) TableName() string { return "sync_states" }

type SyncHistory struct {
	ID               uuid.UUID `gorm:"column:id;primaryKey"`
	UserID           uuid.UUID `gorm:"column:user_id"`
	ResourceType     string    `gorm:"column:resource_type"`
	ResourceID       string    `gorm:"column:resource_id"`
	Version          int       `gorm:"column:version"`
	Action           string    `gorm:"column:action"`
	ConflictResolved bool      `gorm:"column:conflict_resolved"`
	CreatedAt        time.Time `gorm:"column:created_at"`
}

func (SyncHistory) TableName() string { return "sync_history" }

type CloudSyncRecord struct {
	ID           uuid.UUID `gorm:"column:id;primaryKey"`
	UserID       uuid.UUID `gorm:"column:user_id"`
	ResourceID   string    `gorm:"column:resource_id"`
	ResourceType string    `gorm:"column:resource_type"`
	Data         JSONMap   `gorm:"column:data"`
	Version      int       `gorm:"column:version"`
	Deleted      bool      `gorm:"column:deleted"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func (CloudSyncRecord) TableName() string { return "cloud_sync_records" }
