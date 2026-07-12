// Package users implements the User Engine: profile, account settings,
// preferences, subscription tier, roles, and (via the Device Registration
// Engine) an at-a-glance view of device ownership. Authentication itself —
// registration, login, sessions, tokens — lives in internal/engines/auth;
// this engine only manages the account once it exists.
package users

import "time"

type UpdateProfileRequest struct {
	FullName *string `json:"fullName,omitempty"`
}

type UpdatePreferencesRequest struct {
	Preferences map[string]any `json:"preferences" binding:"required"`
}

type PhoneDTO struct {
	ID         string     `json:"id"`
	DeviceName string     `json:"deviceName"`
	Platform   string     `json:"platform"`
	LastSeenAt *time.Time `json:"lastSeenAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type AccountDTO struct {
	ID               string         `json:"id"`
	Email            string         `json:"email"`
	FullName         string         `json:"fullName"`
	Role             string         `json:"role"`
	SubscriptionTier string         `json:"subscriptionTier"`
	Preferences      map[string]any `json:"preferences"`
	EmailVerified    bool           `json:"emailVerified"`
	CreatedAt        time.Time      `json:"createdAt"`
}

type OwnedDeviceSummaryDTO struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	DeviceType string `json:"deviceType"`
	Status     string `json:"status"`
	Role       string `json:"role"` // "owner" | "admin"
}
