// Package worker runs small periodic background jobs that don't warrant a
// separate process. Phase 1 only needs expired-token cleanup; Phase 2
// engines (Analytics rollups, Backup scheduling, Notification retries,
// Schedule execution) will register additional jobs here.
package worker

import (
	"context"
	"log/slog"
	"time"

	"gorm.io/gorm"
)

type Worker struct {
	db  *gorm.DB
	log *slog.Logger
}

func New(db *gorm.DB, log *slog.Logger) *Worker {
	return &Worker{db: db, log: log}
}

// Run blocks until ctx is cancelled, ticking each registered job on its own
// interval. Call it in a goroutine from main.go.
func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	w.cleanupExpiredTokens() // run once at startup too
	for {
		select {
		case <-ctx.Done():
			w.log.Info("worker_stopped")
			return
		case <-ticker.C:
			w.cleanupExpiredTokens()
		}
	}
}

// cleanupExpiredTokens deletes long-expired sessions/reset/verification
// tokens so those tables don't grow unbounded. Rows are kept for a 7-day
// grace period past expiry in case they're ever needed for support/audit
// investigation.
func (w *Worker) cleanupExpiredTokens() {
	cutoff := time.Now().Add(-7 * 24 * time.Hour)

	tables := []string{"sessions", "password_reset_tokens", "email_verification_tokens"}
	for _, table := range tables {
		res := w.db.Exec("DELETE FROM "+table+" WHERE expires_at < ?", cutoff)
		if res.Error != nil {
			w.log.Error("token_cleanup_failed", "table", table, "error", res.Error)
			continue
		}
		if res.RowsAffected > 0 {
			w.log.Info("token_cleanup", "table", table, "rowsDeleted", res.RowsAffected)
		}
	}
}
