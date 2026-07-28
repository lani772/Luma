package dto

import "time"

type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role"` // Optional: default 'user'
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type TokenResponse struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

type UserResponse struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type DeviceRegisterRequest struct {
	Name string `json:"name" binding:"required"`
}

type DeviceResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	LastSeen  time.Time `json:"lastSeen"`
	CreatedAt time.Time `json:"createdAt"`
}

type PublishRequest struct {
	Topic   string `json:"topic" binding:"required"`
	Payload string `json:"payload" binding:"required"`
	QoS     byte   `json:"qos"`
	Retain  bool   `json:"retain"`
}

type SubscribeRequest struct {
	Topic string `json:"topic" binding:"required"`
	QoS   byte   `json:"qos"`
}

type UnsubscribeRequest struct {
	Topic string `json:"topic" binding:"required"`
}

type DeviceCommandRequest struct {
	Command string `json:"command" binding:"required"`
	QoS     byte   `json:"qos"`
}

type DeviceStatusResponse struct {
	DeviceID string    `json:"deviceId"`
	Status   string    `json:"status"`
	LastSeen time.Time `json:"lastSeen"`
}

type TelemetryDTO struct {
	Topic     string    `json:"topic"`
	Payload   string    `json:"payload"`
	CreatedAt time.Time `json:"createdAt"`
}

type DeviceTelemetryResponse struct {
	DeviceID  string         `json:"deviceId"`
	Telemetry []TelemetryDTO `json:"telemetry"`
}

type BrokerHealthResponse struct {
	Connected bool      `json:"connected"`
	CheckedAt time.Time `json:"checkedAt"`
	Host      string    `json:"host"`
	Port      int       `json:"port"`
	Error     string    `json:"error,omitempty"`
}

type StatsResponse struct {
	ConnectedDevices   int64 `json:"connectedDevices"`
	PublishedMessages  int64 `json:"publishedMessages"`
	ReceivedMessages   int64 `json:"receivedMessages"`
	FailedPublishes    int64 `json:"failedPublishes"`
	ActiveSubscriptions int64 `json:"activeSubscriptions"`
	QueueSize          int64 `json:"queueSize"`
	RetryCount         int64 `json:"retryCount"`
	UptimeSeconds      int64 `json:"uptimeSeconds"`
}

type ConnectionInfo struct {
	ClientID  string    `json:"clientId"`
	Username  string    `json:"username"`
	IPAddress string    `json:"ipAddress"`
	Connected bool      `json:"connected"`
	KeepAlive int       `json:"keepAlive"`
	ConnectedAt time.Time `json:"connectedAt"`
}

type ActiveConnectionsResponse struct {
	Connections []ConnectionInfo `json:"connections"`
}
