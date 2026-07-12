package notifications

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type MockUserPrefsReader struct {
	Types []string
	Token string
	Email string
}

func (m *MockUserPrefsReader) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) ([]string, *string, *string, error) {
	return m.Types, &m.Token, &m.Email, nil
}

func setupTestDB(t *testing.T) (*gorm.DB, func()) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "host=localhost user=postgres password=postgres dbname=postgres port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		t.Skip("Skipping Postgres-dependent test. Set DATABASE_URL to run.")
		return nil, func() {}
	}

	tx := db.Begin()
	return tx, func() {
		tx.Rollback()
	}
}

func TestNotificationService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	prefs := &MockUserPrefsReader{
		Types: []string{"device", "firmware"},
		Token: "mock-token",
		Email: "mock-email@luma.local",
	}

	fcm := &MockPushProvider{Name: "fcm", Log: logger}
	apns := &MockPushProvider{Name: "apns", Log: logger}
	email := &MockEmailProvider{Log: logger}

	svc := NewService(repo, prefs, fcm, apns, email, logger)

	req := CreateNotificationRequest{
		UserID: uuid.New().String(),
		Type:   "device",
		Title:  "Device Offline",
		Body:   "Your ESP32 Lamp is offline.",
	}

	dto, err := svc.Create(context.Background(), req)
	if err != nil {
		t.Fatalf("Failed to create notification: %v", err)
	}

	if dto == nil {
		t.Fatal("Expected created notification, got nil")
	}

	if dto.Title != "Device Offline" {
		t.Errorf("Expected title 'Device Offline', got %s", dto.Title)
	}

	// Test Tick
	svc.Tick(context.Background())
}
