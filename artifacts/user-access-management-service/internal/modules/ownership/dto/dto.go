package dto

type RequestTransferRequest struct {
	MicrocontrollerID string `json:"microcontrollerId" binding:"required"`
	NewOwnerEmail     string `json:"newOwnerEmail" binding:"required,email"`
	Reason            string `json:"reason"`
}

type AcceptTransferRequest struct {
	TransferID string `json:"transferId" binding:"required"`
}

type RejectTransferRequest struct {
	TransferID string `json:"transferId" binding:"required"`
}

type OwnershipTransferDTO struct {
	ID                string `json:"id"`
	MicrocontrollerID string `json:"microcontrollerId"`
	CurrentOwnerID    string `json:"currentOwnerId"`
	NewOwnerEmail     string `json:"newOwnerEmail"`
	Status            string `json:"status"`
	Reason            string `json:"reason,omitempty"`
	CreatedAt         string `json:"createdAt"`
	UpdatedAt         string `json:"updatedAt"`
}
