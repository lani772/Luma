package unit

import (
	"mqtt-service/internal/models"
	"mqtt-service/internal/repository"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect sqlite: %v", err)
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.Device{},
		&models.DeviceOwnership{},
		&models.Command{},
		&models.Telemetry{},
		&models.MQTTSubscription{},
		&models.AuditLog{},
		&models.MessageHistory{},
	)
	if err != nil {
		t.Fatalf("failed to auto migrate: %v", err)
	}

	return db
}

func TestGORMUserRepository(t *testing.T) {
	db := setupTestDB(t)
	repo := repository.NewUserRepository(db)

	u := &models.User{
		ID:           uuid.New(),
		Username:     "testuser",
		Email:        "test@example.com",
		PasswordHash: "hashed_password",
		Role:         "user",
	}

	err := repo.Create(u)
	if err != nil {
		t.Errorf("failed to create user: %v", err)
	}

	// Find by Username
	found, err := repo.FindByUsername("testuser")
	if err != nil || found == nil {
		t.Errorf("failed to find by username: %v", err)
	}
	if found.Email != "test@example.com" {
		t.Errorf("expected test@example.com, got %s", found.Email)
	}

	// Find by Email
	found, err = repo.FindByEmail("test@example.com")
	if err != nil || found == nil {
		t.Errorf("failed to find by email: %v", err)
	}

	// Find by ID
	found, err = repo.FindByID(u.ID)
	if err != nil || found == nil {
		t.Errorf("failed to find by ID: %v", err)
	}
}

func TestGORMDeviceRepository(t *testing.T) {
	db := setupTestDB(t)
	repo := repository.NewDeviceRepository(db)

	dev := &models.Device{
		ID:     uuid.New(),
		Name:   "Living Room Light",
		Status: "offline",
	}

	err := repo.Create(dev)
	if err != nil {
		t.Errorf("failed to create device: %v", err)
	}

	// FindByID
	found, err := repo.FindByID(dev.ID)
	if err != nil || found == nil {
		t.Errorf("failed to find device: %v", err)
	}

	// UpdateStatus
	err = repo.UpdateStatus(dev.ID, "online")
	if err != nil {
		t.Errorf("failed to update status: %v", err)
	}

	found, _ = repo.FindByID(dev.ID)
	if found.Status != "online" {
		t.Errorf("expected status 'online', got '%s'", found.Status)
	}

	// CreateOwnership & CheckOwnership
	userID := uuid.New()
	ownership := &models.DeviceOwnership{
		UserID:   userID,
		DeviceID: dev.ID,
		Role:     "owner",
	}
	err = repo.CreateOwnership(ownership)
	if err != nil {
		t.Errorf("failed to create ownership: %v", err)
	}

	hasAccess, err := repo.CheckOwnership(userID, dev.ID)
	if err != nil || !hasAccess {
		t.Errorf("expected ownership check to be true: %v", err)
	}

	hasAccess, err = repo.CheckOwnership(uuid.New(), dev.ID)
	if err != nil || hasAccess {
		t.Errorf("expected non-owner check to be false")
	}
}

func TestGORMCommandRepository(t *testing.T) {
	db := setupTestDB(t)
	repo := repository.NewCommandRepository(db)

	devID := uuid.New()
	cmd := &models.Command{
		ID:       uuid.New(),
		DeviceID: devID,
		Payload:  "{\"power\": \"on\"}",
		QoS:      1,
		Status:   "pending",
	}

	err := repo.Create(cmd)
	if err != nil {
		t.Errorf("failed to create command: %v", err)
	}

	// FindByID
	found, err := repo.FindByID(cmd.ID)
	if err != nil || found == nil {
		t.Errorf("failed to find command: %v", err)
	}

	// UpdateStatus
	err = repo.UpdateStatus(cmd.ID, "sent")
	if err != nil {
		t.Errorf("failed to update status: %v", err)
	}

	found, _ = repo.FindByID(cmd.ID)
	if found.Status != "sent" {
		t.Errorf("expected 'sent', got '%s'", found.Status)
	}

	// MarkAcked
	err = repo.MarkAcked(cmd.ID)
	if err != nil {
		t.Errorf("failed to mark acked: %v", err)
	}

	found, _ = repo.FindByID(cmd.ID)
	if found.Status != "acknowledged" || found.AckedAt == nil {
		t.Errorf("expected 'acknowledged' status and non-nil acked_at")
	}

	// ListByDevice
	cmds, err := repo.ListByDevice(devID)
	if err != nil || len(cmds) != 1 {
		t.Errorf("expected 1 command, got %d: %v", len(cmds), err)
	}
}

func TestGORMTelemetryRepository(t *testing.T) {
	db := setupTestDB(t)
	repo := repository.NewTelemetryRepository(db)

	devID := uuid.New()
	t1 := &models.Telemetry{
		DeviceID:  devID,
		Topic:     "luma/device/123/telemetry",
		Payload:   "{\"temp\": 22.5}",
		CreatedAt: time.Now(),
	}

	err := repo.Create(t1)
	if err != nil {
		t.Errorf("failed to create telemetry: %v", err)
	}

	list, err := repo.ListByDevice(devID, 10)
	if err != nil || len(list) != 1 {
		t.Errorf("expected 1 telemetry item, got %d", len(list))
	}
}
