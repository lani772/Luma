package sync

import (
	"context"
	"os"
	"testing"
	"time"

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
		t.Skip("Skipping Postgres-dependent test. Set DATABASE_URL to run.")
		return nil, func() {}
	}

	tx := db.Begin()
	return tx, func() {
		tx.Rollback()
	}
}

func TestSyncPushAndPull(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	svc := NewService(repo)

	userID := uuid.New()
	phoneID := uuid.New().String()

	// Push initial scene record
	pushReq := PushSyncRequest{
		PhoneID: phoneID,
		Resources: []SyncResourceDTO{
			{
				ResourceID:   "scene_1",
				ResourceType: "scenes",
				Data:         map[string]any{"name": "Night Mode"},
				Version:      1,
				UpdatedAt:    time.Now().Add(-10 * time.Minute),
				Deleted:      false,
			},
		},
	}

	pushResp, err := svc.Push(context.Background(), userID, pushReq)
	if err != nil {
		t.Fatalf("Failed to push sync: %v", err)
	}

	if !pushResp.Success {
		t.Errorf("Expected push to succeed")
	}

	if len(pushResp.Conflicts) > 0 {
		t.Errorf("Expected zero conflicts, got %d", len(pushResp.Conflicts))
	}

	// Pull records
	pullReq := PullSyncRequest{
		PhoneID:      phoneID,
		ResourceType: "scenes",
		LastVersion:  0,
	}

	pullResp, err := svc.Pull(context.Background(), userID, pullReq)
	if err != nil {
		t.Fatalf("Failed to pull sync: %v", err)
	}

	if len(pullResp.Resources) != 1 {
		t.Errorf("Expected 1 pulled resource, got %d", len(pullResp.Resources))
	}

	if pullResp.Resources[0].ResourceID != "scene_1" {
		t.Errorf("Expected resource_1, got %s", pullResp.Resources[0].ResourceID)
	}
}
