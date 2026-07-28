package health

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type MockNotificationDispatcher struct {
	AlertCount int
}

func (m *MockNotificationDispatcher) TriggerAlert(ctx context.Context, userID uuid.UUID, title, body string) error {
	m.AlertCount++
	return nil
}

func setupTestDB(t *testing.T) (*gorm.DB, func()) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=localhost user=postgres password=postgres dbname=postgres port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		t.Skip("Skipping Postgres-dependent test.")
		return nil, func() {}
	}

	tx := db.Begin()
	return tx, func() {
		tx.Rollback()
	}
}

func TestDeviceHealthService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	mockNotif := &MockNotificationDispatcher{}
	svc := NewService(repo, mockNotif, 2*time.Second)

	deviceID := uuid.New()
	userID := uuid.New()

	device := map[string]any{
		"id":                  deviceID,
		"owner_id":            userID,
		"name":                "ESP32 Test Device",
		"device_type":         "ESP32",
		"microcontroller_id":  "mc_123",
		"mac_address":         "00:11:22:33:44:55",
		"status":              "online",
		"registered_at":       time.Now(),
		"last_online_at":      time.Now(),
	}
	_ = db.Table("devices").Create(&device)

	temp := 24.5
	req := SubmitHeartbeatRequest{
		FirmwareVersion:    "1.0.0",
		HeapFreeBytes:      15*1024,
		FlashUsedBytes:     1024*1024,
		WifiRSSI:           -90,
		MqttConnected:      true,
		RestartCount:       1,
		TemperatureCelsius: &temp,
	}

	dto, err := svc.SubmitHeartbeat(context.Background(), deviceID, userID, req)
	if err != nil {
		t.Fatalf("Failed to submit heartbeat: %v", err)
	}

	if dto.WifiRSSI != -90 {
		t.Errorf("Expected wifi rssi -90, got %d", dto.WifiRSSI)
	}

	if mockNotif.AlertCount != 2 {
		t.Errorf("Expected 2 health warning notifications triggered, got %d", mockNotif.AlertCount)
	}

	summary, err := svc.GetSummary(context.Background(), deviceID)
	if err != nil {
		t.Fatalf("Failed to get summary: %v", err)
	}

	if summary.Status != "online" {
		t.Errorf("Expected status 'online', got %s", summary.Status)
	}

	if len(summary.History) != 1 {
		t.Errorf("Expected 1 history item, got %d", len(summary.History))
	}

	time.Sleep(3 * time.Second)
	svc.Tick(context.Background())

	summary2, _ := svc.GetSummary(context.Background(), deviceID)
	if summary2.Status != "offline" {
		t.Errorf("Expected status 'offline' after timeout, got %s", summary2.Status)
	}
}
