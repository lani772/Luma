package dto

type CreateAccessRequest struct {
	ResourceID        string `json:"resourceId" binding:"required"`
	ResourceType      string `json:"resourceType" binding:"required,oneof=microcontroller home room device feature"`
	RequestedRole     string `json:"requestedRole" binding:"required,oneof=administrator operator viewer"`
	RequestedDuration *int   `json:"requestedDuration,omitempty"` // in hours
	Message           string `json:"message"`
}

type RequesterProfileDTO struct {
	ID                 string `json:"id"`
	FullName           string `json:"fullName"`
	Email              string `json:"email"`
	EmailVerified      bool   `json:"emailVerified"`
	PhoneNumber        string `json:"phoneNumber,omitempty"`
	PhoneVerified      bool   `json:"phoneVerified"`
	AccountCreatedAt   string `json:"accountCreatedAt"`
}

type AccessRequestDTO struct {
	ID                string               `json:"id"`
	RequesterID       string               `json:"requesterId"`
	OwnerID           string               `json:"ownerId"`
	ResourceID        string               `json:"resourceId"`
	ResourceType      string               `json:"resourceType"`
	RequestedRole     string               `json:"requestedRole"`
	RequestedDuration *int                 `json:"requestedDuration,omitempty"`
	Message           string               `json:"message,omitempty"`
	Status            string               `json:"status"`
	RequesterProfile  *RequesterProfileDTO `json:"requesterProfile,omitempty"`
	CreatedAt         string               `json:"createdAt"`
	UpdatedAt         string               `json:"updatedAt"`
}
