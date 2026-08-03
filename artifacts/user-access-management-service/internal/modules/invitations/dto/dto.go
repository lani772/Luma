package dto

type CreateInvitationRequest struct {
	RecipientEmail  string `json:"recipientEmail" binding:"required,email"`
	RecipientPhone  string `json:"recipientPhone"`
	ResourceID      string `json:"resourceId" binding:"required"`
	ResourceType    string `json:"resourceType" binding:"required,oneof=microcontroller home room device feature"`
	PermissionLevel string `json:"permissionLevel" binding:"required,oneof=owner administrator operator viewer"`
	PersonalMessage string `json:"personalMessage"`
}

type InvitationDTO struct {
	ID              string `json:"id"`
	SenderID        string `json:"senderId"`
	RecipientEmail  string `json:"recipientEmail"`
	RecipientPhone  string `json:"recipientPhone,omitempty"`
	ResourceID      string `json:"resourceId"`
	ResourceType    string `json:"resourceType"`
	PermissionLevel string `json:"permissionLevel"`
	PersonalMessage string `json:"personalMessage,omitempty"`
	Status          string `json:"status"`
	ExpiresAt       string `json:"expiresAt"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}
