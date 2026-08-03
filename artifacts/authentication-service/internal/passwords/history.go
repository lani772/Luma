package passwords

import (
	"errors"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"gorm.io/gorm"
)

var (
	ErrPasswordTooWeak        = errors.New("password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character")
	ErrPasswordReusedRecently = errors.New("password has been used recently; please choose a password that does not match your last 3 passwords")
)

type PasswordManager struct {
	db *gorm.DB
}

func NewPasswordManager(db *gorm.DB) *PasswordManager {
	return &PasswordManager{db: db}
}

func (pm *PasswordManager) ValidateStrength(password string) error {
	if len(password) < 8 {
		return ErrPasswordTooWeak
	}

	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	hasDigit := regexp.MustCompile(`[0-9]`).MatchString(password)
	hasSpecial := regexp.MustCompile(`[!@#$%^&*()_+=\-\[\]{}|;:',./<>?]`).MatchString(password)

	if !hasUpper || !hasLower || !hasDigit || !hasSpecial {
		return ErrPasswordTooWeak
	}

	return nil
}

func (pm *PasswordManager) RecordAndVerifyHistory(userID uuid.UUID, newPassword string) error {
	// 1. Validate Strength
	if err := pm.ValidateStrength(newPassword); err != nil {
		return err
	}

	// 2. Fetch last 3 credentials historical records for user
	var history []database.Credential
	err := pm.db.Where("user_id = ?", userID).Order("last_password_change desc").Limit(3).Find(&history).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// 3. Compare new password with the historical entries
	for _, cred := range history {
		match, err := VerifyPassword(newPassword, cred.PasswordHash)
		if err == nil && match {
			return ErrPasswordReusedRecently
		}
	}

	// 4. Hash and write the new password to credentials history ledger
	newHash, err := HashPassword(newPassword, nil)
	if err != nil {
		return err
	}

	newCred := database.Credential{
		ID:                 uuid.New(),
		UserID:             userID,
		PasswordHash:       newHash,
		LastPasswordChange: time.Now(),
	}

	return pm.db.Create(&newCred).Error
}
