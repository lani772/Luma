package audit

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Record(ctx context.Context, req CreateAuditLogRequest) (*AuditLogDTO, error) {
	var actorID *uuid.UUID
	if req.ActorUserID != nil && *req.ActorUserID != "" {
		if parsed, err := uuid.Parse(*req.ActorUserID); err == nil {
			actorID = &parsed
		}
	}

	meta := req.Metadata
	if meta == nil {
		meta = make(map[string]any)
	}

	log := &models.AuditLog{
		ID:           uuid.New(),
		ActorUserID:  actorID,
		Action:       req.Action,
		ResourceType: req.ResourceType,
		ResourceID:   req.ResourceID,
		Metadata:     models.JSONMap(meta),
		IPAddress:    req.IPAddress,
		CreatedAt:    time.Now(),
	}

	if err := s.repo.Create(log); err != nil {
		return nil, err
	}

	return toAuditLogDTO(log), nil
}

func (s *Service) List(ctx context.Context, filters QueryFilters, page, perPage int) ([]AuditLogDTO, int64, error) {
	list, total, err := s.repo.ListFiltered(filters, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	dtoList := make([]AuditLogDTO, 0, len(list))
	for _, l := range list {
		dtoList = append(dtoList, *toAuditLogDTO(&l))
	}
	return dtoList, total, nil
}

func toAuditLogDTO(l *models.AuditLog) *AuditLogDTO {
	var actorID *string
	if l.ActorUserID != nil {
		actorStr := l.ActorUserID.String()
		actorID = &actorStr
	}
	return &AuditLogDTO{
		ID:           l.ID.String(),
		ActorUserID:  actorID,
		Action:       l.Action,
		ResourceType: l.ResourceType,
		ResourceID:   l.ResourceID,
		Metadata:     map[string]any(l.Metadata),
		IPAddress:    l.IPAddress,
		CreatedAt:    l.CreatedAt,
	}
}
