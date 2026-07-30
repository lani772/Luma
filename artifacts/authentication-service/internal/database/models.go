package database

import (
	"time"

	"github.com/google/uuid"
)

type UserStatus string

const (
	UserStatusActive    UserStatus = "active"
	UserStatusSuspended UserStatus = "suspended"
	UserStatusDeleted   UserStatus = "deleted"
)

type User struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Email         string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	Username      *string    `gorm:"type:varchar(255);uniqueIndex;default:null" json:"username"`
	PasswordHash  string     `gorm:"type:varchar(255);not null" json:"-"`
	Phone         *string    `gorm:"type:varchar(50);default:null" json:"phone"`
	EmailVerified bool       `gorm:"type:boolean;default:false;not null" json:"email_verified"`
	PhoneVerified bool       `gorm:"type:boolean;default:false;not null" json:"phone_verified"`
	Status        UserStatus `gorm:"type:varchar(50);default:'active';not null" json:"status"`
	CreatedAt     time.Time  `gorm:"not null" json:"created_at"`
	UpdatedAt     time.Time  `gorm:"not null" json:"updated_at"`
}

type Credential struct {
	ID                 uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserID             uuid.UUID `gorm:"type:uuid;index;not null"`
	PasswordHash       string    `gorm:"type:varchar(255);not null"`
	LastPasswordChange time.Time `gorm:"not null"`
}

type SessionStatus string

const (
	SessionStatusActive  SessionStatus = "active"
	SessionStatusRevoked SessionStatus = "revoked"
)

type Session struct {
	ID           uuid.UUID     `gorm:"type:uuid;primaryKey" json:"id"`
	UserID       uuid.UUID     `gorm:"type:uuid;index;not null" json:"user_id"`
	DeviceID     string        `gorm:"type:varchar(255);not null" json:"device_id"`
	IPAddress    string        `gorm:"type:varchar(50);not null" json:"ip_address"`
	Browser      string        `gorm:"type:varchar(255)" json:"browser"`
	Location     string        `gorm:"type:varchar(255)" json:"location"`
	CreatedAt    time.Time     `gorm:"not null" json:"created_at"`
	LastActivity time.Time     `gorm:"not null" json:"last_activity"`
	ExpiresAt    time.Time     `gorm:"not null" json:"expires_at"`
	Status       SessionStatus `gorm:"type:varchar(50);default:'active';not null" json:"status"`
}

type RefreshToken struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"`
	SessionID  uuid.UUID `gorm:"type:uuid;index;not null"`
	TokenHash  string    `gorm:"type:varchar(255);uniqueIndex;not null"`
	ExpiresAt  time.Time `gorm:"not null"`
	Revoked    bool      `gorm:"type:boolean;default:false;not null"`
	CreatedAt  time.Time `gorm:"not null"`
}

type EmailVerification struct {
	ID                uuid.UUID  `gorm:"type:uuid;primaryKey"`
	UserID            uuid.UUID  `gorm:"type:uuid;index;not null"`
	MagicLinkHash     *string    `gorm:"type:varchar(255);uniqueIndex;default:null"`
	MagicLinkExpires  *time.Time `gorm:"default:null"`
	MagicLinkVerified bool       `gorm:"type:boolean;default:false;not null"`
	OTPCodeHash       *string    `gorm:"type:varchar(255);default:null"`
	OTPExpires        *time.Time `gorm:"default:null"`
	OTPVerified       bool       `gorm:"type:boolean;default:false;not null"`
	OTPAttempts       int        `gorm:"type:integer;default:0;not null"`
	CreatedAt         time.Time  `gorm:"not null"`
}

type PasswordResetToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;index;not null"`
	TokenHash string    `gorm:"type:varchar(255);uniqueIndex;not null"`
	ExpiresAt time.Time `gorm:"not null"`
	Used      bool      `gorm:"type:boolean;default:false;not null"`
	CreatedAt time.Time `gorm:"not null"`
}

type OAuthAccount struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey"`
	UserID         uuid.UUID `gorm:"type:uuid;index;not null"`
	Provider       string    `gorm:"type:varchar(100);not null"`
	ProviderUserID string    `gorm:"type:varchar(255);not null"`
	Email          string    `gorm:"type:varchar(255);not null"`
	CreatedAt      time.Time `gorm:"not null"`
}

type ServiceAccountStatus string

const (
	ServiceAccountActive    ServiceAccountStatus = "active"
	ServiceAccountSuspended ServiceAccountStatus = "suspended"
)

type ServiceAccount struct {
	ID               uuid.UUID            `gorm:"type:uuid;primaryKey"`
	ServiceName      string               `gorm:"type:varchar(255);not null"`
	ClientID         string               `gorm:"type:varchar(255);uniqueIndex;not null"`
	ClientSecretHash string               `gorm:"type:varchar(255);not null"`
	Status           ServiceAccountStatus `gorm:"type:varchar(50);default:'active';not null"`
	CreatedAt        time.Time            `gorm:"not null"`
}

type AuditLog struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey"`
	UserID      *uuid.UUID `gorm:"type:uuid;index;default:null"`
	EventType   string     `gorm:"type:varchar(100);not null"`
	Description string     `gorm:"type:text;not null"`
	IPAddress   string     `gorm:"type:varchar(50)"`
	UserAgent   string     `gorm:"type:varchar(255)"`
	CreatedAt   time.Time  `gorm:"not null"`
}

type LoginAttempt struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey"`
	Key         string     `gorm:"type:varchar(255);uniqueIndex;not null"` // IP or Email
	Attempts    int        `gorm:"type:integer;default:0;not null"`
	LastAttempt time.Time  `gorm:"not null"`
	LockedUntil *time.Time `gorm:"default:null"`
}
