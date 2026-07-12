package mqtt

import (
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Upsert(identity *models.MQTTDeviceIdentity) error {
	// A device gets at most one active identity: revoke any prior one before
	// issuing a new one, so rotated credentials can't both be valid at once.
	if err := r.db.Model(&models.MQTTDeviceIdentity{}).
		Where("device_id = ? AND revoked_at IS NULL", identity.DeviceID).
		Update("revoked_at", time.Now()).Error; err != nil {
		return err
	}
	return r.db.Create(identity).Error
}

func (r *Repository) FindActiveByDevice(deviceID uuid.UUID) (*models.MQTTDeviceIdentity, error) {
	var identity models.MQTTDeviceIdentity
	err := r.db.Where("device_id = ? AND revoked_at IS NULL", deviceID).First(&identity).Error
	if err != nil {
		return nil, err
	}
	return &identity, nil
}

func (r *Repository) Revoke(deviceID uuid.UUID) error {
	return r.db.Model(&models.MQTTDeviceIdentity{}).
		Where("device_id = ? AND revoked_at IS NULL", deviceID).
		Update("revoked_at", time.Now()).Error
}
