package audit

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

func TestAuditLogService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	svc := NewService(repo)

	userID := uuid.New().String()
	ip := "127.0.0.1"

	req := CreateAuditLogRequest{
		ActorUserID:  &userID,
		Action:       "REGISTER_DEVICE",
		ResourceType: "devices",
		Metadata:     map[string]any{"result": "success"},
		IPAddress:    &ip,
	}

	dto, err := svc.Record(context.Background(), req)
	if err != nil {
		t.Fatalf("Failed to record audit log: %v", err)
	}

	if dto.Action != "REGISTER_DEVICE" {
		t.Errorf("Expected action 'REGISTER_DEVICE', got %s", dto.Action)
	}

	parsedUser, _ := uuid.Parse(userID)
	res := "success"
	filters := QueryFilters{
		UserID: &parsedUser,
		Result: &res,
	}

	list, _, err := svc.List(context.Background(), filters, 1, 10)
	if err != nil {
		t.Fatalf("Failed to list audit logs: %v", err)
	}

	if len(list) != 1 {
		t.Errorf("Expected 1 audit log, got %d", len(list))
	}
}
