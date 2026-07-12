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
	ID                 uuid.UUID    `gorm:"column:id;primaryKey"`
	OwnerID            uuid.UUID    `gorm:"column:owner_id"`
	Name               string       `gorm:"column:name"`
	DeviceType         string       `gorm:"column:device_type"`
	MicrocontrollerID  string       `gorm:"column:microcontroller_id"`
	MACAddress         string       `gorm:"column:mac_address"`
	FirmwareVersion    *string      `gorm:"column:firmware_version"`
	Capabilities       JSONList     `gorm:"column:capabilities"`
	Status             DeviceStatus `gorm:"column:status"`
	RegisteredAt       time.Time    `gorm:"column:registered_at"`
	LastOnlineAt       *time.Time   `gorm:"column:last_online_at"`
	LastSyncAt         *time.Time   `gorm:"column:last_sync_at"`
	CreatedAt          time.Time    `gorm:"column:created_at"`
	UpdatedAt          time.Time    `gorm:"column:updated_at"`
}

func (Device) TableName() string { return "devices" }

// DeviceAdmin grants a non-owner user admin rights on a device.
type DeviceAdmin struct {
	DeviceID  uuid.UUID  `gorm:"column:device_id;primaryKey"`
	UserID    uuid.UUID  `gorm:"column:user_id;primaryKey"`
	GrantedBy *uuid.UUID `gorm:"column:granted_by"`
	GrantedAt time.Time  `gorm:"column:granted_at"`
}

func (DeviceAdmin) TableName() string { return "device_admins" }

type DeviceHistoryEventType string

const (
	DeviceEventRegistered            DeviceHistoryEventType = "registered"
	DeviceEventUpdated               DeviceHistoryEventType = "updated"
	DeviceEventOwnershipTransferred  DeviceHistoryEventType = "ownership_transferred"
	DeviceEventRemoved               DeviceHistoryEventType = "removed"
	DeviceEventAdminGranted          DeviceHistoryEventType = "admin_granted"
	DeviceEventAdminRevoked          DeviceHistoryEventType = "admin_revoked"
)

// DeviceHistory is the audit trail backing the "device history" requirement
// of the Device Registration Engine (separate from the global audit_logs
// table, which spans every engine).
type DeviceHistory struct {
	ID          uuid.UUID              `gorm:"column:id;primaryKey"`
	DeviceID    uuid.UUID              `gorm:"column:device_id"`
	EventType   DeviceHistoryEventType `gorm:"column:event_type"`
	ActorUserID *uuid.UUID             `gorm:"column:actor_user_id"`
	Metadata    JSONMap                `gorm:"column:metadata"`
	CreatedAt   time.Time              `gorm:"column:created_at"`
}

func (DeviceHistory) TableName() string { return "device_history" }
