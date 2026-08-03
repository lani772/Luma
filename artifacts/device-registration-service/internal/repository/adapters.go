package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/luma-smart-home/device-registration-service/internal/domain"
	"gorm.io/gorm"
)

// GORM-based adapters implementing the defined ports

type gormControllerRepo struct {
	db *gorm.DB
}

func NewControllerRepository(db *gorm.DB) ControllerRepository {
	return &gormControllerRepo{db: db}
}

func (r *gormControllerRepo) Create(ctx context.Context, ctrl *domain.Controller) error {
	return r.db.WithContext(ctx).Create(ctrl).Error
}

func (r *gormControllerRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Controller, error) {
	var ctrl domain.Controller
	err := r.db.WithContext(ctx).
		Preload("Resources.Capabilities").
		Preload("Configuration").
		Preload("Credentials").
		First(&ctrl, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &ctrl, nil
}

func (r *gormControllerRepo) GetBySerialNumber(ctx context.Context, serial string) (*domain.Controller, error) {
	var ctrl domain.Controller
	err := r.db.WithContext(ctx).First(&ctrl, "serial_number = ?", serial).Error
	if err != nil {
		return nil, err
	}
	return &ctrl, nil
}

func (r *gormControllerRepo) GetByMacAddress(ctx context.Context, mac string) (*domain.Controller, error) {
	var ctrl domain.Controller
	err := r.db.WithContext(ctx).First(&ctrl, "mac_address = ?", mac).Error
	if err != nil {
		return nil, err
	}
	return &ctrl, nil
}

func (r *gormControllerRepo) ListByOwner(ctx context.Context, ownerID uuid.UUID) ([]domain.Controller, error) {
	var ctrls []domain.Controller
	err := r.db.WithContext(ctx).
		Preload("Resources.Capabilities").
		Preload("Configuration").
		Preload("Credentials").
		Where("owner_reference = ?", ownerID).Find(&ctrls).Error
	return ctrls, err
}

func (r *gormControllerRepo) Update(ctx context.Context, ctrl *domain.Controller) error {
	return r.db.WithContext(ctx).Save(ctrl).Error
}

func (r *gormControllerRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&domain.Controller{}, "id = ?", id).Error
}

// Room Repo
type gormRoomRepo struct {
	db *gorm.DB
}

func NewRoomRepository(db *gorm.DB) RoomRepository {
	return &gormRoomRepo{db: db}
}

func (r *gormRoomRepo) Create(ctx context.Context, room *domain.Room) error {
	return r.db.WithContext(ctx).Create(room).Error
}

func (r *gormRoomRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Room, error) {
	var room domain.Room
	err := r.db.WithContext(ctx).First(&room, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &room, nil
}

func (r *gormRoomRepo) List(ctx context.Context) ([]domain.Room, error) {
	var rooms []domain.Room
	err := r.db.WithContext(ctx).Find(&rooms).Error
	return rooms, err
}

func (r *gormRoomRepo) Update(ctx context.Context, room *domain.Room) error {
	return r.db.WithContext(ctx).Save(room).Error
}

func (r *gormRoomRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&domain.Room{}, "id = ?", id).Error
}

// Resource Repo
type gormResourceRepo struct {
	db *gorm.DB
}

func NewResourceRepository(db *gorm.DB) ResourceRepository {
	return &gormResourceRepo{db: db}
}

func (r *gormResourceRepo) Create(ctx context.Context, res *domain.Resource) error {
	return r.db.WithContext(ctx).Create(res).Error
}

func (r *gormResourceRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Resource, error) {
	var res domain.Resource
	err := r.db.WithContext(ctx).Preload("Capabilities").First(&res, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *gormResourceRepo) ListByController(ctx context.Context, controllerID uuid.UUID) ([]domain.Resource, error) {
	var resources []domain.Resource
	err := r.db.WithContext(ctx).Preload("Capabilities").Where("controller_id = ?", controllerID).Find(&resources).Error
	return resources, err
}

func (r *gormResourceRepo) Update(ctx context.Context, res *domain.Resource) error {
	return r.db.WithContext(ctx).Save(res).Error
}

func (r *gormResourceRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&domain.Resource{}, "id = ?", id).Error
}

