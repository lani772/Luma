package sync

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

func (r *Repository) FindRecord(userID uuid.UUID, resourceType, resourceID string) (*models.CloudSyncRecord, error) {
	var rec models.CloudSyncRecord
	err := r.db.Where("user_id = ? AND resource_type = ? AND resource_id = ?", userID, resourceType, resourceID).First(&rec).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) SaveRecord(rec *models.CloudSyncRecord) error {
	rec.UpdatedAt = time.Now()
	return r.db.Save(rec).Error
}

func (r *Repository) FindChangesSince(userID uuid.UUID, resourceType string, version int) ([]models.CloudSyncRecord, error) {
	var list []models.CloudSyncRecord
	err := r.db.Where("user_id = ? AND resource_type = ? AND version > ?", userID, resourceType, version).Order("version ASC").Find(&list).Error
	return list, err
}

func (r *Repository) GetLatestVersion(userID uuid.UUID, resourceType string) (int, error) {
	var version int
	err := r.db.Model(&models.CloudSyncRecord{}).
		Where("user_id = ? AND resource_type = ?", userID, resourceType).
		Select("COALESCE(MAX(version), 0)").Scan(&version).Error
	return version, err
}

func (r *Repository) GetSyncState(userID, phoneID uuid.UUID, resourceType string) (*models.SyncState, error) {
	var state models.SyncState
	err := r.db.Where("user_id = ? AND phone_id = ? AND resource_type = ?", userID, phoneID, resourceType).First(&state).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &state, nil
}

func (r *Repository) SaveSyncState(state *models.SyncState) error {
	state.LastSyncedAt = time.Now()
	return r.db.Save(state).Error
}

func (r *Repository) RecordHistory(h *models.SyncHistory) error {
	return r.db.Create(h).Error
}
