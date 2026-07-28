package repository

import (
	"fmt"
	"log/slog"
	"mqtt-service/internal/config"
	"mqtt-service/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func ConnectPostgres(cfg config.DatabaseConfig, log *slog.Logger) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name, cfg.SSLMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Info("connected_to_postgres", "host", cfg.Host, "db", cfg.Name)
	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Device{},
		&models.DeviceOwnership{},
		&models.Command{},
		&models.Telemetry{},
		&models.MQTTSubscription{},
		&models.AuditLog{},
		&models.MessageHistory{},
	)
}
