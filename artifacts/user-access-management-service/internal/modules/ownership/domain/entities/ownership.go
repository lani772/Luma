package entities

import (
	"time"

	"github.com/google/uuid"
)

type OwnershipTransfer struct {
	ID                uuid.UUID `bson:"_id" json:"id"`
	MicrocontrollerID uuid.UUID `bson:"microcontroller_id" json:"microcontrollerId"`
	CurrentOwnerID    uuid.UUID `bson:"current_owner_id" json:"currentOwnerId"`
	NewOwnerEmail     string    `bson:"new_owner_email" json:"newOwnerEmail"`
	Status            string    `bson:"status" json:"status"` // pending | accepted | rejected | cancelled
	Reason            string    `bson:"reason" json:"reason"`
	CreatedAt         time.Time `bson:"created_at" json:"createdAt"`
	UpdatedAt         time.Time `bson:"updated_at" json:"updatedAt"`
}
