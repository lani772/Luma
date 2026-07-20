// Package admin implements the Admin Engine: owner-only routes for listing
// all users, changing roles, suspending/activating accounts, and viewing the
// audit log. Only users with role "owner" can reach any route in this engine.
package admin

import "time"

// --- request types ---

type UpdateRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=owner admin member viewer"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active suspended"`
}

// --- response types ---

type UserSummaryDTO struct {
	ID               string     `json:"id"`
	Email            string     `json:"email"`
	Username         string     `json:"username,omitempty"`
	FullName         string     `json:"fullName"`
	Role             string     `json:"role"`
	Status           string     `json:"status"`
	SubscriptionTier string     `json:"subscriptionTier"`
	EmailVerified    bool       `json:"emailVerified"`
	CreatedAt        time.Time  `json:"createdAt"`
	LastSeenAt       *time.Time `json:"lastSeenAt,omitempty"` // from most recent session
}

type AuditLogEntryDTO struct {
	ID             string         `json:"id"`
	ActorUserID    *string        `json:"actorUserId,omitempty"`
	ActorRole      string         `json:"actorRole,omitempty"`
	TargetUserID   *string        `json:"targetUserId,omitempty"`
	TargetDeviceID *string        `json:"targetDeviceId,omitempty"`
	Action         string         `json:"action"`
	Details        map[string]any `json:"details,omitempty"`
	IPAddress      *string        `json:"ipAddress,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
}
