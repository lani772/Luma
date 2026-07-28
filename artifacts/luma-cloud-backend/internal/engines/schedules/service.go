package schedules

import (
	"context"
	"errors"
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

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, req CreateScheduleRequest) (*ScheduleDTO, error) {
	devID, err := uuid.Parse(req.DeviceID)
	if err != nil {
		return nil, errors.New("invalid device id")
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	sch := &models.Schedule{
		ID:         uuid.New(),
		DeviceID:   devID,
		OwnerID:    ownerID,
		Name:       req.Name,
		TimeConfig: models.JSONMap(req.TimeConfig),
		Action:     models.JSONMap(req.Action),
		Enabled:    enabled,
		Version:    1,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.Create(sch); err != nil {
		return nil, err
	}

	return toScheduleDTO(sch), nil
}

func (s *Service) Get(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*ScheduleDTO, error) {
	sch, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if sch.OwnerID != userID {
		return nil, errors.New("unauthorized schedule access")
	}

	return toScheduleDTO(sch), nil
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, page, perPage int) ([]ScheduleDTO, int64, error) {
	list, total, err := s.repo.ListForUser(userID, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	dtoList := make([]ScheduleDTO, 0, len(list))
	for _, sch := range list {
		dtoList = append(dtoList, *toScheduleDTO(&sch))
	}
	return dtoList, total, nil
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, userID uuid.UUID, req UpdateScheduleRequest) (*ScheduleDTO, error) {
	sch, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if sch.OwnerID != userID {
		return nil, errors.New("unauthorized schedule write")
	}

	updates := make(map[string]any)
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.TimeConfig != nil {
		updates["time_config"] = models.JSONMap(req.TimeConfig)
	}
	if req.Action != nil {
		updates["action"] = models.JSONMap(req.Action)
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	updates["version"] = sch.Version + 1

	if err := s.repo.Update(id, updates); err != nil {
		return nil, err
	}

	return s.Get(ctx, id, userID)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	sch, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	if sch.OwnerID != userID {
		return errors.New("unauthorized schedule deletion")
	}

	return s.repo.Delete(id)
}

func toScheduleDTO(s *models.Schedule) *ScheduleDTO {
	return &ScheduleDTO{
		ID:         s.ID.String(),
		DeviceID:   s.DeviceID.String(),
		OwnerID:    s.OwnerID.String(),
		Name:       s.Name,
		TimeConfig: map[string]any(s.TimeConfig),
		Action:     map[string]any(s.Action),
		Enabled:    s.Enabled,
		Version:    s.Version,
		CreatedAt:  s.CreatedAt,
		UpdatedAt:  s.UpdatedAt,
	}
}
