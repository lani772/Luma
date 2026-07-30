package dto

type ValidateKeyRequest struct {
	Key        string `json:"key" binding:"required"`
	ResourceID string `json:"resourceId" binding:"required"`
}

type ValidateKeyResponse struct {
	Valid  bool   `json:"valid"`
	UserID string `json:"userId,omitempty"`
}

type PermissionKeyDTO struct {
	ID           string  `json:"id"`
	UserID       string  `json:"userId"`
	ResourceID   string  `json:"resourceId"`
	PermissionID string  `json:"permissionId"`
	KeyHash      string  `json:"keyHash"`
	Type         string  `json:"type"`
	Status       string  `json:"status"`
	ExpiresAt    *string `json:"expiresAt,omitempty"`
	CreatedAt    string  `json:"createdAt"`
}
