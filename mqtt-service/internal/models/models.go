package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	Username     string    `gorm:"size:255;not null;unique;index"`
	Email        string    `gorm:"size:255;not null;unique"`
	PasswordHash string    `gorm:"size:255;not null"`
	Role         string    `gorm:"size:50;not null;default:'user'"` // 'owner', 'admin', 'user'
	CreatedAt    time.Time `gorm:"autoCreateTime"`
	UpdatedAt    time.Time `gorm:"autoUpdateTime"`
}

type Device struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name      string    `gorm:"size:255;not null"`
	Status    string    `gorm:"size:50;not null;default:'offline'"` // 'online', 'offline'
	LastSeen  time.Time `gorm:"default:CURRENT_TIMESTAMP"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

type DeviceOwnership struct {
	ID        uint      `gorm:"primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index"`
	DeviceID  uuid.UUID `gorm:"type:uuid;not null;index"`
	Role      string    `gorm:"size:50;not null;default:'owner'"` // 'owner', 'admin', 'user'
	CreatedAt time.Time `gorm:"autoCreateTime"`
}

type Command struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"`
	DeviceID   uuid.UUID  `gorm:"type:uuid;not null;index"`
	Payload    string     `gorm:"type:text;not null"`
	QoS        byte       `gorm:"not null"`
	Status     string     `gorm:"size:50;not null;default:'pending'"` // 'pending', 'sent', 'acknowledged', 'failed'
	SentAt     time.Time  `gorm:"autoCreateTime"`
	AckedAt    *time.Time `gorm:"index"`
	CreatedAt  time.Time  `gorm:"autoCreateTime"`
	UpdatedAt  time.Time  `gorm:"autoUpdateTime"`
}

type Telemetry struct {
	ID        uint      `gorm:"primaryKey"`
	DeviceID  uuid.UUID `gorm:"type:uuid;not null;index"`
	Topic     string    `gorm:"size:255;not null;index"`
	Payload   string    `gorm:"type:text;not null"`
	CreatedAt time.Time `gorm:"autoCreateTime;index"`
}

type MQTTSubscription struct {
	ID        uint      `gorm:"primaryKey"`
	ClientID  string    `gorm:"size:255;not null;index"`
	Topic     string    `gorm:"size:255;not null;index"`
	QoS       byte      `gorm:"not null"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
}

type AuditLog struct {
	ID        uint      `gorm:"primaryKey"`
	UserID    string    `gorm:"size:255;index"` // can be user ID or service name
	Action    string    `gorm:"size:255;not null"`
	Details   string    `gorm:"type:text"`
	CreatedAt time.Time `gorm:"autoCreateTime;index"`
}

type MessageHistory struct {
	ID        uint      `gorm:"primaryKey"`
	Topic     string    `gorm:"size:255;not null;index"`
	Payload   string    `gorm:"type:text;not null"`
	QoS       byte      `gorm:"not null"`
	Direction string    `gorm:"size:10;not null"` // "inbound", "outbound"
	CreatedAt time.Time `gorm:"autoCreateTime;index"`
}
