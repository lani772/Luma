package entities

import (
	"time"

	"github.com/google/uuid"
)

type AuditLog struct {
	ID             uuid.UUID `bson:"_id" json:"id"`
	ActorUserID    uuid.UUID `bson:"actor_user_id" json:"actorUserId"`
	Action         string    `bson:"action" json:"action"`
	ResourceType   string    `bson:"resource_type" json:"resourceType"`
	ResourceID     string    `bson:"resource_id" json:"resourceId"`
	Metadata       any       `bson:"metadata" json:"metadata"`
	IPAddress      string    `bson:"ip_address" json:"ipAddress"`
	CreatedAt      time.Time `bson:"created_at" json:"createdAt"`
}
