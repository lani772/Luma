package entities

import (
	"time"

	"github.com/google/uuid"
)

type Permission struct {
	ID                uuid.UUID  `bson:"_id" json:"id"`
	UserID            uuid.UUID  `bson:"user_id" json:"userId"`
	MicrocontrollerID uuid.UUID  `bson:"microcontroller_id" json:"microcontrollerId"`
	ResourceID        string     `bson:"resource_id" json:"resourceId"` // can be controller ID, room ID, device ID, feature name
	ResourceType      string     `bson:"resource_type" json:"resourceType"` // microcontroller | home | room | device | feature
	AllowedActions    []string   `bson:"allowed_actions" json:"allowedActions"` // view, control, configure, schedule, share, manage, firmware
	GrantedBy         uuid.UUID  `bson:"granted_by" json:"grantedBy"`
	RoleSource        string     `bson:"role_source" json:"roleSource"` // owner | administrator | operator | viewer
	Status            string     `bson:"status" json:"status"` // active | expired | revoked
	Temporary         bool       `bson:"temporary" json:"temporary"`
	StartTime         *time.Time `bson:"start_time,omitempty" json:"startTime,omitempty"`
	EndTime           *time.Time `bson:"end_time,omitempty" json:"endTime,omitempty"`
	CreatedAt         time.Time  `bson:"created_at" json:"createdAt"`
	UpdatedAt         time.Time  `bson:"updated_at" json:"updatedAt"`
}
