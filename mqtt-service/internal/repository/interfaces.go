package repository

import (
	"mqtt-service/internal/models"

	"github.com/google/uuid"
)

type UserRepository interface {
	Create(user *models.User) error
	FindByUsername(username string) (*models.User, error)
	FindByEmail(email string) (*models.User, error)
	FindByID(id uuid.UUID) (*models.User, error)
}

type DeviceRepository interface {
	Create(device *models.Device) error
	FindByID(id uuid.UUID) (*models.Device, error)
	List() ([]models.Device, error)
	UpdateStatus(id uuid.UUID, status string) error
	CreateOwnership(ownership *models.DeviceOwnership) error
	CheckOwnership(userID uuid.UUID, deviceID uuid.UUID) (bool, error)
}

type CommandRepository interface {
	Create(cmd *models.Command) error
	UpdateStatus(id uuid.UUID, status string) error
	MarkAcked(id uuid.UUID) error
	FindByID(id uuid.UUID) (*models.Command, error)
	ListByDevice(deviceID uuid.UUID) ([]models.Command, error)
}

type TelemetryRepository interface {
	Create(telemetry *models.Telemetry) error
	ListByDevice(deviceID uuid.UUID, limit int) ([]models.Telemetry, error)
}

type SubscriptionRepository interface {
	Create(sub *models.MQTTSubscription) error
	Delete(clientID string, topic string) error
	ListActive() ([]models.MQTTSubscription, error)
}

type AuditLogRepository interface {
	Create(log *models.AuditLog) error
	List(limit int) ([]models.AuditLog, error)
}

type MessageHistoryRepository interface {
	Create(msg *models.MessageHistory) error
	List(limit int) ([]models.MessageHistory, error)
}
