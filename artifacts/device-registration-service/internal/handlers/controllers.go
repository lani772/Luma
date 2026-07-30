package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/device-registration-service/internal/ai"
	"github.com/luma-smart-home/device-registration-service/internal/domain"
	"github.com/luma-smart-home/device-registration-service/internal/firmware"
	"github.com/luma-smart-home/device-registration-service/internal/repository"
	"github.com/luma-smart-home/device-registration-service/internal/services"
)

type ControllerHandler struct {
	regService services.RegistrationService
	resService services.ResourceManagementService
	capService services.CapabilityManagementService
	aiProvider ai.Provider
	fwGen      firmware.Generator
	ctrlRepo   repository.ControllerRepository
	credsRepo  repository.CredentialsRepository
}

func NewControllerHandler(
	regService services.RegistrationService,
	resService services.ResourceManagementService,
	capService services.CapabilityManagementService,
	aiProvider ai.Provider,
	fwGen firmware.Generator,
	ctrlRepo repository.ControllerRepository,
	credsRepo repository.CredentialsRepository,
) *ControllerHandler {
	return &ControllerHandler{
		regService: regService,
		resService: resService,
		capService: capService,
		aiProvider: aiProvider,
		fwGen:      fwGen,
		ctrlRepo:   ctrlRepo,
		credsRepo:  credsRepo,
	}
}

// Separate DTOs to enforce physical hardware parameter visibility rules

type ControllerOwnerDTO struct {
	ID              uuid.UUID              `json:"id"`
	OwnerReference  uuid.UUID              `json:"owner_reference"`
	SerialNumber    string                 `json:"serial_number"`
	DeviceType      string                 `json:"device_type"`
	MacAddress      string                 `json:"mac_address"`
	ChipID          string                 `json:"chip_id"`
	HardwareVersion string                 `json:"hardware_version"`
	FirmwareVersion string                 `json:"firmware_version"`
	Status          string                 `json:"status"`
	Resources       []domain.Resource      `json:"resources"`
	Configuration   *domain.DeviceConfiguration `json:"configuration"`
}

type ControllerPublicDTO struct {
	ID             uuid.UUID         `json:"id"`
	OwnerReference uuid.UUID         `json:"owner_reference"`
	DeviceType     string            `json:"device_type"`
	Status         string            `json:"status"`
	Resources      []domain.Resource `json:"resources"`
}

type StartSimulationRequest struct {
	Prompt         string `json:"prompt" binding:"required"`
	ControllerType string `json:"controller_type" binding:"required"`
}

type CompleteRegistrationRequest struct {
	RegistrationToken string `json:"registration_token" binding:"required"`
	SerialNumber      string `json:"serial_number" binding:"required"`
	MacAddress        string `json:"mac_address" binding:"required"`
	ChipID            string `json:"chip_id" binding:"required"`
}

type UpdateHardwareConfigRequest struct {
	GPIOMappings map[string]interface{} `json:"gpio_mappings" binding:"required"`
}

func (h *ControllerHandler) StartSimulation(c *gin.Context) {
	var req StartSimulationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user identity context required"})
		return
	}
	userID := userIDVal.(uuid.UUID)

	blueprint, err := h.aiProvider.ParseLayoutPrompt(c.Request.Context(), req.Prompt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI provider layout generation failed"})
		return
	}

	simID, token, err := h.regService.StartSimulation(c.Request.Context(), userID, req.ControllerType, blueprint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"simulation_id":      simID.String(),
		"registration_token": token,
		"gpio_mappings":      blueprint,
	})
}

func (h *ControllerHandler) DownloadFirmware(c *gin.Context) {
	simIDStr := c.Param("simulation_id")
	simID, err := uuid.Parse(simIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid simulation UUID"})
		return
	}

	creds, err := h.credsRepo.GetByController(c.Request.Context(), simID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "associated simulation credentials not found"})
		return
	}

	ctrl, err := h.ctrlRepo.GetByID(c.Request.Context(), simID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "associated simulation controller not found"})
		return
	}

	zipBytes, err := h.fwGen.GenerateZIP(creds.RegistrationToken, simID.String(), ctrl.SerialNumber, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate firmware ZIP archive"})
		return
	}

	c.Header("Content-Disposition", "attachment; filename=luma-firmware-"+simID.String()[:8]+".zip")
	c.Data(http.StatusOK, "application/zip", zipBytes)
}

