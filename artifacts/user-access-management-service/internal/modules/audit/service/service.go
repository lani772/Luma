package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/domain/entities"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/audit/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error {
	log := &entities.AuditLog{
		ID:           uuid.New(),
		ActorUserID:  actorID,
		Action:       action,
		ResourceType: resType,
		ResourceID:   resID,
		Metadata:     metadata,
		IPAddress:    ip,
		CreatedAt:    time.Now(),
	}
	return s.repo.Save(ctx, log)
}

func (s *Service) ListLogs(ctx context.Context, actorID *uuid.UUID, action *string) ([]entities.AuditLog, error) {
	return s.repo.List(ctx, actorID, action)
}
