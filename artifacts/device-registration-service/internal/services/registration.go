package services

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/device-registration-service/internal/domain"
	"github.com/luma-smart-home/device-registration-service/internal/events"
	"github.com/luma-smart-home/device-registration-service/internal/repository"
	"github.com/luma-smart-home/device-registration-service/internal/security"
)

type RegistrationService struct {
	controllerRepo repository.ControllerRepository
	credsRepo      repository.CredentialsRepository
	simRepo        repository.SimulationRepository
	configRepo     repository.ConfigurationRepository
	resourceRepo   repository.ResourceRepository
	capRepo        repository.CapabilityRepository
	encryptor      security.AESGCMEncryptor
	publisher      events.Publisher
}

func NewRegistrationService(
	controllerRepo repository.ControllerRepository,
	credsRepo repository.CredentialsRepository,
	simRepo repository.SimulationRepository,
	configRepo repository.ConfigurationRepository,
	resourceRepo repository.ResourceRepository,
	capRepo repository.CapabilityRepository,
	encryptor security.AESGCMEncryptor,
	publisher events.Publisher,
) *RegistrationService {
	return &RegistrationService{
		controllerRepo: controllerRepo,
		credsRepo:      credsRepo,
		simRepo:        simRepo,
		configRepo:     configRepo,
		resourceRepo:   resourceRepo,
		capRepo:        capRepo,
		encryptor:      encryptor,
		publisher:      publisher,
	}
}

// StartSimulation initializes a simulation controller record and generates a setup blueprint
func (s *RegistrationService) StartSimulation(ctx context.Context, userID uuid.UUID, controllerType string, blueprint map[string]interface{}) (uuid.UUID, string, error) {
	simID := uuid.New()
	token, err := security.GenerateRandomSecret(16)
	if err != nil {
		return uuid.Nil, "", err
	}

	blueprintBytes, err := domain.MarshalJSONB(blueprint)
	if err != nil {
		return uuid.Nil, "", err
	}

	sim := &domain.DeviceSimulation{
		ID:              simID,
		UserID:          userID,
		ControllerType:  controllerType,
		LayoutBlueprint: blueprintBytes,
		Status:          "simulation",
		CreatedAt:       time.Now(),
	}

	if err := s.simRepo.Create(ctx, sim); err != nil {
		return uuid.Nil, "", err
	}

	// Create a temporary, unlinked controller skeleton representing the simulation device
	ctrl := &domain.Controller{
		ID:              simID,
		OwnerReference:  userID,
		SerialNumber:    "SIM-" + simID.String()[:8],
		DeviceType:      controllerType,
		Status:          "simulation",
		CreatedAt:       time.Now(),
	}

	if err := s.controllerRepo.Create(ctx, ctrl); err != nil {
		return uuid.Nil, "", err
	}

	// Store registration credentials linked to this simulation controller
	creds := &domain.DeviceCredentials{
		ID:                uuid.New(),
		ControllerID:      simID,
		RegistrationToken: token,
		CreatedAt:         time.Now(),
	}

	if err := s.credsRepo.Create(ctx, creds); err != nil {
		return uuid.Nil, "", err
	}

	_ = s.publisher.Publish(ctx, "DEVICE_SIMULATION_CREATED", map[string]interface{}{
		"simulation_id": simID.String(),
		"user_id":       userID.String(),
	})

	return simID, token, nil
}

