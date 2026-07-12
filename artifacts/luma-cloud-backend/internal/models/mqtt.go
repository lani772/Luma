package models

import (
	"time"

	"github.com/google/uuid"
)

// MQTTDeviceIdentity is a scoped credential the backend issues to a specific
// device so it can authenticate to whichever broker is currently deployed.
// The backend never hands out its own broker admin credentials.
type MQTTDeviceIdentity struct {
	ID             uuid.UUID  `gorm:"column:id;primaryKey"`
	DeviceID       uuid.UUID  `gorm:"column:device_id"`
	MQTTClientID   string     `gorm:"column:mqtt_client_id"`
	MQTTUsername   string     `gorm:"column:mqtt_username"`
	CredentialHash string     `gorm:"column:credential_hash"`
	IssuedAt       time.Time  `gorm:"column:issued_at"`
	ExpiresAt      time.Time  `gorm:"column:expires_at"`
	RevokedAt      *time.Time `gorm:"column:revoked_at"`
}

func (MQTTDeviceIdentity) TableName() string { return "mqtt_device_identities" }
