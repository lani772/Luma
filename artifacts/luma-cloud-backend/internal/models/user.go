// Package models holds the GORM row structs mirroring migrations/*.sql.
// These are query-mapping structs, not a source of schema truth: schema
// changes always start with a new migration file, never GORM AutoMigrate.
package models

import (
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	RoleOwner  UserRole = "owner"
	RoleAdmin  UserRole = "admin"
	RoleMember UserRole = "member"
	RoleViewer UserRole = "viewer"
)

type UserStatus string

const (
	UserStatusActive    UserStatus = "active"
	UserStatusSuspended UserStatus = "suspended"
	UserStatusDeleted   UserStatus = "deleted"
)

type User struct {
	ID                uuid.UUID  `gorm:"column:id;primaryKey"`
	Email             string     `gorm:"column:email"`
	Username          *string    `gorm:"column:username;uniqueIndex"`
	PasswordHash      string     `gorm:"column:password_hash"`
	FullName          string     `gorm:"column:full_name"`
	Role              UserRole   `gorm:"column:role"`
	Status            UserStatus `gorm:"column:status"`
	EmailVerifiedAt   *time.Time `gorm:"column:email_verified_at"`
	SubscriptionTier  string     `gorm:"column:subscription_tier"`
	Preferences       JSONMap    `gorm:"column:preferences"`
	CreatedAt         time.Time  `gorm:"column:created_at"`
	UpdatedAt         time.Time  `gorm:"column:updated_at"`
}

func (User) TableName() string { return "users" }

type Platform string

const (
	PlatformIOS     Platform = "ios"
	PlatformAndroid Platform = "android"
	PlatformWeb     Platform = "web"
	PlatformOther   Platform = "other"
)

// UserPhone represents one of the "multiple phones" a user can be logged in
// from simultaneously — each gets its own session lineage and push token.
type UserPhone struct {
	ID           uuid.UUID  `gorm:"column:id;primaryKey"`
	UserID       uuid.UUID  `gorm:"column:user_id"`
	DeviceName   string     `gorm:"column:device_name"`
	Platform     Platform   `gorm:"column:platform"`
	PushToken    *string    `gorm:"column:push_token"`
	PushProvider *string    `gorm:"column:push_provider"`
	AppVersion   *string    `gorm:"column:app_version"`
	LastSeenAt   *time.Time `gorm:"column:last_seen_at"`
	CreatedAt    time.Time  `gorm:"column:created_at"`
	RevokedAt    *time.Time `gorm:"column:revoked_at"`
}

func (UserPhone) TableName() string { return "user_phones" }

// Session is one refresh-token lineage, scoped to a single phone. Revoking a
// session logs the phone out without touching the user's other phones.
type Session struct {
	ID                uuid.UUID  `gorm:"column:id;primaryKey"`
	UserID            uuid.UUID  `gorm:"column:user_id"`
	PhoneID           *uuid.UUID `gorm:"column:phone_id"`
	RefreshTokenHash  string     `gorm:"column:refresh_token_hash"`
	UserAgent         *string    `gorm:"column:user_agent"`
	IPAddress         *string    `gorm:"column:ip_address"`
	ExpiresAt         time.Time  `gorm:"column:expires_at"`
	RevokedAt         *time.Time `gorm:"column:revoked_at"`
	CreatedAt         time.Time  `gorm:"column:created_at"`
}

func (Session) TableName() string { return "sessions" }

type PasswordResetToken struct {
	ID        uuid.UUID  `gorm:"column:id;primaryKey"`
	UserID    uuid.UUID  `gorm:"column:user_id"`
	TokenHash string     `gorm:"column:token_hash"`
	ExpiresAt time.Time  `gorm:"column:expires_at"`
	UsedAt    *time.Time `gorm:"column:used_at"`
	CreatedAt time.Time  `gorm:"column:created_at"`
}

func (PasswordResetToken) TableName() string { return "password_reset_tokens" }

type EmailVerificationToken struct {
	ID        uuid.UUID  `gorm:"column:id;primaryKey"`
	UserID    uuid.UUID  `gorm:"column:user_id"`
	TokenHash string     `gorm:"column:token_hash"`
	ExpiresAt time.Time  `gorm:"column:expires_at"`
	UsedAt    *time.Time `gorm:"column:used_at"`
	CreatedAt time.Time  `gorm:"column:created_at"`
}

func (EmailVerificationToken) TableName() string { return "email_verification_tokens" }
