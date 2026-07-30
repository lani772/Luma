package dto

type GrantPermissionRequest struct {
	UserID            string   `json:"userId" binding:"required"`
	MicrocontrollerID string   `json:"microcontrollerId" binding:"required"`
	ResourceID        string   `json:"resourceId" binding:"required"`
	ResourceType      string   `json:"resourceType" binding:"required,oneof=microcontroller home room device feature"`
	AllowedActions    []string `json:"allowedActions" binding:"required,gt=0"`
	Temporary         bool     `json:"temporary"`
	StartTime         *string  `json:"startTime,omitempty"` // RFC3339 format
	EndTime           *string  `json:"endTime,omitempty"`   // RFC3339 format
}

type CheckPermissionRequest struct {
	UserID            string `json:"userId" binding:"required"`
	MicrocontrollerID string `json:"microcontrollerId" binding:"required"`
	ResourceID        string `json:"resourceId" binding:"required"`
	ResourceType      string `json:"resourceType" binding:"required,oneof=microcontroller home room device feature"`
	Action            string `json:"action" binding:"required"`
}

type CheckPermissionResponse struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason,omitempty"`
}

type PermissionDTO struct {
	ID                string   `json:"id"`
	UserID            string   `json:"userId"`
	MicrocontrollerID string   `json:"microcontrollerId"`
	ResourceID        string   `json:"resourceId"`
	ResourceType      string   `json:"resourceType"`
	AllowedActions    []string `json:"allowedActions"`
	GrantedBy         string   `json:"grantedBy"`
	RoleSource        string   `json:"roleSource"`
	Status            string   `json:"status"`
	Temporary         bool     `json:"temporary"`
	StartTime         *string  `json:"startTime,omitempty"`
	EndTime           *string  `json:"endTime,omitempty"`
	CreatedAt         string   `json:"createdAt"`
	UpdatedAt         string   `json:"updatedAt"`
}
