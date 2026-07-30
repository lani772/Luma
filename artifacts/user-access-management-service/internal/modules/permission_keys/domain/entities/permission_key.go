package entities

import (
	"time"

	"github.com/google/uuid"
)

type PermissionKey struct {
	ID           uuid.UUID  `bson:"_id" json:"id"`
	UserID       uuid.UUID  `bson:"user_id" json:"userId"`
	ResourceID   string     `bson:"resource_id" json:"resourceId"`
	PermissionID uuid.UUID  `bson:"permission_id" json:"permissionId"`
	KeyHash      string     `bson:"key_hash" json:"keyHash"` // sha256 hash of the generated key
	Type         string     `bson:"type" json:"type"` // user_permission | device_permission | temporary
	Status       string     `bson:"status" json:"status"` // active | revoked | expired
	ExpiresAt    *time.Time `bson:"expires_at,omitempty" json:"expiresAt,omitempty"`
	CreatedAt    time.Time  `bson:"created_at" json:"createdAt"`
	RevokedAt    *time.Time `bson:"revoked_at,omitempty" json:"revokedAt,omitempty"`
}