// CompleteRegistration promotes a simulation controller to a real active hardware device
func (s *RegistrationService) CompleteRegistration(ctx context.Context, token, serial, mac, chipID string) (*domain.Controller, string, string, error) {
	creds, err := s.credsRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, "", "", errors.New("invalid registration token")
	}

	ctrl, err := s.controllerRepo.GetByID(ctx, creds.ControllerID)
	if err != nil {
		return nil, "", "", errors.New("associated simulation device not found")
	}

	sim, err := s.simRepo.GetByID(ctx, ctrl.ID)
	if err != nil {
		return nil, "", "", errors.New("associated simulation details not found")
	}

	// Populate real hardware details
	ctrl.SerialNumber = serial
	ctrl.MacAddress = mac
	ctrl.ChipID = chipID
	ctrl.Status = "active"
	now := time.Now()
	ctrl.RegisteredAt = &now

	if err := s.controllerRepo.Update(ctx, ctrl); err != nil {
		return nil, "", "", err
	}

	sim.Status = "registered"
	_ = s.simRepo.Update(ctx, sim)

	// Generate security credentials
	apiKey, err := security.GenerateRandomSecret(24)
	if err != nil {
		return nil, "", "", err
	}
	apiKeyHash := security.HashAPIKey(apiKey)

	mqttPassword, err := security.GenerateRandomSecret(16)
	if err != nil {
		return nil, "", "", err
	}
	encryptedMqttPass, err := s.encryptor.Encrypt(mqttPassword)
	if err != nil {
		return nil, "", "", err
	}

	deviceSecret, err := security.GenerateRandomSecret(32)
	if err != nil {
		return nil, "", "", err
	}
	encryptedSecret, err := s.encryptor.Encrypt(deviceSecret)
	if err != nil {
		return nil, "", "", err
	}

	creds.APIKeyHash = apiKeyHash
	creds.MqttUsername = "device-" + ctrl.ID.String()
	creds.EncryptedMqttPassword = encryptedMqttPass
	creds.EncryptedDeviceSecret = encryptedSecret
	creds.RegistrationToken = "" // invalidate single-use token

	if err := s.credsRepo.Update(ctx, creds); err != nil {
		return nil, "", "", err
	}

	// Process the logical layout configuration from simulation blueprints
	var layout map[string]interface{}
	_ = domain.UnmarshalJSONB(sim.LayoutBlueprint, &layout)

	// Translate logical elements inside simulation blueprint into real DB Resource records
	if layout != nil {
		if resList, ok := layout["resources"].([]interface{}); ok {
			for _, item := range resList {
				if rMap, ok := item.(map[string]interface{}); ok {
					name, _ := rMap["name"].(string)
					rType, _ := rMap["resource_type"].(string)
					gpio, _ := rMap["gpio"].(float64)

					res := &domain.Resource{
						ID:           uuid.New(),
						ControllerID: ctrl.ID,
						Name:         name,
						ResourceType: rType,
						CreatedAt:    time.Now(),
					}
					_ = s.resourceRepo.Create(ctx, res)

					// Build generic device capabilities based on type
					cap := &domain.DeviceCapability{
						ID:             uuid.New(),
						ResourceID:     res.ID,
						CapabilityName: "power_control",
						CreatedAt:      time.Now(),
					}
					_ = s.capRepo.Create(ctx, cap)

					// Update controller configurations pin layout mappings
					deviceConfig, err := s.configRepo.GetByController(ctx, ctrl.ID)
					if err != nil {
						// Create initial configuration
						gpioMap := map[string]interface{}{res.ID.String(): int(gpio)}
						gpioBytes, _ := domain.MarshalJSONB(gpioMap)
						deviceConfig = &domain.DeviceConfiguration{
							ID:           uuid.New(),
							ControllerID: ctrl.ID,
							GPIOMappings: gpioBytes,
							DeviceLogic:  domain.JSONB("{}"),
							CreatedAt:    time.Now(),
						}
						_ = s.configRepo.Create(ctx, deviceConfig)
					} else {
						var gpioMap map[string]interface{}
						_ = domain.UnmarshalJSONB(deviceConfig.GPIOMappings, &gpioMap)
						if gpioMap == nil {
							gpioMap = make(map[string]interface{})
						}
						gpioMap[res.ID.String()] = int(gpio)
						gpioBytes, _ := domain.MarshalJSONB(gpioMap)
						deviceConfig.GPIOMappings = gpioBytes
						_ = s.configRepo.Update(ctx, deviceConfig)
					}
				}
			}
		}
	}

	_ = s.publisher.Publish(ctx, "DEVICE_REGISTERED", map[string]interface{}{
		"controller_id": ctrl.ID.String(),
		"owner_id":      ctrl.OwnerReference.String(),
	})

	return ctrl, apiKey, mqttPassword, nil
}
