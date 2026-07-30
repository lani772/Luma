package services

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/device-registration-service/internal/domain"
	"github.com/luma-smart-home/device-registration-service/internal/repository"
)

type ResourceManagementService struct {
	controllerRepo repository.ControllerRepository
	resourceRepo   repository.ResourceRepository
	configRepo     repository.ConfigurationRepository
	roomRepo       repository.RoomRepository
}

func NewResourceManagementService(
	controllerRepo repository.ControllerRepository,
	resourceRepo repository.ResourceRepository,
	configRepo repository.ConfigurationRepository,
	roomRepo repository.RoomRepository,
) *ResourceManagementService {
	return &ResourceManagementService{
		controllerRepo: controllerRepo,
		resourceRepo:   resourceRepo,
		configRepo:     configRepo,
		roomRepo:       roomRepo,
	}
}

// AddResource associates a logical resource with a microcontroller and binds it to a GPIO pin
func (s *ResourceManagementService) AddResource(ctx context.Context, controllerID uuid.UUID, name, rType string, roomID uuid.UUID, gpioPin int) (*domain.Resource, error) {
	ctrl, err := s.controllerRepo.GetByID(ctx, controllerID)
	if err != nil {
		return nil, errors.New("controller not found")
	}

	// Validate GPIO assignment constraints and reserve pin mapping to avoid conflicts
	config, err := s.configRepo.GetByController(ctx, controllerID)
	if err != nil {
		config = &domain.DeviceConfiguration{
			ID:           uuid.New(),
			ControllerID: controllerID,
			GPIOMappings: domain.JSONB("{}"),
			DeviceLogic:  domain.JSONB("{}"),
			CreatedAt:    time.Now(),
		}
		if err := s.configRepo.Create(ctx, config); err != nil {
			return nil, err
		}
	}

	var gpioMap map[string]interface{}
	_ = domain.UnmarshalJSONB(config.GPIOMappings, &gpioMap)
	if gpioMap == nil {
		gpioMap = make(map[string]interface{})
	}

	// Conflict validation check: cannot bind same GPIO pin to multiple resources on this controller
	for _, pin := range gpioMap {
		if val, ok := pin.(float64); ok && int(val) == gpioPin {
			return nil, errors.New("GPIO pin is already assigned to another resource on this controller")
		}
		if val, ok := pin.(int); ok && val == gpioPin {
			return nil, errors.New("GPIO pin is already assigned to another resource on this controller")
		}
	}

	res := &domain.Resource{
		ID:           uuid.New(),
		ControllerID: ctrl.ID,
		RoomID:       roomID,
		Name:         name,
		ResourceType: rType,
		CreatedAt:    time.Now(),
	}

	if err := s.resourceRepo.Create(ctx, res); err != nil {
		return nil, err
	}

	gpioMap[res.ID.String()] = gpioPin
	gpioBytes, _ := domain.MarshalJSONB(gpioMap)
	config.GPIOMappings = gpioBytes
	_ = s.configRepo.Update(ctx, config)

	return res, nil
}

// Room Management functionalities
func (s *ResourceManagementService) CreateRoom(ctx context.Context, name, desc, img, loc string) (*domain.Room, error) {
	room := &domain.Room{
		ID:          uuid.New(),
		Name:        name,
		Description: desc,
		ImageUrl:    img,
		Location:    loc,
		CreatedAt:   time.Now(),
	}
	if err := s.roomRepo.Create(ctx, room); err != nil {
		return nil, err
	}
	return room, nil
}

func (s *ResourceManagementService) ListRooms(ctx context.Context) ([]domain.Room, error) {
	return s.roomRepo.List(ctx)
}
