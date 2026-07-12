package deployment

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

func (r *Repository) Create(d *models.FirmwareDeployment) error {
	return r.db.Create(d).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*models.FirmwareDeployment, error) {
	var d models.FirmwareDeployment
	err := r.db.Where("id = ?", id).First(&d).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("deployment not found")
		}
		return nil, err
	}
	return &d, nil
}

func (r *Repository) List(page, perPage int) ([]models.FirmwareDeployment, int64, error) {
	var total int64
	if err := r.db.Model(&models.FirmwareDeployment{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var list []models.FirmwareDeployment
	err := r.db.Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *Repository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&models.FirmwareDeployment{}).Where("id = ?", id).Updates(map[string]any{
		"status":     status,
		"updated_at": time.Now(),
	}).Error
}

func (r *Repository) SaveDeviceDeployment(d *models.DeviceDeployment) error {
	return r.db.Save(d).Error
}

func (r *Repository) ListDevicesByDeployment(deploymentID uuid.UUID) ([]models.DeviceDeployment, error) {
	var list []models.DeviceDeployment
	err := r.db.Where("deployment_id = ?", deploymentID).Find(&list).Error
	return list, err
}

func (r *Repository) FindDeviceDeployment(deploymentID, deviceID uuid.UUID) (*models.DeviceDeployment, error) {
	var d models.DeviceDeployment
	err := r.db.Where("deployment_id = ? AND device_id = ?", deploymentID, deviceID).First(&d).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &d, nil
}

func (r *Repository) FindEligibleDevices(deviceType string) ([]models.Device, error) {
	var list []models.Device
	err := r.db.Where("device_type = ? AND status != 'decommissioned'", deviceType).Find(&list).Error
	return list, err
}

func (r *Repository) FindScheduledDeployments() ([]models.FirmwareDeployment, error) {
	var list []models.FirmwareDeployment
	err := r.db.Where("status = ? AND (scheduled_at IS NULL OR scheduled_at <= ?)", "scheduled", time.Now()).Find(&list).Error
	return list, err
}

func (r *Repository) FindRunningDeployments() ([]models.FirmwareDeployment, error) {
	var list []models.FirmwareDeployment
	err := r.db.Where("status = ?", "running").Find(&list).Error
	return list, err
}
