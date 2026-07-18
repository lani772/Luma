package users

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

var ErrPhoneNotFound = errors.New("phone not found")
var ErrUsernameTaken = errors.New("username already taken")
var ErrInvalidUsername = errors.New("username must be 3-20 characters and contain only letters, numbers, and underscores")
var ErrWrongPassword = errors.New("incorrect password")

// DeviceOwnershipReader is implemented by the Device Registration Engine.
// Kept narrow so the User Engine doesn't need the full devices package API.
type DeviceOwnershipReader interface {
	ListOwnedAndAdminDevices(userID uuid.UUID) ([]OwnedDeviceSummaryDTO, error)
}

type Service struct {
	repo    *Repository
	devices DeviceOwnershipReader
}

func NewService(repo *Repository, devices DeviceOwnershipReader) *Service {
	return &Service{repo: repo, devices: devices}
}

func (s *Service) GetAccount(userID uuid.UUID) (*AccountDTO, error) {
	u, err := s.repo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	return toAccountDTO(u), nil
}

func (s *Service) UpdateProfile(userID uuid.UUID, req UpdateProfileRequest) (*AccountDTO, error) {
	if req.Username != nil {
		if !isValidUsername(*req.Username) {
			return nil, ErrInvalidUsername
		}
		taken, err := s.repo.UsernameExists(*req.Username, userID)
		if err != nil {
			return nil, fmt.Errorf("users: check username: %w", err)
		}
		if taken {
			return nil, ErrUsernameTaken
		}
		if err := s.repo.UpdateUsername(userID, *req.Username); err != nil {
			return nil, fmt.Errorf("users: update username: %w", err)
		}
	}
	if req.FullName != nil {
		if err := s.repo.UpdateProfile(userID, req.FullName); err != nil {
			return nil, err
		}
	}
	return s.GetAccount(userID)
}

func (s *Service) UpdatePreferences(userID uuid.UUID, prefs map[string]any) (*AccountDTO, error) {
	if err := s.repo.UpdatePreferences(userID, models.JSONMap(prefs)); err != nil {
		return nil, err
	}
	return s.GetAccount(userID)
}

func (s *Service) ListPhones(userID uuid.UUID) ([]PhoneDTO, error) {
	phones, err := s.repo.ListPhones(userID)
	if err != nil {
		return nil, err
	}
	out := make([]PhoneDTO, 0, len(phones))
	for _, p := range phones {
		out = append(out, PhoneDTO{
			ID:         p.ID.String(),
			DeviceName: p.DeviceName,
			Platform:   string(p.Platform),
			LastSeenAt: p.LastSeenAt,
			CreatedAt:  p.CreatedAt,
		})
	}
	return out, nil
}

// RemovePhone revokes a phone and every session tied to it — this is the
// "remotely sign out one of my phones" action.
func (s *Service) RemovePhone(userID, phoneID uuid.UUID) error {
	if _, err := s.repo.FindPhone(userID, phoneID); err != nil {
		return ErrPhoneNotFound
	}
	if err := s.repo.RevokeSessionsForPhone(phoneID); err != nil {
		return err
	}
	return s.repo.RevokePhone(phoneID)
}

func (s *Service) ListOwnedDevices(userID uuid.UUID) ([]OwnedDeviceSummaryDTO, error) {
	if s.devices == nil {
		return []OwnedDeviceSummaryDTO{}, nil
	}
	return s.devices.ListOwnedAndAdminDevices(userID)
}

// DeleteAccount soft-deletes the user by marking their status as 'deleted'.
// If a password is provided, it is verified against the stored hash. We use a
// soft delete because devices and other rows reference users via foreign keys
// with ON DELETE RESTRICT.
func (s *Service) DeleteAccount(userID uuid.UUID, password string) error {
	if password != "" {
		u, err := s.repo.FindByID(userID)
		if err != nil {
			return err
		}
		if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
			return ErrWrongPassword
		}
	}
	if err := s.repo.RevokeAllSessions(userID); err != nil {
		return fmt.Errorf("users: revoke sessions: %w", err)
	}
	return s.repo.MarkDeleted(userID)
}

func isValidUsername(username string) bool {
	matched, _ := regexp.MatchString("^[a-zA-Z0-9_]{3,20}$", username)
	return matched
}

func toAccountDTO(u *models.User) *AccountDTO {
	prefs := map[string]any(u.Preferences)
	if prefs == nil {
		prefs = map[string]any{}
	}
	username := ""
	if u.Username != nil {
		username = *u.Username
	}
	return &AccountDTO{
		ID:               u.ID.String(),
		Email:            u.Email,
		Username:         username,
		FullName:         u.FullName,
		Role:             string(u.Role),
		SubscriptionTier: u.SubscriptionTier,
		Preferences:      prefs,
		EmailVerified:    u.EmailVerifiedAt != nil,
		CreatedAt:        u.CreatedAt,
	}
}
