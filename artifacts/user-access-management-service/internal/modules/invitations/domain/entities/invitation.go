package entities

import (
	"time"

	"github.com/google/uuid"
)

type Invitation struct {
	ID              uuid.UUID  `bson:"_id" json:"id"`
	SenderID        uuid.UUID  `bson:"sender_id" json:"senderId"`
	RecipientEmail  string     `bson:"recipient_email" json:"recipientEmail"`
	RecipientPhone  string     `bson:"recipient_phone" json:"recipientPhone"`
	ResourceID      string     `bson:"resource_id" json:"resourceId"`
	ResourceType    string     `bson:"resource_type" json:"resourceType"`
	PermissionLevel string     `bson:"permission_level" json:"permissionLevel"` // owner | administrator | operator | viewer
	PersonalMessage string     `bson:"personal_message" json:"personalMessage"`
	Status          string     `bson:"status" json:"status"` // pending | accepted | rejected | cancelled | expired | revoked
	ExpiresAt       time.Time  `bson:"expires_at" json:"expiresAt"`
	CreatedAt       time.Time  `bson:"created_at" json:"createdAt"`
	UpdatedAt       time.Time  `bson:"updated_at" json:"updatedAt"`
}
