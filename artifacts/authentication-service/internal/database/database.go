package database

import (
	"time"

	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func Connect(dbURL string, zapLogger *zap.Logger) (*gorm.DB, error) {
	zapLogger.Info("connecting to postgresql", zap.String("url", dbURL))

	// Configure GORM logger to pipe to Zap
	gLogger := gormlogger.New(
		zap.NewStdLog(zapLogger),
		gormlogger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  gormlogger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{
		Logger: gLogger,
	})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Set connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{},
		&Credential{},
		&Session{},
		&RefreshToken{},
		&EmailVerification{},
		&PasswordResetToken{},
		&OAuthAccount{},
		&ServiceAccount{},
		&AuditLog{},
		&LoginAttempt{},
	)
}
