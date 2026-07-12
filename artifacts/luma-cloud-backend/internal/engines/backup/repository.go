package backup

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

func (r *Repository) Create(b *models.Backup) error {
	return r.db.Create(b).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*models.Backup, error) {
	var b models.Backup
	err := r.db.Where("id = ?", id).First(&b).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("backup not found")
		}
		return nil, err
	}
	return &b, nil
}

func (r *Repository) ListForUser(userID uuid.UUID, page, perPage int) ([]models.Backup, int64, error) {
	var total int64
	if err := r.db.Model(&models.Backup{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var list []models.Backup
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Backup{}, "id = ?", id).Error
}

func (r *Repository) GetUserSyncRecords(userID uuid.UUID) ([]models.CloudSyncRecord, error) {
	var list []models.CloudSyncRecord
	err := r.db.Where("user_id = ? AND deleted = false", userID).Find(&list).Error
	return list, err
}

func (r *Repository) SaveSyncRecord(rec *models.CloudSyncRecord) error {
	return r.db.Save(rec).Error
}

func (r *Repository) ListAllUsers() ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.Model(&models.User{}).Pluck("id", &ids).Error
	return ids, err
}
