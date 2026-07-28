package models

import (
	"time"

	"github.com/google/uuid"
)

type Scene struct {
	ID        uuid.UUID `gorm:"column:id;primaryKey"`
	OwnerID   uuid.UUID `gorm:"column:owner_id"`
	Name      string    `gorm:"column:name"`
	Actions   JSONList  `gorm:"column:actions"`
	Version   int       `gorm:"column:version"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (Scene) TableName() string { return "scenes" }
