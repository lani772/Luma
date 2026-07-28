package analytics

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

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

func TestAnalyticsService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	svc := NewService(repo)

	userID := uuid.New()
	devID := uuid.New().String()

	req := IngestEventRequest{
		DeviceID:  &devID,
		EventType: "login_activity",
		Payload:   map[string]any{"ip": "127.0.0.1"},
	}

	ev, err := svc.Ingest(context.Background(), &userID, req)
	if err != nil {
		t.Fatalf("Failed to ingest event: %v", err)
	}

	if ev.EventType != "login_activity" {
		t.Errorf("Expected event_type 'login_activity', got %s", ev.EventType)
	}

	svc.Tick(context.Background())

	parsedDevID, _ := uuid.Parse(devID)
	dash, err := svc.QueryDashboard(context.Background(), parsedDevID, "weekly")
	if err != nil {
		t.Fatalf("Failed to query dashboard: %v", err)
	}

	if dash == nil {
		t.Fatal("Expected dashboard response, got nil")
	}
}
