// Package models holds the MongoDB document structs for every LUMA collection.
// Fields are tagged with bson:"..." for MongoDB serialization. There are no
// GORM tags, AutoMigrate calls, or SQL migration files — schema constraints
// live in internal/storage/database/indexes.go (EnsureIndexes).
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
	ID               uuid.UUID  `bson:"_id"`
	Email            string     `bson:"email"`
	Username         *string    `bson:"username,omitempty"`
	PasswordHash     string     `bson:"password_hash"`
	FullName         string     `bson:"full_name"`
	Role             UserRole   `bson:"role"`
	Status           UserStatus `bson:"status"`
	EmailVerifiedAt  *time.Time `bson:"email_verified_at,omitempty"`
	SubscriptionTier string     `bson:"subscription_tier"`
	Preferences      JSONMap    `bson:"preferences"`
	CreatedAt        time.Time  `bson:"created_at"`
	UpdatedAt        time.Time  `bson:"updated_at"`
}

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
	ID           uuid.UUID  `bson:"_id"`
	UserID       uuid.UUID  `bson:"user_id"`
	DeviceName   string     `bson:"device_name"`
	Platform     Platform   `bson:"platform"`
	PushToken    *string    `bson:"push_token,omitempty"`
	PushProvider *string    `bson:"push_provider,omitempty"`
	AppVersion   *string    `bson:"app_version,omitempty"`
	LastSeenAt   *time.Time `bson:"last_seen_at,omitempty"`
	CreatedAt    time.Time  `bson:"created_at"`
	RevokedAt    *time.Time `bson:"revoked_at,omitempty"`
}

// Session is one refresh-token lineage, scoped to a single phone. Revoking a
// session logs the phone out without touching the user's other phones.
type Session struct {
	ID               uuid.UUID  `bson:"_id"`
	UserID           uuid.UUID  `bson:"user_id"`
	PhoneID          *uuid.UUID `bson:"phone_id,omitempty"`
	RefreshTokenHash string     `bson:"refresh_token_hash"`
	UserAgent        *string    `bson:"user_agent,omitempty"`
	IPAddress        *string    `bson:"ip_address,omitempty"`
	ExpiresAt        time.Time  `bson:"expires_at"`
	RevokedAt        *time.Time `bson:"revoked_at,omitempty"`
	CreatedAt        time.Time  `bson:"created_at"`
}

type PasswordResetToken struct {
	ID        uuid.UUID  `bson:"_id"`
	UserID    uuid.UUID  `bson:"user_id"`
	TokenHash string     `bson:"token_hash"`
	ExpiresAt time.Time  `bson:"expires_at"`
	UsedAt    *time.Time `bson:"used_at,omitempty"`
	CreatedAt time.Time  `bson:"created_at"`
}

type EmailVerificationToken struct {
	ID        uuid.UUID  `bson:"_id"`
	UserID    uuid.UUID  `bson:"user_id"`
	TokenHash string     `bson:"token_hash"`
	ExpiresAt time.Time  `bson:"expires_at"`
	UsedAt    *time.Time `bson:"used_at,omitempty"`
	CreatedAt time.Time  `bson:"created_at"`
}
