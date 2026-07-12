package devices

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/engines/users"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"gorm.io/gorm"
)

var (
	ErrDeviceAlreadyRegistered = errors.New("device already registered")
	ErrDeviceNotFound          = errors.New("device not found")
	ErrNotOwner                = errors.New("only the device owner can perform this action")
	ErrUserNotFound            = errors.New("user not found")
)

// UserLookup lets this engine resolve an email to a user id (for ownership
// transfer / admin grants) without importing the whole auth engine.
type UserLookup interface {
	FindUserIDByEmail(email string) (uuid.UUID, error)
}

type AuditRecorder interface {
	Record(actorUserID *uuid.UUID, action, resourceType, resourceID, ipAddress string, metadata map[string]any)
}

type noopAuditRecorder struct{}

func (noopAuditRecorder) Record(*uuid.UUID, string, string, string, string, map[string]any) {}

type Service struct {
	repo   *Repository
	users  UserLookup
	audit  AuditRecorder
}

func NewService(repo *Repository, users UserLookup, audit AuditRecorder) *Service {
	if audit == nil {
		audit = noopAuditRecorder{}
	}
	return &Service{repo: repo, users: users, audit: audit}
}

func (s *Service) Register(ownerID uuid.UUID, req RegisterDeviceRequest, ip string) (*DeviceDTO, error) {
	if _, err := s.repo.FindByMAC(req.MACAddress); err == nil {
		return nil, ErrDeviceAlreadyRegistered
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("devices: lookup mac: %w", err)
	}

	caps := make(models.JSONList, len(req.Capabilities))
	for i, c := range req.Capabilities {
		caps[i] = c
	}

	device := &models.Device{
		ID:                uuid.New(),
		OwnerID:           ownerID,
		Name:              req.Name,
		DeviceType:        req.DeviceType,
		MicrocontrollerID: req.MicrocontrollerID,
		MACAddress:        req.MACAddress,
		Capabilities:      caps,
		Status:            models.DeviceStatusPending,
	}
	if req.FirmwareVersion != "" {
		device.FirmwareVersion = &req.FirmwareVersion
	}
	if err := s.repo.Create(device); err != nil {
		return nil, fmt.Errorf("devices: create: %w", err)
	}

	s.appendHistory(device.ID, models.DeviceEventRegistered, &ownerID, map[string]any{"deviceType": req.DeviceType})
	s.audit.Record(&ownerID, "device.registered", "device", device.ID.String(), ip, nil)

	return s.toDTO(device)
}

func (s *Service) Get(deviceID uuid.UUID) (*DeviceDTO, error) {
	device, err := s.repo.FindByID(deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDeviceNotFound
		}
		return nil, err
	}
	return s.toDTO(device)
}

func (s *Service) List(userID uuid.UUID, page, perPage int) ([]DeviceDTO, int64, error) {
	deviceList, total, err := s.repo.ListForUser(userID, page, perPage)
	if err != nil {
		return nil, 0, err
	}
	out := make([]DeviceDTO, 0, len(deviceList))
	for i := range deviceList {
		dto, err := s.toDTO(&deviceList[i])
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *dto)
	}
	return out, total, nil
}

func (s *Service) Update(deviceID, actorID uuid.UUID, req UpdateDeviceRequest, ip string) (*DeviceDTO, error) {
	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.FirmwareVersion != nil {
		updates["firmware_version"] = *req.FirmwareVersion
	}
	if req.Capabilities != nil {
		caps := make(models.JSONList, len(req.Capabilities))
		for i, c := range req.Capabilities {
			caps[i] = c
		}
		updates["capabilities"] = caps
	}
	if len(updates) > 0 {
		if err := s.repo.Update(deviceID, updates); err != nil {
			return nil, err
		}
	}
	s.appendHistory(deviceID, models.DeviceEventUpdated, &actorID, updates)
	s.audit.Record(&actorID, "device.updated", "device", deviceID.String(), ip, updates)
	return s.Get(deviceID)
}

func (s *Service) Remove(deviceID, actorID uuid.UUID, ip string) error {
	s.appendHistory(deviceID, models.DeviceEventRemoved, &actorID, nil)
	s.audit.Record(&actorID, "device.removed", "device", deviceID.String(), ip, nil)
	return s.repo.Delete(deviceID)
}

// TransferOwnership implements the "Transfer Ownership" requirement: the new
// owner must already have an account (resolved by email via UserLookup);
// the old owner is automatically demoted to admin so they don't lose access
// outright.
func (s *Service) TransferOwnership(deviceID, currentOwnerID uuid.UUID, newOwnerEmail, ip string) (*DeviceDTO, error) {
	device, err := s.repo.FindByID(deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDeviceNotFound
		}
		return nil, err
	}
	if device.OwnerID != currentOwnerID {
		return nil, ErrNotOwner
	}

	newOwnerID, err := s.users.FindUserIDByEmail(newOwnerEmail)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if err := s.repo.Update(deviceID, map[string]any{"owner_id": newOwnerID}); err != nil {
		return nil, err
	}
	_ = s.repo.AddAdmin(&models.DeviceAdmin{DeviceID: deviceID, UserID: currentOwnerID, GrantedBy: &newOwnerID})

	s.appendHistory(deviceID, models.DeviceEventOwnershipTransferred, &currentOwnerID, map[string]any{
		"fromOwnerId": currentOwnerID.String(),
		"toOwnerId":   newOwnerID.String(),
	})
	s.audit.Record(&currentOwnerID, "device.ownership_transferred", "device", deviceID.String(), ip, map[string]any{"newOwnerId": newOwnerID.String()})

	return s.Get(deviceID)
}

