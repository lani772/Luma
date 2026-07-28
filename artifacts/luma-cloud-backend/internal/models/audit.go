package models

import (
	"time"

	"github.com/google/uuid"
)

type AuditLog struct {
	ID           uuid.UUID  `gorm:"column:id;primaryKey"`
	ActorUserID  *uuid.UUID `gorm:"column:actor_user_id"`
	Action       string     `gorm:"column:action"`
	ResourceType string     `gorm:"column:resource_type"`
	ResourceID   *string    `gorm:"column:resource_id"`
	Metadata     JSONMap    `gorm:"column:metadata"`
	IPAddress    *string    `gorm:"column:ip_address"`
	CreatedAt    time.Time  `gorm:"column:created_at"`
}

func (AuditLog) TableName() string { return "audit_logs" }
