package repository

import (
	"errors"
	"mqtt-service/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GORMUserRepository implements UserRepository using GORM
type GORMUserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &GORMUserRepository{db: db}
}

func (r *GORMUserRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *GORMUserRepository) FindByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.Where("username = ?", username).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *GORMUserRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *GORMUserRepository) FindByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Where("id = ?", id).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

// GORMDeviceRepository implements DeviceRepository using GORM
type GORMDeviceRepository struct {
	db *gorm.DB
}

func NewDeviceRepository(db *gorm.DB) DeviceRepository {
	return &GORMDeviceRepository{db: db}
}

func (r *GORMDeviceRepository) Create(device *models.Device) error {
	return r.db.Create(device).Error
}

func (r *GORMDeviceRepository) FindByID(id uuid.UUID) (*models.Device, error) {
	var device models.Device
	err := r.db.Where("id = ?", id).First(&device).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &device, nil
}

func (r *GORMDeviceRepository) List() ([]models.Device, error) {
	var devices []models.Device
	err := r.db.Find(&devices).Error
	return devices, err
}

func (r *GORMDeviceRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&models.Device{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":    status,
		"last_seen": time.Now(),
	}).Error
}

func (r *GORMDeviceRepository) CreateOwnership(ownership *models.DeviceOwnership) error {
	return r.db.Create(ownership).Error
}

func (r *GORMDeviceRepository) CheckOwnership(userID uuid.UUID, deviceID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.DeviceOwnership{}).
		Where("user_id = ? AND device_id = ?", userID, deviceID).
		Count(&count).Error
	return count > 0, err
}

// GORMCommandRepository implements CommandRepository using GORM
type GORMCommandRepository struct {
	db *gorm.DB
}

func NewCommandRepository(db *gorm.DB) CommandRepository {
	return &GORMCommandRepository{db: db}
}

func (r *GORMCommandRepository) Create(cmd *models.Command) error {
	return r.db.Create(cmd).Error
}

func (r *GORMCommandRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&models.Command{}).Where("id = ?", id).Update("status", status).Error
}

func (r *GORMCommandRepository) MarkAcked(id uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.Command{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":   "acknowledged",
		"acked_at": &now,
	}).Error
}

func (r *GORMCommandRepository) FindByID(id uuid.UUID) (*models.Command, error) {
	var cmd models.Command
	err := r.db.Where("id = ?", id).First(&cmd).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &cmd, nil
}

func (r *GORMCommandRepository) ListByDevice(deviceID uuid.UUID) ([]models.Command, error) {
	var cmds []models.Command
	err := r.db.Where("device_id = ?", deviceID).Order("created_at desc").Find(&cmds).Error
	return cmds, err
}

// GORMTelemetryRepository implements TelemetryRepository using GORM
type GORMTelemetryRepository struct {
	db *gorm.DB
}

func NewTelemetryRepository(db *gorm.DB) TelemetryRepository {
	return &GORMTelemetryRepository{db: db}
}

func (r *GORMTelemetryRepository) Create(telemetry *models.Telemetry) error {
	return r.db.Create(telemetry).Error
}

func (r *GORMTelemetryRepository) ListByDevice(deviceID uuid.UUID, limit int) ([]models.Telemetry, error) {
	var telemetries []models.Telemetry
	err := r.db.Where("device_id = ?", deviceID).Order("created_at desc").Limit(limit).Find(&telemetries).Error
	return telemetries, err
}

// GORMSubscriptionRepository implements SubscriptionRepository using GORM
type GORMSubscriptionRepository struct {
	db *gorm.DB
}

func NewSubscriptionRepository(db *gorm.DB) SubscriptionRepository {
	return &GORMSubscriptionRepository{db: db}
}

func (r *GORMSubscriptionRepository) Create(sub *models.MQTTSubscription) error {
	return r.db.Create(sub).Error
}

func (r *GORMSubscriptionRepository) Delete(clientID string, topic string) error {
	return r.db.Where("client_id = ? AND topic = ?", clientID, topic).Delete(&models.MQTTSubscription{}).Error
}

func (r *GORMSubscriptionRepository) ListActive() ([]models.MQTTSubscription, error) {
	var subs []models.MQTTSubscription
	err := r.db.Find(&subs).Error
	return subs, err
}

// GORMAuditLogRepository implements AuditLogRepository using GORM
type GORMAuditLogRepository struct {
	db *gorm.DB
}

func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	return &GORMAuditLogRepository{db: db}
}

func (r *GORMAuditLogRepository) Create(log *models.AuditLog) error {
	return r.db.Create(log).Error
}

func (r *GORMAuditLogRepository) List(limit int) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	err := r.db.Order("created_at desc").Limit(limit).Find(&logs).Error
	return logs, err
}

// GORMMessageHistoryRepository implements MessageHistoryRepository using GORM
type GORMMessageHistoryRepository struct {
	db *gorm.DB
}

func NewMessageHistoryRepository(db *gorm.DB) MessageHistoryRepository {
	return &GORMMessageHistoryRepository{db: db}
}

func (r *GORMMessageHistoryRepository) Create(msg *models.MessageHistory) error {
	return r.db.Create(msg).Error
}

func (r *GORMMessageHistoryRepository) List(limit int) ([]models.MessageHistory, error) {
	var msgs []models.MessageHistory
	err := r.db.Order("created_at desc").Limit(limit).Find(&msgs).Error
	return msgs, err
}
