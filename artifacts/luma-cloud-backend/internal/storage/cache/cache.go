// Package cache defines the caching/rate-limit-counter abstraction used by
// the API gateway and engines. There are two implementations: a Redis-backed
// one for production and a process-local in-memory one used when REDIS_URL
// is not configured. Swapping between them is a config-only decision made
// once at startup in cmd/api/main.go — nothing above this package knows
// which one is active.
package cache

import (
	"context"
	"time"
)

type Cache interface {
	// Get returns the stored value and true, or ("", false) on miss.
	Get(ctx context.Context, key string) (string, bool, error)
	// Set stores value under key with an optional TTL (0 = no expiry).
	Set(ctx context.Context, key, value string, ttl time.Duration) error
	// Delete removes a key. Missing keys are not an error.
	Delete(ctx context.Context, key string) error
	// Incr atomically increments key by 1, creating it with the given TTL on
	// first use, and returns the post-increment value. Used for rate
	// limiting and lightweight counters.
	Incr(ctx context.Context, key string, ttl time.Duration) (int64, error)
	// Backend reports which implementation is active, surfaced on
	// /api/engines/mqtt/health-style status endpoints for operator visibility.
	Backend() string
	Close() error
}
