package entities

import (
	"time"

	"github.com/google/uuid"
)

type RoleAssignment struct {
	ID                uuid.UUID `bson:"_id" json:"id"`
	UserID            uuid.UUID `bson:"user_id" json:"userId"`
	MicrocontrollerID uuid.UUID `bson:"microcontroller_id" json:"microcontrollerId"`
	Role              string    `bson:"role" json:"role"` // owner | administrator | operator | viewer
	AssignedBy        uuid.UUID `bson:"assigned_by" json:"assignedBy"`
	Status            string    `bson:"status" json:"status"` // active | revoked
	CreatedAt         time.Time `bson:"created_at" json:"createdAt"`
	UpdatedAt         time.Time `bson:"updated_at" json:"updatedAt"`
}
