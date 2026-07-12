package models

import (
	"time"

	"github.com/google/uuid"
)

type Backup struct {
	ID          uuid.UUID `gorm:"column:id;primaryKey"`
	UserID      uuid.UUID `gorm:"column:user_id"`
	StoragePath string    `gorm:"column:storage_path"`
	SizeBytes   int64     `gorm:"column:size_bytes"`
	Checksum    string    `gorm:"column:checksum"`
	CreatedAt   time.Time `gorm:"column:created_at"`
}

func (Backup) TableName() string { return "backups" }
