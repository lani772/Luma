package health

import (
	"errors"
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

func (r *Repository) SaveReport(rep *models.DeviceHealthReport) error {
	return r.db.Create(rep).Error
}

func (r *Repository) UpdateDeviceStatus(deviceID uuid.UUID, status string, lastOnline *time.Time) error {
	updates := map[string]any{
		"status":     status,
		"updated_at": time.Now(),
	}
	if lastOnline != nil {
		updates["last_online_at"] = *lastOnline
	}
	return r.db.Model(&models.Device{}).Where("id = ?", deviceID).Updates(updates).Error
}

func (r *Repository) FindLatestReport(deviceID uuid.UUID) (*models.DeviceHealthReport, error) {
	var rep models.DeviceHealthReport
	err := r.db.Where("device_id = ?", deviceID).Order("created_at DESC").First(&rep).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rep, nil
}

func (r *Repository) ListReports(deviceID uuid.UUID, limit int) ([]models.DeviceHealthReport, error) {
	var list []models.DeviceHealthReport
	err := r.db.Where("device_id = ?", deviceID).Order("created_at DESC").Limit(limit).Find(&list).Error
	return list, err
}

func (r *Repository) ListAllDevices() ([]models.Device, error) {
	var list []models.Device
	err := r.db.Find(&list).Error
	return list, err
}
