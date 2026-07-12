package firmware

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
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

func TestFirmwareService(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	mockStore := &MockStorage{}
	svc := NewService(repo, mockStore, 1024*1024)

	userID := uuid.New()
	req := UploadFirmwareRequest{
		DeviceType: "ESP32",
		Version:    "1.0.0",
		Channel:    "stable",
	}

	content := []byte("fake binary data")
	dto, err := svc.Upload(context.Background(), userID, "firmware.bin", req, bytes.NewReader(content))
	if err != nil {
		t.Fatalf("Failed to upload firmware: %v", err)
	}

	if dto.Version != "1.0.0" {
		t.Errorf("Expected version 1.0.0, got %s", dto.Version)
	}

	// Compare latest
	comp, err := svc.Compare("ESP32", "0.9.0", "stable")
	if err != nil {
		t.Fatalf("Failed to compare firmware: %v", err)
	}
	if !comp.NeedsUpdate {
		t.Errorf("Expected needs update to be true")
	}
}

func TestFirmwareHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, cleanup := setupTestDB(t)
	defer cleanup()

	if db == nil {
		return
	}

	repo := NewRepository(db)
	mockStore := &MockStorage{}
	svc := NewService(repo, mockStore, 1024*1024)
	handler := NewHandler(svc)

	r := gin.New()
	group := r.Group("/cloud/firmware")

	authMiddleware := func(c *gin.Context) {
		c.Set("userId", uuid.New().String())
		c.Next()
	}

	handler.RegisterRoutes(group, r.Group("/cloud/api/engines/firmware"), authMiddleware)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", "firmware.bin")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte("fake firmware bytes"))

	_ = writer.WriteField("deviceType", "ESP32")
	_ = writer.WriteField("version", "1.1.0")
	_ = writer.WriteField("channel", "stable")
	_ = writer.Close()

	req, _ := http.NewRequest("POST", "/cloud/firmware/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d. Body: %s", w.Code, w.Body.String())
	}
}
