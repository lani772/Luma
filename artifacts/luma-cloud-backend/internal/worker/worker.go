// Package worker runs small periodic background jobs that don't warrant a
// separate process. Phase 1 only needs expired-token cleanup; Phase 2
// engines (Analytics rollups, Backup scheduling, Notification retries,
// Schedule execution) will register additional jobs here.
package worker

import (
	"context"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Job interface {
	Tick(ctx context.Context)
}

type Worker struct {
	db   *mongo.Database
	log  *slog.Logger
	jobs []Job
}

func New(db *mongo.Database, log *slog.Logger, jobs ...Job) *Worker {
	return &Worker{db: db, log: log, jobs: jobs}
}

// Run blocks until ctx is cancelled, ticking each registered job on its own
// interval. Call it in a goroutine from main.go.
func (w *Worker) Run(ctx context.Context) {
	tokenTicker := time.NewTicker(1 * time.Hour)
	defer tokenTicker.Stop()

	jobTicker := time.NewTicker(10 * time.Second) // quick check for campaign status and retries
	defer jobTicker.Stop()

	w.cleanupExpiredTokens() // run once at startup too
	for {
		select {
		case <-ctx.Done():
			w.log.Info("worker_stopped")
			return
		case <-tokenTicker.C:
			w.cleanupExpiredTokens()
		case <-jobTicker.C:
			for _, job := range w.jobs {
				job.Tick(ctx)
			}
		}
	}
}

// cleanupExpiredTokens deletes long-expired sessions/reset/verification
// tokens so those collections don't grow unbounded. Rows are kept for a
// 7-day grace period past expiry in case they're ever needed for audit.
func (w *Worker) cleanupExpiredTokens() {
	ctx := context.Background()
	cutoff := time.Now().Add(-7 * 24 * time.Hour)
	filter := bson.M{"expires_at": bson.M{"$lt": cutoff}}

	collections := []string{"sessions", "password_reset_tokens", "email_verification_tokens"}
	for _, name := range collections {
		res, err := w.db.Collection(name).DeleteMany(ctx, filter)
		if err != nil {
			w.log.Error("token_cleanup_failed", "collection", name, "error", err)
			continue
		}
		if res.DeletedCount > 0 {
			w.log.Info("token_cleanup", "collection", name, "deleted", res.DeletedCount)
		}
	}
}
