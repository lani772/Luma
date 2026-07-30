package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/sync/domain/entities"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/sync/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error {
	latestVer, err := s.repo.GetLatestVersion(ctx, userID, resType)
	if err != nil {
		latestVer = 0
	}

	rec := &entities.CloudSyncRecord{
		ID:           uuid.New(),
		UserID:       userID,
		ResourceID:   resID,
		ResourceType: resType,
		Data:         data,
		Version:      latestVer + 1,
		Deleted:      deleted,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	return s.repo.SaveRecord(ctx, rec)
}
