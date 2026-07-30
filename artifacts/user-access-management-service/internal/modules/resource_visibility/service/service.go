package service

import (
	"context"

	"github.com/google/uuid"
)

type FullResource struct {
	DeviceID             string         `json:"deviceId"`
	MAC                  string         `json:"mac"`
	Firmware             string         `json:"firmware"`
	GPIO                 map[string]any `json:"gpio"`
	NetworkConfiguration map[string]any `json:"networkConfiguration"`
	MQTTConfiguration    map[string]any `json:"mqttConfiguration"`
	FriendlyName         string         `json:"friendlyName"`
	DeviceType           string         `json:"deviceType"`
	Room                 string         `json:"room"`
	OwnerInformation     map[string]any `json:"ownerInformation"`
	Status               string         `json:"status"`
}

type SanitizedResource struct {
	FriendlyName     string         `json:"friendlyName"`
	DeviceType       string         `json:"deviceType"`
	Room             string         `json:"room"`
	OwnerInformation map[string]any `json:"ownerInformation"`
	Status           string         `json:"status"`
}

type RoleReader interface {
	GetUserRoleOnController(ctx context.Context, userID, controllerID uuid.UUID) (string, error)
}

type Service struct {
	roleRead RoleReader
}

func NewService(roleRead RoleReader) *Service {
	return &Service{roleRead: roleRead}
}

func (s *Service) SanitizeResource(ctx context.Context, userID, controllerID uuid.UUID, res FullResource) (any, error) {
	role, err := s.roleRead.GetUserRoleOnController(ctx, userID, controllerID)
	if err == nil && role == "owner" {
		return res, nil
	}

	// Non-owner view: strip out MAC, firmware, GPIO, network, and MQTT configs
	return SanitizedResource{
		FriendlyName:     res.FriendlyName,
		DeviceType:       res.DeviceType,
		Room:             res.Room,
		OwnerInformation: res.OwnerInformation,
		Status:           res.Status,
	}, nil
}
