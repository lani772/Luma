package tests

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/device-registration-service/internal/ai"
	"github.com/luma-smart-home/device-registration-service/internal/domain"
	"github.com/luma-smart-home/device-registration-service/internal/events"
	"github.com/luma-smart-home/device-registration-service/internal/firmware"
	"github.com/luma-smart-home/device-registration-service/internal/handlers"
	"github.com/luma-smart-home/device-registration-service/internal/repository"
	"github.com/luma-smart-home/device-registration-service/internal/routes"
	"github.com/luma-smart-home/device-registration-service/internal/security"
	"github.com/luma-smart-home/device-registration-service/internal/services"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestRouter(t *testing.T) (*gin.Engine, *gorm.DB, *handlers.ControllerHandler, *security.JWTMiddleware) {
	// Initialize memory SQLite
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(
		&domain.Controller{},
		&domain.Room{},
		&domain.Resource{},
		&domain.DeviceCapability{},
		&domain.DeviceConfiguration{},
		&domain.DeviceCredentials{},
		&domain.DeviceSimulation{},
	)
	if err != nil {
		t.Fatalf("auto-migration failed: %v", err)
	}

	ctrlRepo := repository.NewControllerRepository(db)
	roomRepo := repository.NewRoomRepository(db)
	resRepo := repository.NewResourceRepository(db)
	capRepo := repository.NewCapabilityRepository(db)
	configRepo := repository.NewConfigurationRepository(db)
	credsRepo := repository.NewCredentialsRepository(db)
	simRepo := repository.NewSimulationRepository(db)

	encryptor, err := security.NewAESGCMEncryptor()
	if err != nil {
		t.Fatalf("failed encryptor: %v", err)
	}

	jwtMiddleware, err := security.NewJWTMiddleware()
	if err != nil {
		t.Fatalf("failed jwt: %v", err)
	}

	pub := events.NewLogPublisher()
	aiProvider := ai.NewMockAIProvider()
	fwGen := firmware.NewGenerator()

	regService := services.NewRegistrationService(
		ctrlRepo, credsRepo, simRepo, configRepo, resRepo, capRepo, encryptor, pub,
	)
	resService := services.NewResourceManagementService(
		ctrlRepo, resRepo, configRepo, roomRepo,
	)
	capService := services.NewCapabilityManagementService(
		resRepo, capRepo,
	)

	handler := handlers.NewControllerHandler(
		*regService, *resService, *capService, aiProvider, *fwGen, ctrlRepo, credsRepo,
	)

	r := gin.New()
	gin.SetMode(gin.TestMode)

	routes.RegisterControllerRoutes(r, handler, jwtMiddleware)

	return r, db, handler, jwtMiddleware
}

