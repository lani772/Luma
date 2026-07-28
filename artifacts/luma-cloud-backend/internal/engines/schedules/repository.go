package schedules

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

func (r *Repository) Create(s *models.Schedule) error {
	return r.db.Create(s).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*models.Schedule, error) {
	var s models.Schedule
	err := r.db.Where("id = ?", id).First(&s).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("schedule not found")
		}
		return nil, err
	}
	return &s, nil
}

func (r *Repository) ListForUser(ownerID uuid.UUID, page, perPage int) ([]models.Schedule, int64, error) {
	var total int64
	if err := r.db.Model(&models.Schedule{}).Where("owner_id = ?", ownerID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var list []models.Schedule
	err := r.db.Where("owner_id = ?", ownerID).Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *Repository) Update(id uuid.UUID, updates map[string]any) error {
	updates["updated_at"] = time.Now()
	return r.db.Model(&models.Schedule{}).Where("id = ?", id).Updates(updates).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Schedule{}, "id = ?", id).Error
}
