package dto

type AssignRoleRequest struct {
	UserID            string `json:"userId" binding:"required"`
	MicrocontrollerID string `json:"microcontrollerId" binding:"required"`
	Role              string `json:"role" binding:"required,oneof=owner administrator operator viewer"`
}

type UpdateRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=owner administrator operator viewer"`
}

type RoleDTO struct {
	ID                string `json:"id"`
	UserID            string `json:"userId"`
	MicrocontrollerID string `json:"microcontrollerId"`
	Role              string `json:"role"`
	AssignedBy        string `json:"assignedBy"`
	Status            string `json:"status"`
	CreatedAt         string `json:"createdAt"`
	UpdatedAt         string `json:"updatedAt"`
}