func (h *ControllerHandler) CompleteRegistration(c *gin.Context) {
	var req CompleteRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctrl, apiKey, mqttPass, err := h.regService.CompleteRegistration(
		c.Request.Context(),
		req.RegistrationToken,
		req.SerialNumber,
		req.MacAddress,
		req.ChipID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"controller_id":  ctrl.ID.String(),
		"device_api_key": apiKey,
		"mqtt_username":  "device-" + ctrl.ID.String(),
		"mqtt_password":  mqttPass,
	})
}

func (h *ControllerHandler) GetController(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid controller UUID"})
		return
	}

	ctrl, err := h.ctrlRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "controller not found"})
		return
	}

	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user identity context required"})
		return
	}
	userID := userIDVal.(uuid.UUID)

	userRoleVal, _ := c.Get("userRole")
	userRole := ""
	if userRoleVal != nil {
		userRole = userRoleVal.(string)
	}

	// Owner check: Is the caller the registered device owner, or does the claim match ownerRole?
	isOwner := ctrl.OwnerReference == userID || userRole == "owner" || userRole == "device_admin"

	if isOwner {
		ownerDTO := ControllerOwnerDTO{
			ID:              ctrl.ID,
			OwnerReference:  ctrl.OwnerReference,
			SerialNumber:    ctrl.SerialNumber,
			DeviceType:      ctrl.DeviceType,
			MacAddress:      ctrl.MacAddress,
			ChipID:          ctrl.ChipID,
			HardwareVersion: ctrl.HardwareVersion,
			FirmwareVersion: ctrl.FirmwareVersion,
			Status:          ctrl.Status,
			Resources:       ctrl.Resources,
			Configuration:   ctrl.Configuration,
		}
		c.JSON(http.StatusOK, ownerDTO)
	} else {
		// Public View masks physical parameters
		publicDTO := ControllerPublicDTO{
			ID:             ctrl.ID,
			OwnerReference: ctrl.OwnerReference,
			DeviceType:     ctrl.DeviceType,
			Status:         ctrl.Status,
			Resources:      ctrl.Resources,
		}
		c.JSON(http.StatusOK, publicDTO)
	}
}

func (h *ControllerHandler) ListControllers(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user identity context required"})
		return
	}
	userID := userIDVal.(uuid.UUID)

	ctrls, err := h.ctrlRepo.ListByOwner(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// For simple lists under owner reference context, serialize as Owner DTO view
	dtos := make([]ControllerOwnerDTO, len(ctrls))
	for i, ctrl := range ctrls {
		dtos[i] = ControllerOwnerDTO{
			ID:              ctrl.ID,
			OwnerReference:  ctrl.OwnerReference,
			SerialNumber:    ctrl.SerialNumber,
			DeviceType:      ctrl.DeviceType,
			MacAddress:      ctrl.MacAddress,
			ChipID:          ctrl.ChipID,
			HardwareVersion: ctrl.HardwareVersion,
			FirmwareVersion: ctrl.FirmwareVersion,
			Status:          ctrl.Status,
			Resources:       ctrl.Resources,
			Configuration:   ctrl.Configuration,
		}
	}

	c.JSON(http.StatusOK, dtos)
}

func (h *ControllerHandler) UpdateHardwareConfig(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid controller UUID"})
		return
	}

	var req UpdateHardwareConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	deviceConfig, err := h.ctrlRepo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "controller configuration not found"})
		return
	}

	// Owner authorization check
	userIDVal, exists := c.Get("userID")
	if !exists || deviceConfig.OwnerReference != userIDVal.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the device owner can modify hardware pin mappings"})
		return
	}

	mappingsJSON, err := json.Marshal(req.GPIOMappings)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to encode mappings JSON"})
		return
	}

	if deviceConfig.Configuration == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "physical device configuration uninitialized"})
		return
	}

	deviceConfig.Configuration.GPIOMappings = domain.JSONB(mappingsJSON)
	deviceConfig.Configuration.Version++

	_ = h.ctrlRepo.Update(c.Request.Context(), deviceConfig)

	c.JSON(http.StatusOK, gin.H{"status": "hardware pin mappings updated", "version": deviceConfig.Configuration.Version})
}
