package users

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

func (r *Repository) FindByID(id uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.db.Where("id = ?", id).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) UpdateProfile(id uuid.UUID, fullName *string) error {
	updates := map[string]any{"updated_at": time.Now()}
	if fullName != nil {
		updates["full_name"] = *fullName
	}
	return r.db.Model(&models.User{}).Where("id = ?", id).Updates(updates).Error
}

func (r *Repository) UpdatePreferences(id uuid.UUID, prefs models.JSONMap) error {
	return r.db.Model(&models.User{}).Where("id = ?", id).
		Updates(map[string]any{"preferences": prefs, "updated_at": time.Now()}).Error
}

func (r *Repository) ListPhones(userID uuid.UUID) ([]models.UserPhone, error) {
	var phones []models.UserPhone
	err := r.db.Where("user_id = ? AND revoked_at IS NULL", userID).Order("last_seen_at DESC").Find(&phones).Error
	return phones, err
}

func (r *Repository) FindPhone(userID, phoneID uuid.UUID) (*models.UserPhone, error) {
	var phone models.UserPhone
	err := r.db.Where("id = ? AND user_id = ?", phoneID, userID).First(&phone).Error
	if err != nil {
		return nil, err
	}
	return &phone, nil
}

func (r *Repository) RevokePhone(phoneID uuid.UUID) error {
	return r.db.Model(&models.UserPhone{}).Where("id = ?", phoneID).Update("revoked_at", time.Now()).Error
}

// RevokeSessionsForPhone is used when a phone is deregistered (e.g. "log
// this device out remotely" from another phone), so its refresh tokens stop
// working even if the physical device is offline right now.
func (r *Repository) RevokeSessionsForPhone(phoneID uuid.UUID) error {
	return r.db.Model(&models.Session{}).
		Where("phone_id = ? AND revoked_at IS NULL", phoneID).
		Update("revoked_at", time.Now()).Error
}
