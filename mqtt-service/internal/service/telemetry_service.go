package service

import (
	"mqtt-service/internal/dto"
	"mqtt-service/internal/models"
	"mqtt-service/internal/repository"

	"github.com/google/uuid"
)

type TelemetryService struct {
	telemetryRepo repository.TelemetryRepository
}

func NewTelemetryService(telemetryRepo repository.TelemetryRepository) *TelemetryService {
	return &TelemetryService{
		telemetryRepo: telemetryRepo,
	}
}

func (s *TelemetryService) RecordTelemetry(deviceID uuid.UUID, topic string, payload string) error {
	telemetry := &models.Telemetry{
		DeviceID: deviceID,
		Topic:    topic,
		Payload:  payload,
	}
	return s.telemetryRepo.Create(telemetry)
}

func (s *TelemetryService) GetTelemetry(deviceID uuid.UUID, limit int) (*dto.DeviceTelemetryResponse, error) {
	if limit <= 0 {
		limit = 50
	}
	list, err := s.telemetryRepo.ListByDevice(deviceID, limit)
	if err != nil {
		return nil, err
	}

	telemetryDTOs := make([]dto.TelemetryDTO, len(list))
	for i, t := range list {
		telemetryDTOs[i] = dto.TelemetryDTO{
			Topic:     t.Topic,
			Payload:   t.Payload,
			CreatedAt: t.CreatedAt,
		}
	}

	return &dto.DeviceTelemetryResponse{
		DeviceID:  deviceID.String(),
		Telemetry: telemetryDTOs,
	}, nil
}
