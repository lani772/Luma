package audit

import "time"

type CreateAuditLogRequest struct {
	ActorUserID  *string        `json:"actorUserId,omitempty"`
	Action       string         `json:"action" binding:"required"`
	ResourceType string         `json:"resourceType" binding:"required"`
	ResourceID   *string        `json:"resourceId,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
	IPAddress    *string        `json:"ipAddress,omitempty"`
}

type AuditLogDTO struct {
	ID           string         `json:"id"`
	ActorUserID  *string        `json:"actorUserId,omitempty"`
	Action       string         `json:"action"`
	ResourceType string         `json:"resourceType"`
	ResourceID   *string        `json:"resourceId,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
	IPAddress    *string        `json:"ipAddress,omitempty"`
	CreatedAt    time.Time      `json:"createdAt"`
}
