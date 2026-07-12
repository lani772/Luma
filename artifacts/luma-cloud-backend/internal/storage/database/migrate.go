package database

import (
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// Migrate applies every pending migration in migrationsDir. It is called
// once at startup (see cmd/api/main.go) so `go run ./cmd/api` is always
// enough to get a fresh Postgres instance to the current schema — no
// separate manual migrate step required in development.
func Migrate(databaseURL, migrationsDir string) error {
	m, err := migrate.New("file://"+migrationsDir, databaseURL)
	if err != nil {
		return fmt.Errorf("migrate: init: %w", err)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: up: %w", err)
	}

	srcErr, dbErr := m.Close()
	if srcErr != nil {
		return fmt.Errorf("migrate: close source: %w", srcErr)
	}
	if dbErr != nil {
		return fmt.Errorf("migrate: close db: %w", dbErr)
	}
	return nil
}
