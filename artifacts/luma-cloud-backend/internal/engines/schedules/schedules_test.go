package schedules

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

func TestScheduleService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	svc := NewService(repo)

	userID := uuid.New()
	deviceID := uuid.New().String()

	req := CreateScheduleRequest{
		DeviceID:   deviceID,
		Name:       "Morning Alarm",
		TimeConfig: map[string]any{"cron": "0 7 * * *"},
		Action:     map[string]any{"command": "TURN_ON"},
	}

	dto, err := svc.Create(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("Failed to create schedule: %v", err)
	}

	if dto.Name != "Morning Alarm" {
		t.Errorf("Expected name 'Morning Alarm', got %s", dto.Name)
	}

	schID, _ := uuid.Parse(dto.ID)

	newName := "Weekend Alarm"
	updateReq := UpdateScheduleRequest{
		Name: &newName,
	}

	updatedDto, err := svc.Update(context.Background(), schID, userID, updateReq)
	if err != nil {
		t.Fatalf("Failed to update schedule: %v", err)
	}

	if updatedDto.Name != "Weekend Alarm" {
		t.Errorf("Expected name 'Weekend Alarm', got %s", updatedDto.Name)
	}

	if updatedDto.Version != 2 {
		t.Errorf("Expected version 2, got %d", updatedDto.Version)
	}

	err = svc.Delete(context.Background(), schID, userID)
	if err != nil {
		t.Fatalf("Failed to delete schedule: %v", err)
	}
}
