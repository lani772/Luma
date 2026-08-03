package audit

import (
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AuditLogger struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewAuditLogger(db *gorm.DB, logger *zap.Logger) *AuditLogger {
	return &AuditLogger{db: db, logger: logger}
}

func (al *AuditLogger) Log(userID *uuid.UUID, eventType, description, ipAddress, userAgent string) {
	al.logger.Info("audit log created",
		zap.Any("userId", userID),
		zap.String("type", eventType),
		zap.String("description", description),
		zap.String("ip", ipAddress),
		zap.String("ua", userAgent),
	)

	log := database.AuditLog{
		ID:          uuid.New(),
		UserID:      userID,
		EventType:   eventType,
		Description: description,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
		CreatedAt:   time.Now(),
	}

	if err := al.db.Create(&log).Error; err != nil {
		al.logger.Error("failed to write audit log to database", zap.Error(err))
	}
}
