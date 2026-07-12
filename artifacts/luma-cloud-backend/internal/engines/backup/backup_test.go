package backup

import (
	"bytes"
	"context"
	"io"
	"os"
	"testing"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type MockStorage struct {
	files map[string][]byte
}

func (m *MockStorage) Save(ctx context.Context, path string, src io.Reader) (string, error) {
	if m.files == nil {
		m.files = make(map[string][]byte)
	}
	buf, err := io.ReadAll(src)
	if err != nil {
		return "", err
	}
	m.files[path] = buf
	return path, nil
}

func (m *MockStorage) Get(ctx context.Context, path string) (io.ReadCloser, error) {
	data, ok := m.files[path]
	if !ok {
		return nil, os.ErrNotExist
	}
	return io.NopCloser(bytes.NewReader(data)), nil
}

func (m *MockStorage) Delete(ctx context.Context, path string) error {
	delete(m.files, path)
	return nil
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

func TestBackupService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	mockStore := &MockStorage{}
	svc := NewService(repo, mockStore)

	userID := uuid.New()

	dto, err := svc.Create(context.Background(), userID)
	if err != nil {
		t.Fatalf("Failed to create backup: %v", err)
	}

	if dto == nil {
		t.Fatal("Expected created backup, got nil")
	}

	list, _, err := svc.List(userID, 1, 10)
	if err != nil {
		t.Fatalf("Failed to list backups: %v", err)
	}

	if len(list) != 1 {
		t.Errorf("Expected 1 backup, got %d", len(list))
	}

	backupID, _ := uuid.Parse(dto.ID)
	req := RestoreBackupRequest{
		TargetType: "all",
	}

	err = svc.Restore(context.Background(), userID, backupID, req)
	if err != nil {
		t.Fatalf("Failed to restore backup: %v", err)
	}

	err = svc.Delete(context.Background(), userID, backupID)
	if err != nil {
		t.Fatalf("Failed to delete backup: %v", err)
	}
}
