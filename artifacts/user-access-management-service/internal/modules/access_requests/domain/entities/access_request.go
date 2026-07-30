package entities

import (
	"time"

	"github.com/google/uuid"
)

type AccessRequest struct {
	ID                uuid.UUID  `bson:"_id" json:"id"`
	RequesterID       uuid.UUID  `bson:"requester_id" json:"requesterId"`
	OwnerID           uuid.UUID  `bson:"owner_id" json:"ownerId"`
	ResourceID        string     `bson:"resource_id" json:"resourceId"`
	ResourceType      string     `bson:"resource_type" json:"resourceType"` // microcontroller | home | room | device | feature
	RequestedRole     string     `bson:"requested_role" json:"requestedRole"` // owner | administrator | operator | viewer
	RequestedDuration *int       `bson:"requested_duration,omitempty" json:"requestedDuration,omitempty"` // in hours, optional
	Message           string     `bson:"message" json:"message"`
	Status            string     `bson:"status" json:"status"` // pending | approved | rejected | cancelled | expired | withdrawn
	CreatedAt         time.Time  `bson:"created_at" json:"createdAt"`
	UpdatedAt         time.Time  `bson:"updated_at" json:"updatedAt"`
}
