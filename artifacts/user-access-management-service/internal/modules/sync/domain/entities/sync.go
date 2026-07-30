package entities

import (
	"time"

	"github.com/google/uuid"
)

type CloudSyncRecord struct {
	ID           uuid.UUID `bson:"_id" json:"id"`
	UserID       uuid.UUID `bson:"user_id" json:"userId"`
	ResourceID   string    `bson:"resource_id" json:"resourceId"`
	ResourceType string    `bson:"resource_type" json:"resourceType"` // role | permission | permission_key | invitation | access_request | ownership
	Data         any       `bson:"data" json:"data"`
	Version      int       `bson:"version" json:"version"`
	Deleted      bool      `bson:"deleted" json:"deleted"`
	CreatedAt    time.Time `bson:"created_at" json:"createdAt"`
	UpdatedAt    time.Time `bson:"updated_at" json:"updatedAt"`
}
