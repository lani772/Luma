package scenes

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

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, req CreateSceneRequest) (*SceneDTO, error) {
	scene := &models.Scene{
		ID:        uuid.New(),
		OwnerID:   ownerID,
		Name:      req.Name,
		Actions:   models.JSONList(req.Actions),
		Version:   1,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.repo.Create(scene); err != nil {
		return nil, err
	}

	return toSceneDTO(scene), nil
}

func (s *Service) Get(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*SceneDTO, error) {
	scene, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if scene.OwnerID != userID {
		return nil, errors.New("unauthorized scene access")
	}

	return toSceneDTO(scene), nil
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, page, perPage int) ([]SceneDTO, int64, error) {
	list, total, err := s.repo.ListForUser(userID, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	dtoList := make([]SceneDTO, 0, len(list))
	for _, sc := range list {
		dtoList = append(dtoList, *toSceneDTO(&sc))
	}
	return dtoList, total, nil
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, userID uuid.UUID, req UpdateSceneRequest) (*SceneDTO, error) {
	scene, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if scene.OwnerID != userID {
		return nil, errors.New("unauthorized scene write")
	}

	updates := make(map[string]any)
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Actions != nil {
		updates["actions"] = models.JSONList(req.Actions)
	}

	updates["version"] = scene.Version + 1

	if err := s.repo.Update(id, updates); err != nil {
		return nil, err
	}

	return s.Get(ctx, id, userID)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	scene, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	if scene.OwnerID != userID {
		return errors.New("unauthorized scene deletion")
	}

	return s.repo.Delete(id)
}

func toSceneDTO(s *models.Scene) *SceneDTO {
	return &SceneDTO{
		ID:        s.ID.String(),
		OwnerID:   s.OwnerID.String(),
		Name:      s.Name,
		Actions:   []any(s.Actions),
		Version:   s.Version,
		CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt,
	}
}
