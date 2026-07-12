package backup

import "time"

type CreateBackupRequest struct {
	// Optional description
	Description string `json:"description"`
}

type RestoreBackupRequest struct {
	TargetType string `json:"targetType" binding:"required,oneof=all home room controller"`
	TargetID   string `json:"targetId"`
}

type BackupDTO struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	StoragePath string    `json:"storagePath"`
	SizeBytes   int64     `json:"sizeBytes"`
	Checksum    string    `json:"checksum"`
	CreatedAt   time.Time `json:"createdAt"`
}