func TestCompleteSimulationOnboardingAndClaimWorkflow(t *testing.T) {
	router, _, _, _ := setupTestRouter(t)

	// Step 1: Start Simulation via /register/start (Authenticated via Mock header)
	userID := uuid.New().String()
	startBody := `{"prompt": "Create ESP32 controller with 6 lamps, 2 fans and temperature sensor", "controller_type": "ESP32"}`
	req, _ := http.NewRequest("POST", "/api/v1/controllers/register/start", strings.NewReader(startBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Mock-User-ID", userID)
	req.Header.Set("X-Mock-User-Role", "owner")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected simulation created status 201, got %d. Body: %s", w.Code, w.Body.String())
	}

	var startRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &startRes)

	simID := startRes["simulation_id"].(string)
	token := startRes["registration_token"].(string)

	if simID == "" || token == "" {
		t.Fatal("Expected non-empty simulation_id and registration_token")
	}

	// Step 2: Download compiled firmware Arduino ZIP (Authenticated)
	reqDownload, _ := http.NewRequest("GET", "/api/v1/controllers/register/firmware/"+simID, nil)
	reqDownload.Header.Set("X-Mock-User-ID", userID)
	reqDownload.Header.Set("X-Mock-User-Role", "owner")

	wDownload := httptest.NewRecorder()
	router.ServeHTTP(wDownload, reqDownload)

	if wDownload.Code != http.StatusOK {
		t.Fatalf("Expected 200 ZIP bytes download, got %d", wDownload.Code)
	}

	if wDownload.Header().Get("Content-Type") != "application/zip" {
		t.Fatalf("Expected application/zip Content-Type, got %s", wDownload.Header().Get("Content-Type"))
	}

	// Step 3: Complete First-Boot claims and register physically (Unauthenticated token check)
	registerBody := `{"registration_token": "` + token + `", "serial_number": "LUMA-ESP32-12345", "mac_address": "A4:CF:12:3D:7E:55", "chip_id": "esp32-wroom-chip"}`
	reqComplete, _ := http.NewRequest("POST", "/api/v1/controllers/register/complete", strings.NewReader(registerBody))
	reqComplete.Header.Set("Content-Type", "application/json")

	wComplete := httptest.NewRecorder()
	router.ServeHTTP(wComplete, reqComplete)

	if wComplete.Code != http.StatusOK {
		t.Fatalf("Expected registration status 200, got %d. Body: %s", wComplete.Code, wComplete.Body.String())
	}

	var completeRes map[string]interface{}
	_ = json.Unmarshal(wComplete.Body.Bytes(), &completeRes)

	apiKey := completeRes["device_api_key"].(string)
	if apiKey == "" {
		t.Fatal("Expected API key inside complete response")
	}

	// Step 4: Verify Separated DTO protection rules (Owner vs Public view parameters)
	// A) Owner-Level Detail retrieval (Authorized)
	reqOwner, _ := http.NewRequest("GET", "/api/v1/controllers/"+simID, nil)
	reqOwner.Header.Set("X-Mock-User-ID", userID)
	reqOwner.Header.Set("X-Mock-User-Role", "owner")

	wOwner := httptest.NewRecorder()
	router.ServeHTTP(wOwner, reqOwner)

	if wOwner.Code != http.StatusOK {
		t.Fatalf("Expected owner detail 200, got %d", wOwner.Code)
	}

	var ownerView map[string]interface{}
	_ = json.Unmarshal(wOwner.Body.Bytes(), &ownerView)

	if ownerView["mac_address"] == nil || ownerView["serial_number"] == nil {
		t.Fatal("Owner DTO view MUST include physical MAC Address and Serial parameters")
	}

	// B) Public View (Different user context, non-owner, hides parameters)
	otherUser := uuid.New().String()
	reqPublic, _ := http.NewRequest("GET", "/api/v1/controllers/"+simID, nil)
	reqPublic.Header.Set("X-Mock-User-ID", otherUser)
	reqPublic.Header.Set("X-Mock-User-Role", "viewer")

	wPublic := httptest.NewRecorder()
	router.ServeHTTP(wPublic, reqPublic)

	if wPublic.Code != http.StatusOK {
		t.Fatalf("Expected public view detail 200, got %d", wPublic.Code)
	}

	var publicView map[string]interface{}
	_ = json.Unmarshal(wPublic.Body.Bytes(), &publicView)

	if publicView["mac_address"] != nil || publicView["serial_number"] != nil {
		t.Fatal("Protected hardware MAC Address and Serial MUST be hidden for non-owner public views")
	}
}

func TestAESGCMEncryptionAtRest(t *testing.T) {
	encryptor, err := security.NewAESGCMEncryptor()
	if err != nil {
		t.Fatalf("failed initialization: %v", err)
	}

	secret := "secret-mqtt-password-12345"
	encrypted, err := encryptor.Encrypt(secret)
	if err != nil {
		t.Fatalf("failed encryption: %v", err)
	}

	if !strings.HasPrefix(encrypted, "1:") {
		t.Fatalf("invalid encryption version format: %s", encrypted)
	}

	decrypted, err := encryptor.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("failed decryption: %v", err)
	}

	if decrypted != secret {
		t.Fatalf("Expected decrypted secret to match '%s', got '%s'", secret, decrypted)
	}
}

func TestConflictPinAssignedThrowsError(t *testing.T) {
	_, db, _, _ := setupTestRouter(t)

	ctrlRepo := repository.NewControllerRepository(db)
	resRepo := repository.NewResourceRepository(db)
	configRepo := repository.NewConfigurationRepository(db)
	roomRepo := repository.NewRoomRepository(db)

	service := services.NewResourceManagementService(ctrlRepo, resRepo, configRepo, roomRepo)

	// Setup active controller
	ctrlID := uuid.New()
	ctrl := &domain.Controller{
		ID:           ctrlID,
		SerialNumber: "LUMA-ESP32-99",
		DeviceType:   "ESP32",
		Status:       "active",
		CreatedAt:    time.Now(),
	}
	_ = ctrlRepo.Create(context.Background(), ctrl)

	roomID := uuid.New()

	// Assign Lamp 1 to pin 15
	_, err := service.AddResource(context.Background(), ctrlID, "Lamp 1", "lamp", roomID, 15)
	if err != nil {
		t.Fatalf("Expected resource created, got error: %v", err)
	}

	// Assign Fan 1 to pin 15 as well (conflict)
	_, err = service.AddResource(context.Background(), ctrlID, "Fan 1", "fan", roomID, 15)
	if err == nil {
		t.Fatal("Expected error when assigning duplicate GPIO pin on same controller, got nil")
	}

	if err.Error() != "GPIO pin is already assigned to another resource on this controller" {
		t.Fatalf("Expected collision error, got '%v'", err)
	}
}
