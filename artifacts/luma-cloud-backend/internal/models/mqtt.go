package models

import (
	"time"

	"github.com/google/uuid"
)

// MQTTDeviceIdentity is a scoped credential the backend issues to a specific
// device so it can authenticate to whichever broker is currently deployed.
// The backend never hands out its own broker admin credentials.
type MQTTDeviceIdentity struct {
	ID             uuid.UUID  `bson:"_id"`
	DeviceID       uuid.UUID  `bson:"device_id"`
	MQTTClientID   string     `bson:"mqtt_client_id"`
	MQTTUsername   string     `bson:"mqtt_username"`
	CredentialHash string     `bson:"credential_hash"`
	IssuedAt       time.Time  `bson:"issued_at"`
	ExpiresAt      time.Time  `bson:"expires_at"`
	RevokedAt      *time.Time `bson:"revoked_at,omitempty"`
}
