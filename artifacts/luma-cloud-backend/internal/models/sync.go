package models

import (
	"time"

	"github.com/google/uuid"
)

type SyncState struct {
	ID                uuid.UUID `bson:"_id"`
	UserID            uuid.UUID `bson:"user_id"`
	PhoneID           uuid.UUID `bson:"phone_id"`
	ResourceType      string    `bson:"resource_type"`
	LastSyncedVersion int       `bson:"last_synced_version"`
	LastSyncedAt      time.Time `bson:"last_synced_at"`
}

type SyncHistory struct {
	ID               uuid.UUID `bson:"_id"`
	UserID           uuid.UUID `bson:"user_id"`
	ResourceType     string    `bson:"resource_type"`
	ResourceID       string    `bson:"resource_id"`
	Version          int       `bson:"version"`
	Action           string    `bson:"action"`
	ConflictResolved bool      `bson:"conflict_resolved"`
	CreatedAt        time.Time `bson:"created_at"`
}

type CloudSyncRecord struct {
	ID           uuid.UUID `bson:"_id"`
	UserID       uuid.UUID `bson:"user_id"`
	ResourceID   string    `bson:"resource_id"`
	ResourceType string    `bson:"resource_type"`
	Data         JSONMap   `bson:"data"`
	Version      int       `bson:"version"`
	Deleted      bool      `bson:"deleted"`
	CreatedAt    time.Time `bson:"created_at"`
	UpdatedAt    time.Time `bson:"updated_at"`
}
