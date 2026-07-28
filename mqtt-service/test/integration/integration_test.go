package integration

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"mqtt-service/internal/api"
	"mqtt-service/internal/config"
	"mqtt-service/internal/dto"
	"mqtt-service/internal/models"
	"mqtt-service/internal/repository"
	"mqtt-service/internal/service"
	"mqtt-service/pkg/emqxclient"
	"mqtt-service/pkg/mqttclient"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestAPIIntegration(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// 1. Setup sqlite in memory DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect sqlite: %v", err)
	}

	_ = db.AutoMigrate(
		&models.User{},
		&models.Device{},
		&models.DeviceOwnership{},
		&models.Command{},
		&models.Telemetry{},
		&models.MQTTSubscription{},
		&models.AuditLog{},
		&models.MessageHistory{},
	)

	// 2. Setup repositories & services
	userRepo := repository.NewUserRepository(db)
	devRepo := repository.NewDeviceRepository(db)
	telRepo := repository.NewTelemetryRepository(db)
	cmdRepo := repository.NewCommandRepository(db)
	redis := repository.NewInMemoryRedisClient()
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	serverCfg := config.ServerConfig{
		JWTSecret:        "integration_test_jwt_secret_key_123456",
		JWTRefreshSecret: "integration_test_jwt_refresh_secret_key_123456",
		JWTAccessTTL:     5 * time.Minute,
		JWTRefreshTTL:    1 * time.Hour,
	}

	authSvc := service.NewAuthService(userRepo, serverCfg, redis)
	deviceSvc := service.NewDeviceService(devRepo, redis, log)
	telemetrySvc := service.NewTelemetryService(telRepo)

	mqttCfg := mqttclient.Config{BrokerHost: "localhost", BrokerPort: 1883}
	mqttCli := mqttclient.New(mqttCfg, log)
	cmdSvc := service.NewCommandService(cmdRepo, redis, mqttCli, log)

	emqxCfg := emqxclient.Config{}
	emqxCli := emqxclient.New(emqxCfg)

	h := api.NewHandlers(authSvc, deviceSvc, telemetrySvc, cmdSvc, redis, mqttCli, emqxCli)
	router := api.SetupRouter(h, authSvc, "test-api-key", log)

	// 3. Test Registration Endpoint
	regReq := dto.RegisterRequest{
		Username: "bob",
		Email:    "bob@example.com",
		Password: "password123",
	}
	regBytes, _ := json.Marshal(regReq)

	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(regBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201 Created, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 4. Test Login Endpoint
	loginReq := dto.LoginRequest{
		Username: "bob",
		Password: "password123",
	}
	loginBytes, _ := json.Marshal(loginReq)

	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", w.Code)
	}

	var tokens dto.TokenResponse
	_ = json.Unmarshal(w.Body.Bytes(), &tokens)
	if tokens.AccessToken == "" {
		t.Errorf("expected non-empty access token")
	}

	// 5. Test Register Device (Authorized)
	devReq := dto.DeviceRegisterRequest{Name: "Backyard Camera"}
	devBytes, _ := json.Marshal(devReq)

	req = httptest.NewRequest("POST", "/api/v1/devices/register", bytes.NewBuffer(devBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokens.AccessToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201 Created, got %d. Body: %s", w.Code, w.Body.String())
	}

	var devResp dto.DeviceResponse
	_ = json.Unmarshal(w.Body.Bytes(), &devResp)

	// 6. Test Get Device Status
	req = httptest.NewRequest("GET", "/api/v1/mqtt/devices/"+devResp.ID+"/status", nil)
	req.Header.Set("Authorization", "Bearer "+tokens.AccessToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", w.Code)
	}

	var statusResp dto.DeviceStatusResponse
	_ = json.Unmarshal(w.Body.Bytes(), &statusResp)
	if statusResp.Status != "offline" {
		t.Errorf("expected device status to be offline initially")
	}

	// 7. Test Send Command with API Key (Service Auth)
	cmdReq := dto.DeviceCommandRequest{Command: `{"power": "off"}`, QoS: 1}
	cmdBytes, _ := json.Marshal(cmdReq)

	req = httptest.NewRequest("POST", "/api/v1/mqtt/devices/"+devResp.ID+"/commands", bytes.NewBuffer(cmdBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "test-api-key")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK on service command dispatch, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 8. Test Stats Endpoint
	req = httptest.NewRequest("GET", "/api/v1/mqtt/stats", nil)
	req.Header.Set("X-API-Key", "test-api-key")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK on stats, got %d", w.Code)
	}

	var statsResp dto.StatsResponse
	_ = json.Unmarshal(w.Body.Bytes(), &statsResp)
	if statsResp.UptimeSeconds < 0 {
		t.Errorf("expected positive uptime")
	}
}
