// Package database wires the Postgres connection used by every engine's
// repository layer. Schema is owned by migrations/*.sql (see Migrate below),
// never by GORM AutoMigrate.
package database

import (
	"database/sql"
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// Connect opens a GORM/Postgres connection pool. isProd trims log verbosity
// and query-log noise in production.
func Connect(databaseURL string, isProd bool) (*gorm.DB, error) {
	logLevel := gormlogger.Warn
	if !isProd {
		logLevel = gormlogger.Error // migrations/tests print enough SQL already; avoid double noise
	}

	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger:                                   gormlogger.Default.LogMode(logLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, fmt.Errorf("database: connect: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("database: get sql.DB: %w", err)
	}
	configurePool(sqlDB)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("database: ping: %w", err)
	}

	return db, nil
}

func configurePool(sqlDB *sql.DB) {
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
}
