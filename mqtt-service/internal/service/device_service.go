package service

import (
	"errors"
	"log/slog"
	"mqtt-service/internal/dto"
	"mqtt-service/internal/models"
	"mqtt-service/internal/repository"
	"time"

	"github.com/google/uuid"
)

type DeviceService struct {
	deviceRepo repository.DeviceRepository
	redis      repository.RedisClient
	log        *slog.Logger
}

func NewDeviceService(deviceRepo repository.DeviceRepository, redis repository.RedisClient, log *slog.Logger) *DeviceService {
	return &DeviceService{
		deviceRepo: deviceRepo,
		redis:      redis,
		log:        log,
	}
}

func (s *DeviceService) RegisterDevice(req dto.DeviceRegisterRequest, userID uuid.UUID) (*dto.DeviceResponse, error) {
	dev := &models.Device{
		ID:       uuid.New(),
		Name:     req.Name,
		Status:   "offline",
		LastSeen: time.Now(),
	}

	err := s.deviceRepo.Create(dev)
	if err != nil {
		return nil, err
	}

	ownership := &models.DeviceOwnership{
		UserID:   userID,
		DeviceID: dev.ID,
		Role:     "owner",
	}

	err = s.deviceRepo.CreateOwnership(ownership)
	if err != nil {
		return nil, err
	}

	return &dto.DeviceResponse{
		ID:        dev.ID.String(),
		Name:      dev.Name,
		Status:    dev.Status,
		LastSeen:  dev.LastSeen,
		CreatedAt: dev.CreatedAt,
	}, nil
}

func (s *DeviceService) FindDeviceByID(deviceID uuid.UUID) (*dto.DeviceResponse, error) {
	dev, err := s.deviceRepo.FindByID(deviceID)
	if err != nil {
		return nil, err
	}
	if dev == nil {
		return nil, errors.New("device not found")
	}

	// Update status dynamically from Redis presence
	online, _ := s.redis.GetDevicePresence(deviceID.String())
	status := "offline"
	if online {
		status = "online"
	}

	return &dto.DeviceResponse{
		ID:        dev.ID.String(),
		Name:      dev.Name,
		Status:    status,
		LastSeen:  dev.LastSeen,
		CreatedAt: dev.CreatedAt,
	}, nil
}

func (s *DeviceService) CheckOwnership(userID, deviceID uuid.UUID) (bool, error) {
	return s.deviceRepo.CheckOwnership(userID, deviceID)
}

func (s *DeviceService) UpdateDeviceStatus(deviceID uuid.UUID, online bool) error {
	status := "offline"
	if online {
		status = "online"
	}

	err := s.deviceRepo.UpdateStatus(deviceID, status)
	if err != nil {
		return err
	}

	// Keep-alive or presence expiration set to 120 seconds in Redis
	return s.redis.SetDevicePresence(deviceID.String(), online, 120*time.Second)
}

func (s *DeviceService) GetDeviceStatus(deviceID uuid.UUID) (*dto.DeviceStatusResponse, error) {
	dev, err := s.deviceRepo.FindByID(deviceID)
	if err != nil {
		return nil, err
	}
	if dev == nil {
		return nil, errors.New("device not found")
	}

	online, _ := s.redis.GetDevicePresence(deviceID.String())
	status := "offline"
	if online {
		status = "online"
	}

	return &dto.DeviceStatusResponse{
		DeviceID: deviceID.String(),
		Status:   status,
		LastSeen: dev.LastSeen,
	}, nil
}
