package firmware

import (
	"errors"

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

func (r *Repository) Create(f *models.FirmwareRelease) error {
	return r.db.Create(f).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*models.FirmwareRelease, error) {
	var f models.FirmwareRelease
	err := r.db.Where("id = ?", id).First(&f).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("firmware release not found")
		}
		return nil, err
	}
	return &f, nil
}

func (r *Repository) FindByVersion(deviceType, version string) (*models.FirmwareRelease, error) {
	var f models.FirmwareRelease
	err := r.db.Where("device_type = ? AND version = ?", deviceType, version).First(&f).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &f, nil
}

func (r *Repository) FindLatest(deviceType, channel string) (*models.FirmwareRelease, error) {
	var f models.FirmwareRelease
	// Version is compared using semver in service, but we order by created_at DESC or version string sorting
	// To be simple, we pull the latest created_at or we will fetch all and compare in service. Let's filter by channel.
	err := r.db.Where("device_type = ? AND channel = ?", deviceType, channel).Order("created_at DESC").First(&f).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &f, nil
}

func (r *Repository) List(deviceType string, channel string, page, perPage int) ([]models.FirmwareRelease, int64, error) {
	query := r.db.Model(&models.FirmwareRelease{})
	if deviceType != "" {
		query = query.Where("device_type = ?", deviceType)
	}
	if channel != "" {
		query = query.Where("channel = ?", channel)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var list []models.FirmwareRelease
	err := query.Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *Repository) Update(id uuid.UUID, updates map[string]any) error {
	return r.db.Model(&models.FirmwareRelease{}).Where("id = ?", id).Updates(updates).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.FirmwareRelease{}, "id = ?", id).Error
}

func (r *Repository) RecordDownload(d *models.FirmwareDownload) error {
	return r.db.Create(d).Error
}

func (r *Repository) ListDownloads(firmwareID uuid.UUID, page, perPage int) ([]models.FirmwareDownload, int64, error) {
	query := r.db.Model(&models.FirmwareDownload{}).Where("firmware_id = ?", firmwareID)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var list []models.FirmwareDownload
	err := query.Order("downloaded_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&list).Error
	return list, total, err
}
