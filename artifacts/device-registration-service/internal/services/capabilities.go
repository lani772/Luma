package services

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/device-registration-service/internal/domain"
	"github.com/luma-smart-home/device-registration-service/internal/repository"
)

type CapabilityManagementService struct {
	resourceRepo repository.ResourceRepository
	capRepo      repository.CapabilityRepository
}

func NewCapabilityManagementService(
	resourceRepo repository.ResourceRepository,
	capRepo repository.CapabilityRepository,
) *CapabilityManagementService {
	return &CapabilityManagementService{
		resourceRepo: resourceRepo,
		capRepo:      capRepo,
	}
}

// AddCapability assigns a dynamic capability definition to a smart resource
func (s *CapabilityManagementService) AddCapability(ctx context.Context, resourceID uuid.UUID, capName string, parameters map[string]interface{}) (*domain.DeviceCapability, error) {
	_, err := s.resourceRepo.GetByID(ctx, resourceID)
	if err != nil {
		return nil, errors.New("associated resource not found")
	}

	paramsBytes, err := domain.MarshalJSONB(parameters)
	if err != nil {
		return nil, err
	}

	cap := &domain.DeviceCapability{
		ID:             uuid.New(),
		ResourceID:     resourceID,
		CapabilityName: capName,
		Parameters:     paramsBytes,
		CreatedAt:      time.Now(),
	}

	if err := s.capRepo.Create(ctx, cap); err != nil {
		return nil, err
	}

	return cap, nil
}

// ListCapabilities retrieves all capabilities registered on a given resource
func (s *CapabilityManagementService) ListCapabilities(ctx context.Context, resourceID uuid.UUID) ([]domain.DeviceCapability, error) {
	return s.capRepo.ListByResource(ctx, resourceID)
}
