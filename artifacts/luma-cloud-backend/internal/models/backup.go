package models

import (
	"time"

	"github.com/google/uuid"
)

type Backup struct {
	ID          uuid.UUID `bson:"_id"`
	UserID      uuid.UUID `bson:"user_id"`
	StoragePath string    `bson:"storage_path"`
	SizeBytes   int64     `bson:"size_bytes"`
	Checksum    string    `bson:"checksum"`
	CreatedAt   time.Time `bson:"created_at"`
}
