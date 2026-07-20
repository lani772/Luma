package models

import (
	"time"

	"github.com/google/uuid"
)

// AuditAction is the category of action recorded in the audit log.
type AuditAction string

const (
	// User-management actions (performed by admins/owners).
	AuditActionRoleChanged      AuditAction = "user.role_changed"
	AuditActionUserSuspended    AuditAction = "user.suspended"
	AuditActionUserActivated    AuditAction = "user.activated"
	AuditActionUserDeletedAdmin AuditAction = "user.deleted_by_admin"

	// Device permission actions.
	AuditActionDeviceAdminGranted  AuditAction = "device.admin_granted"
	AuditActionDeviceAdminRevoked  AuditAction = "device.admin_revoked"
	AuditActionDeviceOwnerTransfer AuditAction = "device.ownership_transferred"

	// Auth events.
	AuditActionPasswordReset AuditAction = "auth.password_reset"
	AuditActionAccountLocked AuditAction = "auth.account_locked"
)

// AuditLog records every sensitive action for forensic and compliance use.
// It is append-only — no update or delete routes exist for this collection.
type AuditLog struct {
	ID             uuid.UUID   `bson:"_id"`
	ActorUserID    *uuid.UUID  `bson:"actor_user_id,omitempty"` // nil for system actions
	ActorRole      string      `bson:"actor_role,omitempty"`
	TargetUserID   *uuid.UUID  `bson:"target_user_id,omitempty"`
	TargetDeviceID *uuid.UUID  `bson:"target_device_id,omitempty"`
	Action         AuditAction `bson:"action"`
	Details        JSONMap     `bson:"details,omitempty"` // e.g. {"from_role":"member","to_role":"admin"}
	IPAddress      *string     `bson:"ip_address,omitempty"`
	CreatedAt      time.Time   `bson:"created_at"`
}
