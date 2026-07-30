package security

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"gorm.io/gorm"
)

var ErrAccountLocked = errors.New("account is temporarily locked due to too many failed login attempts")

type LockoutTracker struct {
	db              *gorm.DB
	maxAttempts     int
	lockoutDuration time.Duration
}

func NewLockoutTracker(db *gorm.DB, maxAttempts int, lockoutDuration time.Duration) *LockoutTracker {
	return &LockoutTracker{
		db:              db,
		maxAttempts:     maxAttempts,
		lockoutDuration: lockoutDuration,
	}
}

func (t *LockoutTracker) IsLocked(key string) (bool, *time.Time, error) {
	var attempt database.LoginAttempt
	err := t.db.Where("key = ?", key).First(&attempt).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil, nil
		}
		return false, nil, err
	}

	if attempt.LockedUntil != nil && time.Now().Before(*attempt.LockedUntil) {
		return true, attempt.LockedUntil, nil
	}

	// Lockout expired, we can reset attempts if expired
	if attempt.LockedUntil != nil && time.Now().After(*attempt.LockedUntil) {
		t.Reset(key)
	}

	return false, nil, nil
}

func (t *LockoutTracker) RecordFailure(key string) (int, *time.Time, error) {
	var attempt database.LoginAttempt
	err := t.db.Where("key = ?", key).First(&attempt).Error

	now := time.Now()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			attempt = database.LoginAttempt{
				ID:          uuid.New(),
				Key:         key,
				Attempts:    1,
				LastAttempt: now,
			}
			if err := t.db.Create(&attempt).Error; err != nil {
				return 0, nil, err
			}
			return 1, nil, nil
		}
		return 0, nil, err
	}

	attempt.Attempts++
	attempt.LastAttempt = now

	var lockedUntil *time.Time
	if attempt.Attempts >= t.maxAttempts {
		until := now.Add(t.lockoutDuration)
		lockedUntil = &until
		attempt.LockedUntil = lockedUntil
	}

	if err := t.db.Save(&attempt).Error; err != nil {
		return 0, nil, err
	}

	return attempt.Attempts, lockedUntil, nil
}

func (t *LockoutTracker) Reset(key string) error {
	return t.db.Where("key = ?", key).Delete(&database.LoginAttempt{}).Error
}
