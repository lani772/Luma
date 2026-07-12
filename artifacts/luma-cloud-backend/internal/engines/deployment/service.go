package deployment

import (
	"context"
	"errors"
	"hash/fnv"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
)

type FirmwareLookup interface {
	GetDeviceTypeAndVersion(ctx context.Context, firmwareID uuid.UUID) (deviceType string, version string, err error)
}

type Service struct {
	repo         *Repository
	firmwareLookup FirmwareLookup
}

func NewService(repo *Repository, fw FirmwareLookup) *Service {
	return &Service{
		repo:           repo,
		firmwareLookup: fw,
	}
}

func rolloutEligible(deviceID uuid.UUID, percentage int) bool {
	h := fnv.New32a()
	_, _ = h.Write(deviceID[:])
	return int(h.Sum32()%100) < percentage
}

func (s *Service) Create(ctx context.Context, req CreateDeploymentRequest) (*DeploymentDTO, error) {
	firmwareID, err := uuid.Parse(req.FirmwareID)
	if err != nil {
		return nil, errors.New("invalid firmware id")
	}

	deviceType, _, err := s.firmwareLookup.GetDeviceTypeAndVersion(ctx, firmwareID)
	if err != nil {
		return nil, err
	}

	status := "scheduled"
	if req.ScheduledAt == nil {
		status = "pending"
	}

	dep := &models.FirmwareDeployment{
		ID:                uuid.New(),
		FirmwareID:        firmwareID,
		Name:              req.Name,
		Status:            status,
		RolloutPercentage: req.RolloutPercentage,
		ScheduledAt:       req.ScheduledAt,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Create(dep); err != nil {
		return nil, err
	}

	// If pending (immediate rollout), we can execute it directly or let the worker pick it up.
	// Let's change status to scheduled so the background worker picks it up and processes it,
	// or trigger processing directly. Let's make it easy: the background worker regularly executes pending campaigns.
	if status == "pending" {
		err = s.StartRollout(dep.ID, deviceType)
		if err != nil {
			return nil, err
		}
	}

	return s.Get(dep.ID)
}

func (s *Service) StartRollout(id uuid.UUID, deviceType string) error {
	dep, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	// Find devices matching device type
	devices, err := s.repo.FindEligibleDevices(deviceType)
	if err != nil {
		return err
	}

	if err := s.repo.UpdateStatus(id, "running"); err != nil {
		return err
	}

	hasEligible := false
	for _, dev := range devices {
		if rolloutEligible(dev.ID, dep.RolloutPercentage) {
			hasEligible = true
			devDep := &models.DeviceDeployment{
				ID:           uuid.New(),
				DeploymentID: dep.ID,
				DeviceID:     dev.ID,
				Status:       "pending",
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			}
			_ = s.repo.SaveDeviceDeployment(devDep)
		}
	}

	if !hasEligible {
		return s.repo.UpdateStatus(id, "completed")
	}

	return nil
}

func (s *Service) Get(id uuid.UUID) (*DeploymentDTO, error) {
	dep, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	devices, err := s.repo.ListDevicesByDeployment(id)
	if err != nil {
		return nil, err
	}

	deviceDTOs := make([]DeviceStatusDTO, 0, len(devices))
	var stats DeploymentStatsDTO
	stats.Total = len(devices)

	for _, d := range devices {
		var errMsg *string
		if d.ErrorMessage != nil {
			errMsg = d.ErrorMessage
		}
		deviceDTOs = append(deviceDTOs, DeviceStatusDTO{
			DeviceID:     d.DeviceID.String(),
			Status:       d.Status,
			ErrorMessage: errMsg,
			Retries:      d.Retries,
			UpdatedAt:    d.UpdatedAt,
		})

		switch d.Status {
		case "pending":
			stats.Pending++
		case "running":
			stats.Running++
		case "completed":
			stats.Completed++
		case "failed":
			stats.Failed++
		}
	}

	return &DeploymentDTO{
		ID:                dep.ID.String(),
		FirmwareID:        dep.FirmwareID.String(),
		Name:              dep.Name,
		Status:            dep.Status,
		RolloutPercentage: dep.RolloutPercentage,
		ScheduledAt:       dep.ScheduledAt,
		CreatedAt:         dep.CreatedAt,
		UpdatedAt:         dep.UpdatedAt,
		Devices:           deviceDTOs,
		Stats:             &stats,
	}, nil
}

func (s *Service) List(page, perPage int) ([]DeploymentDTO, int64, error) {
	deps, total, err := s.repo.List(page, perPage)
	if err != nil {
		return nil, 0, err
	}

	dtoList := make([]DeploymentDTO, 0, len(deps))
	for _, d := range deps {
		dto, _ := s.Get(d.ID) // populate stats but omit devices for list readability
		dto.Devices = nil
		dtoList = append(dtoList, *dto)
	}

	return dtoList, total, nil
}

func (s *Service) RetryDevice(deploymentID, deviceID uuid.UUID) error {
	devDep, err := s.repo.FindDeviceDeployment(deploymentID, deviceID)
	if err != nil {
		return err
	}
	if devDep == nil {
		return errors.New("device deployment not found")
	}

	devDep.Status = "pending"
	devDep.Retries++
	devDep.UpdatedAt = time.Now()
	devDep.ErrorMessage = nil

	return s.repo.SaveDeviceDeployment(devDep)
}

func (s *Service) Rollback(id uuid.UUID) error {
	_, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	if err := s.repo.UpdateStatus(id, "rolled_back"); err != nil {
		return err
	}

	devices, err := s.repo.ListDevicesByDeployment(id)
	if err != nil {
		return err
	}

	for _, devDep := range devices {
		devDep.Status = "rolled_back"
		devDep.UpdatedAt = time.Now()
		_ = s.repo.SaveDeviceDeployment(&devDep)
	}

	return nil
}

// Tick handles scheduled campaign triggering and progress monitoring
func (s *Service) Tick(ctx context.Context) {
	// Trigger scheduled campaigns
	scheduled, err := s.repo.FindScheduledDeployments()
	if err == nil {
		for _, dep := range scheduled {
			deviceType, _, err := s.firmwareLookup.GetDeviceTypeAndVersion(ctx, dep.FirmwareID)
			if err == nil {
				_ = s.StartRollout(dep.ID, deviceType)
			}
		}
	}

	// Monitor running campaigns and resolve status transitions
	running, err := s.repo.FindRunningDeployments()
	if err == nil {
		for _, dep := range running {
			devices, err := s.repo.ListDevicesByDeployment(dep.ID)
			if err == nil {
				allDone := true
				hasFailures := false
				for _, devDep := range devices {
					// Simulate device progression for Phase 2:
					// Normally device checks for update -> moves to Running -> Completed/Failed.
					// We'll simulate progression from pending -> running -> completed here for mock demonstration purposes.
					if devDep.Status == "pending" {
						devDep.Status = "running"
						devDep.UpdatedAt = time.Now()
						_ = s.repo.SaveDeviceDeployment(&devDep)
						allDone = false
					} else if devDep.Status == "running" {
						devDep.Status = "completed"
						devDep.UpdatedAt = time.Now()
						_ = s.repo.SaveDeviceDeployment(&devDep)
					} else if devDep.Status == "failed" {
						hasFailures = true
					}
				}
				if allDone {
					newStatus := "completed"
					if hasFailures {
						newStatus = "failed"
					}
					_ = s.repo.UpdateStatus(dep.ID, newStatus)
				}
			}
		}
	}
}
