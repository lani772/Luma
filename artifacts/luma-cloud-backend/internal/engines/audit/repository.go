package audit

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

func (r *Repository) Create(log *models.AuditLog) error {
	return r.db.Create(log).Error
}

type QueryFilters struct {
	UserID       *uuid.UUID
	DeviceID     *string
	Action       *string
	ResourceType *string
	StartDate    *time.Time
	EndDate      *time.Time
	Result       *string
	IPAddress    *string
}

func (r *Repository) ListFiltered(f QueryFilters, page, perPage int) ([]models.AuditLog, int64, error) {
	query := r.db.Model(&models.AuditLog{})

	if f.UserID != nil {
		query = query.Where("actor_user_id = ?", f.UserID)
	}
	if f.DeviceID != nil && *f.DeviceID != "" {
		query = query.Where("resource_id = ? AND resource_type = ?", f.DeviceID, "devices")
	}
	if f.Action != nil && *f.Action != "" {
		query = query.Where("action = ?", f.Action)
	}
	if f.ResourceType != nil && *f.ResourceType != "" {
		query = query.Where("resource_type = ?", f.ResourceType)
	}
	if f.StartDate != nil {
		query = query.Where("created_at >= ?", f.StartDate)
	}
	if f.EndDate != nil {
		query = query.Where("created_at <= ?", f.EndDate)
	}
	if f.IPAddress != nil && *f.IPAddress != "" {
		query = query.Where("ip_address = ?", f.IPAddress)
	}
	if f.Result != nil && *f.Result != "" {
		query = query.Where("metadata->>'result' = ?", f.Result)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var list []models.AuditLog
	err := query.Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&list).Error
	return list, total, err
}
