package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/luma-smart-home/device-registration-service/internal/domain"
)

// Repository interfaces defining Clean Architecture persistence ports

type ControllerRepository interface {
	Create(ctx context.Context, ctrl *domain.Controller) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Controller, error)
	GetBySerialNumber(ctx context.Context, serial string) (*domain.Controller, error)
	GetByMacAddress(ctx context.Context, mac string) (*domain.Controller, error)
	ListByOwner(ctx context.Context, ownerID uuid.UUID) ([]domain.Controller, error)
	Update(ctx context.Context, ctrl *domain.Controller) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type RoomRepository interface {
	Create(ctx context.Context, room *domain.Room) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Room, error)
	List(ctx context.Context) ([]domain.Room, error)
	Update(ctx context.Context, room *domain.Room) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ResourceRepository interface {
	Create(ctx context.Context, res *domain.Resource) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Resource, error)
	ListByController(ctx context.Context, controllerID uuid.UUID) ([]domain.Resource, error)
	Update(ctx context.Context, res *domain.Resource) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type CapabilityRepository interface {
	Create(ctx context.Context, cap *domain.DeviceCapability) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.DeviceCapability, error)
	ListByResource(ctx context.Context, resourceID uuid.UUID) ([]domain.DeviceCapability, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type ConfigurationRepository interface {
	Create(ctx context.Context, cfg *domain.DeviceConfiguration) error
	GetByController(ctx context.Context, controllerID uuid.UUID) (*domain.DeviceConfiguration, error)
	Update(ctx context.Context, cfg *domain.DeviceConfiguration) error
}

type CredentialsRepository interface {
	Create(ctx context.Context, creds *domain.DeviceCredentials) error
	GetByController(ctx context.Context, controllerID uuid.UUID) (*domain.DeviceCredentials, error)
	GetByToken(ctx context.Context, token string) (*domain.DeviceCredentials, error)
	Update(ctx context.Context, creds *domain.DeviceCredentials) error
}

type SimulationRepository interface {
	Create(ctx context.Context, sim *domain.DeviceSimulation) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.DeviceSimulation, error)
	Update(ctx context.Context, sim *domain.DeviceSimulation) error
}