func (s *Service) GrantAdmin(deviceID, grantedBy uuid.UUID, userEmail, ip string) error {
	targetID, err := s.users.FindUserIDByEmail(userEmail)
	if err != nil {
		return ErrUserNotFound
	}
	if err := s.repo.AddAdmin(&models.DeviceAdmin{DeviceID: deviceID, UserID: targetID, GrantedBy: &grantedBy}); err != nil {
		return err
	}
	s.appendHistory(deviceID, models.DeviceEventAdminGranted, &grantedBy, map[string]any{"userId": targetID.String()})
	s.audit.Record(&grantedBy, "device.admin_granted", "device", deviceID.String(), ip, map[string]any{"userId": targetID.String()})
	return nil
}

func (s *Service) RevokeAdmin(deviceID, revokedBy, targetUserID uuid.UUID, ip string) error {
	if err := s.repo.RemoveAdmin(deviceID, targetUserID); err != nil {
		return err
	}
	s.appendHistory(deviceID, models.DeviceEventAdminRevoked, &revokedBy, map[string]any{"userId": targetUserID.String()})
	s.audit.Record(&revokedBy, "device.admin_revoked", "device", deviceID.String(), ip, map[string]any{"userId": targetUserID.String()})
	return nil
}

func (s *Service) History(deviceID uuid.UUID, page, perPage int) ([]DeviceHistoryEntryDTO, int64, error) {
	entries, total, err := s.repo.ListHistory(deviceID, page, perPage)
	if err != nil {
		return nil, 0, err
	}
	out := make([]DeviceHistoryEntryDTO, 0, len(entries))
	for _, e := range entries {
		var actor *string
		if e.ActorUserID != nil {
			s := e.ActorUserID.String()
			actor = &s
		}
		out = append(out, DeviceHistoryEntryDTO{
			ID:          e.ID.String(),
			EventType:   string(e.EventType),
			ActorUserID: actor,
			Metadata:    map[string]any(e.Metadata),
			CreatedAt:   e.CreatedAt,
		})
	}
	return out, total, nil
}

// CanAccess returns true if userID is the owner or an admin of deviceID —
// the authorization check used by the devices route middleware.
func (s *Service) CanAccess(deviceID, userID uuid.UUID) (bool, error) {
	device, err := s.repo.FindByID(deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	if device.OwnerID == userID {
		return true, nil
	}
	return s.repo.IsAdmin(deviceID, userID)
}

// ListOwnedAndAdminDevices implements users.DeviceOwnershipReader.
func (s *Service) ListOwnedAndAdminDevices(userID uuid.UUID) ([]users.OwnedDeviceSummaryDTO, error) {
	deviceList, roleByDevice, err := s.repo.ListOwnedAndAdminSummaries(userID)
	if err != nil {
		return nil, err
	}
	out := make([]users.OwnedDeviceSummaryDTO, 0, len(deviceList))
	for _, d := range deviceList {
		out = append(out, users.OwnedDeviceSummaryDTO{
			ID:         d.ID.String(),
			Name:       d.Name,
			DeviceType: d.DeviceType,
			Status:     string(d.Status),
			Role:       roleByDevice[d.ID],
		})
	}
	return out, nil
}

func (s *Service) appendHistory(deviceID uuid.UUID, eventType models.DeviceHistoryEventType, actor *uuid.UUID, metadata map[string]any) {
	_ = s.repo.AppendHistory(&models.DeviceHistory{
		ID:          uuid.New(),
		DeviceID:    deviceID,
		EventType:   eventType,
		ActorUserID: actor,
		Metadata:    models.JSONMap(metadata),
	})
}

func (s *Service) toDTO(d *models.Device) (*DeviceDTO, error) {
	adminIDs, err := s.repo.ListAdminIDs(d.ID)
	if err != nil {
		return nil, err
	}
	adminStrs := make([]string, len(adminIDs))
	for i, id := range adminIDs {
		adminStrs[i] = id.String()
	}
	caps := make([]any, len(d.Capabilities))
	copy(caps, d.Capabilities)

	return &DeviceDTO{
		ID:                d.ID.String(),
		OwnerID:           d.OwnerID.String(),
		Name:              d.Name,
		DeviceType:        d.DeviceType,
		MicrocontrollerID: d.MicrocontrollerID,
		MACAddress:        d.MACAddress,
		FirmwareVersion:   d.FirmwareVersion,
		Capabilities:      caps,
		Status:            string(d.Status),
		RegisteredAt:      d.RegisteredAt,
		LastOnlineAt:      d.LastOnlineAt,
		LastSyncAt:        d.LastSyncAt,
		AdminUserIDs:      adminStrs,
	}, nil
}
