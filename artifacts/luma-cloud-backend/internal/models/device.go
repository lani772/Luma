package models

import (
	"time"

	"github.com/google/uuid"
)

type DeviceStatus string

const (
	DeviceStatusPending        DeviceStatus = "pending"
	DeviceStatusOnline         DeviceStatus = "online"
	DeviceStatusOffline        DeviceStatus = "offline"
	DeviceStatusDecommissioned DeviceStatus = "decommissioned"
)

// Device is the backend's source-of-truth record for a registered
// microcontroller. It intentionally does not store *local automation state*
// (that stays in the mobile Core Engine) — only what the cloud needs to
// identify, authorize, and track the device across phones.
type Device struct {
	ID                uuid.UUID    `bson:"_id"`
	OwnerID           uuid.UUID    `bson:"owner_id"`
	Name              string       `bson:"name"`
	DeviceType        string       `bson:"device_type"`
	MicrocontrollerID string       `bson:"microcontroller_id"`
	MACAddress        string       `bson:"mac_address"`
	FirmwareVersion   *string      `bson:"firmware_version,omitempty"`
	Capabilities      JSONList     `bson:"capabilities"`
	Status            DeviceStatus `bson:"status"`
	RegisteredAt      time.Time    `bson:"registered_at"`
	LastOnlineAt      *time.Time   `bson:"last_online_at,omitempty"`
	LastSyncAt        *time.Time   `bson:"last_sync_at,omitempty"`
	CreatedAt         time.Time    `bson:"created_at"`
	UpdatedAt         time.Time    `bson:"updated_at"`
}

// DeviceAdmin grants a non-owner user admin rights on a device.
type DeviceAdmin struct {
	ID        uuid.UUID  `bson:"_id"`
	DeviceID  uuid.UUID  `bson:"device_id"`
	UserID    uuid.UUID  `bson:"user_id"`
	GrantedBy *uuid.UUID `bson:"granted_by,omitempty"`
	GrantedAt time.Time  `bson:"granted_at"`
}

type DeviceHistoryEventType string

const (
	DeviceEventRegistered           DeviceHistoryEventType = "registered"
	DeviceEventUpdated              DeviceHistoryEventType = "updated"
	DeviceEventOwnershipTransferred DeviceHistoryEventType = "ownership_transferred"
	DeviceEventRemoved              DeviceHistoryEventType = "removed"
	DeviceEventAdminGranted         DeviceHistoryEventType = "admin_granted"
	DeviceEventAdminRevoked         DeviceHistoryEventType = "admin_revoked"
)

// DeviceHistory is the audit trail for device lifecycle events.
type DeviceHistory struct {
	ID          uuid.UUID              `bson:"_id"`
	DeviceID    uuid.UUID              `bson:"device_id"`
	EventType   DeviceHistoryEventType `bson:"event_type"`
	ActorUserID *uuid.UUID             `bson:"actor_user_id,omitempty"`
	Metadata    JSONMap                `bson:"metadata"`
	CreatedAt   time.Time              `bson:"created_at"`
}
