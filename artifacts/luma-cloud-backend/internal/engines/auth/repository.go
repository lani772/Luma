package auth

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

func (r *Repository) CreateUser(u *models.User) error {
	return r.db.Create(u).Error
}

func (r *Repository) FindUserByEmail(email string) (*models.User, error) {
	var u models.User
	err := r.db.Where("email = ?", email).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindUserByID(id string) (*models.User, error) {
	var u models.User
	err := r.db.Where("id = ?", id).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) UpdateUserPassword(userID uuid.UUID, passwordHash string) error {
	return r.db.Model(&models.User{}).Where("id = ?", userID).
		Updates(map[string]any{"password_hash": passwordHash, "updated_at": time.Now()}).Error
}

func (r *Repository) MarkEmailVerified(userID uuid.UUID) error {
	now := time.Now()
	return r.db.Model(&models.User{}).Where("id = ?", userID).
		Updates(map[string]any{"email_verified_at": now, "updated_at": now}).Error
}

func (r *Repository) CreatePhone(p *models.UserPhone) error {
	return r.db.Create(p).Error
}

// FindOrCreatePhone reuses an existing (unrevoked) phone row for the same
// user+device+platform so repeated logins from the same physical phone don't
// pile up duplicate phone rows — this is what lets "multiple phones" mean
// "multiple distinct devices", not "one row per login".
func (r *Repository) FindOrCreatePhone(userID uuid.UUID, deviceName, platform, pushToken string) (*models.UserPhone, error) {
	var phone models.UserPhone
	err := r.db.Where("user_id = ? AND device_name = ? AND platform = ? AND revoked_at IS NULL", userID, deviceName, platform).
		First(&phone).Error
	if err == nil {
		updates := map[string]any{"last_seen_at": time.Now()}
		if pushToken != "" {
			updates["push_token"] = pushToken
		}
		if err := r.db.Model(&phone).Updates(updates).Error; err != nil {
			return nil, err
		}
		return &phone, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	now := time.Now()
	phone = models.UserPhone{
		ID:         uuid.New(),
		UserID:     userID,
		DeviceName: deviceName,
		Platform:   models.Platform(platform),
		LastSeenAt: &now,
		CreatedAt:  now,
	}
	if pushToken != "" {
		phone.PushToken = &pushToken
	}
	if err := r.db.Create(&phone).Error; err != nil {
		return nil, err
	}
	return &phone, nil
}

func (r *Repository) ListPhonesForUser(userID uuid.UUID) ([]models.UserPhone, error) {
	var phones []models.UserPhone
	err := r.db.Where("user_id = ? AND revoked_at IS NULL", userID).Order("last_seen_at DESC").Find(&phones).Error
	return phones, err
}

func (r *Repository) CreateSession(s *models.Session) error {
	return r.db.Create(s).Error
}

func (r *Repository) FindSessionByRefreshHash(hash string) (*models.Session, error) {
	var s models.Session
	err := r.db.Where("refresh_token_hash = ?", hash).First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) RevokeSession(id uuid.UUID) error {
	return r.db.Model(&models.Session{}).Where("id = ?", id).Update("revoked_at", time.Now()).Error
}

func (r *Repository) RevokeAllSessionsForUser(userID uuid.UUID) error {
	return r.db.Model(&models.Session{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", time.Now()).Error
}

func (r *Repository) ListActiveSessionsForUser(userID uuid.UUID) ([]models.Session, error) {
	var sessions []models.Session
	err := r.db.Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, time.Now()).
		Order("created_at DESC").Find(&sessions).Error
	return sessions, err
}

func (r *Repository) CreatePasswordResetToken(t *models.PasswordResetToken) error {
	return r.db.Create(t).Error
}

func (r *Repository) FindPasswordResetToken(hash string) (*models.PasswordResetToken, error) {
	var t models.PasswordResetToken
	err := r.db.Where("token_hash = ?", hash).First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) MarkPasswordResetTokenUsed(id uuid.UUID) error {
	return r.db.Model(&models.PasswordResetToken{}).Where("id = ?", id).Update("used_at", time.Now()).Error
}

func (r *Repository) CreateEmailVerificationToken(t *models.EmailVerificationToken) error {
	return r.db.Create(t).Error
}

func (r *Repository) FindEmailVerificationToken(hash string) (*models.EmailVerificationToken, error) {
	var t models.EmailVerificationToken
	err := r.db.Where("token_hash = ?", hash).First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) MarkEmailVerificationTokenUsed(id uuid.UUID) error {
	return r.db.Model(&models.EmailVerificationToken{}).Where("id = ?", id).Update("used_at", time.Now()).Error
}