// Capability Repo
type gormCapabilityRepo struct {
	db *gorm.DB
}

func NewCapabilityRepository(db *gorm.DB) CapabilityRepository {
	return &gormCapabilityRepo{db: db}
}

func (r *gormCapabilityRepo) Create(ctx context.Context, cap *domain.DeviceCapability) error {
	return r.db.WithContext(ctx).Create(cap).Error
}

func (r *gormCapabilityRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.DeviceCapability, error) {
	var cap domain.DeviceCapability
	err := r.db.WithContext(ctx).First(&cap, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &cap, nil
}

func (r *gormCapabilityRepo) ListByResource(ctx context.Context, resourceID uuid.UUID) ([]domain.DeviceCapability, error) {
	var caps []domain.DeviceCapability
	err := r.db.WithContext(ctx).Where("resource_id = ?", resourceID).Find(&caps).Error
	return caps, err
}

func (r *gormCapabilityRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&domain.DeviceCapability{}, "id = ?", id).Error
}

// Configuration Repo
type gormConfigurationRepo struct {
	db *gorm.DB
}

func NewConfigurationRepository(db *gorm.DB) ConfigurationRepository {
	return &gormConfigurationRepo{db: db}
}

func (r *gormConfigurationRepo) Create(ctx context.Context, cfg *domain.DeviceConfiguration) error {
	return r.db.WithContext(ctx).Create(cfg).Error
}

func (r *gormConfigurationRepo) GetByController(ctx context.Context, controllerID uuid.UUID) (*domain.DeviceConfiguration, error) {
	var cfg domain.DeviceConfiguration
	err := r.db.WithContext(ctx).First(&cfg, "controller_id = ?", controllerID).Error
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *gormConfigurationRepo) Update(ctx context.Context, cfg *domain.DeviceConfiguration) error {
	return r.db.WithContext(ctx).Save(cfg).Error
}

// Credentials Repo
type gormCredentialsRepo struct {
	db *gorm.DB
}

func NewCredentialsRepository(db *gorm.DB) CredentialsRepository {
	return &gormCredentialsRepo{db: db}
}

func (r *gormCredentialsRepo) Create(ctx context.Context, creds *domain.DeviceCredentials) error {
	return r.db.WithContext(ctx).Create(creds).Error
}

func (r *gormCredentialsRepo) GetByController(ctx context.Context, controllerID uuid.UUID) (*domain.DeviceCredentials, error) {
	var creds domain.DeviceCredentials
	err := r.db.WithContext(ctx).First(&creds, "controller_id = ?", controllerID).Error
	if err != nil {
		return nil, err
	}
	return &creds, nil
}

func (r *gormCredentialsRepo) GetByToken(ctx context.Context, token string) (*domain.DeviceCredentials, error) {
	var creds domain.DeviceCredentials
	err := r.db.WithContext(ctx).First(&creds, "registration_token = ?", token).Error
	if err != nil {
		return nil, err
	}
	return &creds, nil
}

func (r *gormCredentialsRepo) Update(ctx context.Context, creds *domain.DeviceCredentials) error {
	return r.db.WithContext(ctx).Save(creds).Error
}

// Simulation Repo
type gormSimulationRepo struct {
	db *gorm.DB
}

func NewSimulationRepository(db *gorm.DB) SimulationRepository {
	return &gormSimulationRepo{db: db}
}

func (r *gormSimulationRepo) Create(ctx context.Context, sim *domain.DeviceSimulation) error {
	return r.db.WithContext(ctx).Create(sim).Error
}

func (r *gormSimulationRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.DeviceSimulation, error) {
	var sim domain.DeviceSimulation
	err := r.db.WithContext(ctx).First(&sim, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &sim, nil
}

func (r *gormSimulationRepo) Update(ctx context.Context, sim *domain.DeviceSimulation) error {
	return r.db.WithContext(ctx).Save(sim).Error
}
