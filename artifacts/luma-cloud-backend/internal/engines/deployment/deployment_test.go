package deployment

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type MockFirmwareLookup struct{}

func (m *MockFirmwareLookup) GetDeviceTypeAndVersion(ctx context.Context, firmwareID uuid.UUID) (string, string, error) {
	return "ESP32", "1.2.0", nil
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

func TestRolloutEligibility(t *testing.T) {
	id := uuid.New()
	// Check that eligibility is stable and behaves appropriately
	e1 := rolloutEligible(id, 50)
	e2 := rolloutEligible(id, 50)
	if e1 != e2 {
		t.Errorf("Rollout eligibility should be deterministic")
	}
}

func TestDeploymentService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	// Make sure we have the migration tables for deployments. Since tests run on a real db, we might need them created.
	// We run them via transaction, but let's assume they are already created by migrations.
	repo := NewRepository(db)
	fw := &MockFirmwareLookup{}
	svc := NewService(repo, fw)

	req := CreateDeploymentRequest{
		FirmwareID:        uuid.New().String(),
		Name:              "ESP32 Fall Rollout",
		RolloutPercentage: 100,
	}

	dto, err := svc.Create(context.Background(), req)
	if err != nil {
		t.Fatalf("Failed to create deployment: %v", err)
	}

	if dto.Name != "ESP32 Fall Rollout" {
		t.Errorf("Expected name ESP32 Fall Rollout, got %s", dto.Name)
	}

	depID, _ := uuid.Parse(dto.ID)
	err = svc.Rollback(depID)
	if err != nil {
		t.Fatalf("Failed to rollback: %v", err)
	}

	updated, err := svc.Get(depID)
	if err != nil {
		t.Fatalf("Failed to get updated deployment: %v", err)
	}

	if updated.Status != "rolled_back" {
		t.Errorf("Expected status rolled_back, got %s", updated.Status)
	}
}
