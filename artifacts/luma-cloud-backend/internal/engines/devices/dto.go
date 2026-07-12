// Package devices implements the Device Registration Engine: the backend is
// the source of truth for which microcontrollers exist, who owns them, and
// who else administers them. It does not talk to devices directly (that is
// the MQTT Adapter Engine's job) — this engine is pure bookkeeping plus
// ownership/history semantics.
package devices

import "time"

type RegisterDeviceRequest struct {
	Name              string   `json:"name" binding:"required"`
	DeviceType        string   `json:"deviceType" binding:"required"`
	MicrocontrollerID string   `json:"microcontrollerId" binding:"required"`
	MACAddress        string   `json:"macAddress" binding:"required,mac"`
	FirmwareVersion   string   `json:"firmwareVersion"`
	Capabilities      []string `json:"capabilities"`
}

type UpdateDeviceRequest struct {
	Name            *string  `json:"name,omitempty"`
	FirmwareVersion *string  `json:"firmwareVersion,omitempty"`
	Capabilities    []string `json:"capabilities,omitempty"`
}

type TransferOwnershipRequest struct {
	NewOwnerEmail string `json:"newOwnerEmail" binding:"required,email"`
}

type GrantAdminRequest struct {
	UserEmail string `json:"userEmail" binding:"required,email"`
}

type DeviceDTO struct {
	ID                string     `json:"id"`
	OwnerID           string     `json:"ownerId"`
	Name              string     `json:"name"`
	DeviceType        string     `json:"deviceType"`
	MicrocontrollerID string     `json:"microcontrollerId"`
	MACAddress        string     `json:"macAddress"`
	FirmwareVersion   *string    `json:"firmwareVersion,omitempty"`
	Capabilities      []any      `json:"capabilities"`
	Status            string     `json:"status"`
	RegisteredAt      time.Time  `json:"registeredAt"`
	LastOnlineAt      *time.Time `json:"lastOnlineAt,omitempty"`
	LastSyncAt        *time.Time `json:"lastSyncAt,omitempty"`
	AdminUserIDs      []string   `json:"adminUserIds"`
}

type DeviceHistoryEntryDTO struct {
	ID          string         `json:"id"`
	EventType   string         `json:"eventType"`
	ActorUserID *string        `json:"actorUserId,omitempty"`
	Metadata    map[string]any `json:"metadata"`
	CreatedAt   time.Time      `json:"createdAt"`
}
