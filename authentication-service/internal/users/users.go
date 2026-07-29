package users

import (
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"github.com/luma-smart-home/authentication-service/internal/repositories"
)

type UserService struct {
	userRepo repositories.UserRepository
}

func NewUserService(userRepo repositories.UserRepository) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) GetProfile(id uuid.UUID) (*database.User, error) {
	return s.userRepo.GetByID(id)
}

func (s *UserService) DeactivateAccount(id uuid.UUID) error {
	user, err := s.userRepo.GetByID(id)
	if err != nil {
		return err
	}
	user.Status = database.UserStatusSuspended
	user.UpdatedAt = time.Now()
	return s.userRepo.Update(user)
}

func (s *UserService) DeleteAccount(id uuid.UUID) error {
	user, err := s.userRepo.GetByID(id)
	if err != nil {
		return err
	}
	user.Status = database.UserStatusDeleted
	user.UpdatedAt = time.Now()
	return s.userRepo.Update(user)
}
