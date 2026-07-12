#!/usr/bin/env bash
# Convenience script to run migrations without starting the server — mainly
# useful for the portable Docker Compose stack. On Replit, `go run ./cmd/api`
# (the dev workflow) and the production binary both call database.Migrate()
# automatically at startup, so this script is optional there.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

go run ./cmd/migrate 2>/dev/null || {
  echo "Running migrations via a throwaway Go program (no standalone cmd/migrate binary defined)."
  cat <<'EOF' > /tmp/luma_migrate_main.go
package main

import (
	"fmt"
	"os"

	"github.com/luma-smart-home/cloud-backend/internal/storage/database"
)

func main() {
	if err := database.Migrate(os.Getenv("DATABASE_URL"), "migrations"); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("migrations applied")
}
EOF
  go run /tmp/luma_migrate_main.go
}
