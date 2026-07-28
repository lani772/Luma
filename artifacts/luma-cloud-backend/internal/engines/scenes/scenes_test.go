package scenes

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

func TestSceneService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	svc := NewService(repo)

	userID := uuid.New()

	req := CreateSceneRequest{
		Name:    "Bedtime",
		Actions: []any{map[string]any{"device_id": "lamp1", "state": "off"}},
	}

	dto, err := svc.Create(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("Failed to create scene: %v", err)
	}

	if dto.Name != "Bedtime" {
		t.Errorf("Expected name 'Bedtime', got %s", dto.Name)
	}

	sceneID, _ := uuid.Parse(dto.ID)

	newName := "Deep Sleep Bedtime"
	updateReq := UpdateSceneRequest{
		Name: &newName,
	}

	updatedDto, err := svc.Update(context.Background(), sceneID, userID, updateReq)
	if err != nil {
		t.Fatalf("Failed to update scene: %v", err)
	}

	if updatedDto.Name != "Deep Sleep Bedtime" {
		t.Errorf("Expected name 'Deep Sleep Bedtime', got %s", updatedDto.Name)
	}

	if updatedDto.Version != 2 {
		t.Errorf("Expected version 2, got %d", updatedDto.Version)
	}

	err = svc.Delete(context.Background(), sceneID, userID)
	if err != nil {
		t.Fatalf("Failed to delete scene: %v", err)
	}
}
