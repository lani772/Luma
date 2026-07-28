package health

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
)

type NotificationDispatcher interface {
	TriggerAlert(ctx context.Context, userID uuid.UUID, title, body string) error
}

type Service struct {
	repo       *Repository
	notif      NotificationDispatcher
	offTimeout time.Duration
}

func NewService(repo *Repository, notif NotificationDispatcher, offTimeout time.Duration) *Service {
	if offTimeout <= 0 {
		offTimeout = 5 * time.Minute
	}
	return &Service{
		repo:       repo,
		notif:      notif,
		offTimeout: offTimeout,
	}
}

func (s *Service) SubmitHeartbeat(ctx context.Context, deviceID uuid.UUID, ownerID uuid.UUID, req SubmitHeartbeatRequest) (*HealthReportDTO, error) {
	now := time.Now()
	_ = s.repo.UpdateDeviceStatus(deviceID, "online", &now)

	rep := &models.DeviceHealthReport{
		ID:                 uuid.New(),
		DeviceID:           deviceID,
		FirmwareVersion:    &req.FirmwareVersion,
		HeapFreeBytes:      req.HeapFreeBytes,
		FlashUsedBytes:     req.FlashUsedBytes,
		WifiRSSI:           req.WifiRSSI,
		MqttConnected:      req.MqttConnected,
		RestartCount:       req.RestartCount,
		TemperatureCelsius: req.TemperatureCelsius,
		CreatedAt:          now,
	}

	if err := s.repo.SaveReport(rep); err != nil {
		return nil, err
	}

	if s.notif != nil {
		if req.HeapFreeBytes < 20*1024 {
			_ = s.notif.TriggerAlert(ctx, ownerID, "Device Health Alert: Low Memory", fmt.Sprintf("Device %s is running low on heap memory.", deviceID))
		}
		if req.WifiRSSI < -85 {
			_ = s.notif.TriggerAlert(ctx, ownerID, "Device Health Alert: Poor Wi-Fi Signal", fmt.Sprintf("Device %s has poor Wi-Fi reception (%d dBm).", deviceID, req.WifiRSSI))
		}
	}

	return toHealthReportDTO(rep), nil
}

func (s *Service) GetSummary(ctx context.Context, deviceID uuid.UUID) (*DeviceHealthSummaryDTO, error) {
	latest, _ := s.repo.FindLatestReport(deviceID)
	history, _ := s.repo.ListReports(deviceID, 10)

	historyDTOs := make([]HealthReportDTO, 0, len(history))
	for _, h := range history {
		historyDTOs = append(historyDTOs, *toHealthReportDTO(&h))
	}

	var latestDTO *HealthReportDTO
	if latest != nil {
		latestDTO = toHealthReportDTO(latest)
	}

	var status string = "offline"
	var lastOnline *time.Time
	devices, err := s.repo.ListAllDevices()
	if err == nil {
		for _, d := range devices {
			if d.ID == deviceID {
				status = string(d.Status)
				lastOnline = d.LastOnlineAt
				break
			}
		}
	}

	return &DeviceHealthSummaryDTO{
		DeviceID:      deviceID.String(),
		Status:        status,
		LastHeartbeat: lastOnline,
		LatestReport:  latestDTO,
		History:       historyDTOs,
	}, nil
}

func (s *Service) Tick(ctx context.Context) {
	devices, err := s.repo.ListAllDevices()
	if err != nil {
		return
	}

	now := time.Now()
	for _, d := range devices {
		if d.Status == "online" && d.LastOnlineAt != nil {
			if now.Sub(*d.LastOnlineAt) > s.offTimeout {
				_ = s.repo.UpdateDeviceStatus(d.ID, "offline", nil)

				if s.notif != nil {
					_ = s.notif.TriggerAlert(ctx, d.OwnerID, "Device Offline Alert", fmt.Sprintf("Your device %s went offline.", d.Name))
				}
			}
		}
	}
}

func toHealthReportDTO(r *models.DeviceHealthReport) *HealthReportDTO {
	return &HealthReportDTO{
		ID:                 r.ID.String(),
		DeviceID:           r.DeviceID.String(),
		FirmwareVersion:    r.FirmwareVersion,
		HeapFreeBytes:      r.HeapFreeBytes,
		FlashUsedBytes:     r.FlashUsedBytes,
		WifiRSSI:           r.WifiRSSI,
		MqttConnected:      r.MqttConnected,
		RestartCount:       r.RestartCount,
		TemperatureCelsius: r.TemperatureCelsius,
		CreatedAt:          r.CreatedAt,
	}
}
