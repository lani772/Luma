package auth

import "time"

type RegisterRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=8"`
	FullName   string `json:"fullName" binding:"required"`
	DeviceName string `json:"deviceName" binding:"required"`
	Platform   string `json:"platform" binding:"required,oneof=ios android web other"`
}

type LoginRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
	DeviceName string `json:"deviceName" binding:"required"`
	Platform   string `json:"platform" binding:"required,oneof=ios android web other"`
	PushToken  string `json:"pushToken"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type RequestPasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ConfirmPasswordResetRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"newPassword" binding:"required,min=8"`
}

type ConfirmEmailVerificationRequest struct {
	Token string `json:"token" binding:"required"`
}

type AuthResponse struct {
	AccessToken           string    `json:"accessToken"`
	AccessTokenExpiresAt  time.Time `json:"accessTokenExpiresAt"`
	RefreshToken          string    `json:"refreshToken"`
	RefreshTokenExpiresAt time.Time `json:"refreshTokenExpiresAt"`
	User                  UserDTO   `json:"user"`
	SessionID             string    `json:"sessionId"`
}

type UserDTO struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	FullName        string     `json:"fullName"`
	Role            string     `json:"role"`
	EmailVerified   bool       `json:"emailVerified"`
	SubscriptionTier string    `json:"subscriptionTier"`
	CreatedAt       time.Time  `json:"createdAt"`
}

type SessionDTO struct {
	ID         string     `json:"id"`
	DeviceName string     `json:"deviceName"`
	Platform   string     `json:"platform"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastSeenAt *time.Time `json:"lastSeenAt,omitempty"`
	IsCurrent  bool       `json:"isCurrent"`
}
