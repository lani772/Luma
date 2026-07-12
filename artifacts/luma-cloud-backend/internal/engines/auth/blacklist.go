package auth

import (
	"context"
	"time"

	"github.com/luma-smart-home/cloud-backend/internal/storage/cache"
)

// Blacklist implements middleware.TokenBlacklist on top of the shared Cache.
// Revoking a session writes a short-lived marker so already-issued access
// tokens for that session stop working immediately instead of at their own
// (short) natural expiry.
type Blacklist struct {
	cache cache.Cache
}

func NewBlacklist(c cache.Cache) *Blacklist {
	return &Blacklist{cache: c}
}

func (b *Blacklist) Revoke(sessionID string, ttl time.Duration) {
	// Best-effort: a cache failure here should not block logout itself, and
	// the session row is already revoked in Postgres as the source of truth.
	_ = b.cache.Set(context.Background(), blacklistKey(sessionID), "1", ttl)
}

func (b *Blacklist) IsRevoked(sessionID string) bool {
	_, found, err := b.cache.Get(context.Background(), blacklistKey(sessionID))
	if err != nil {
		return false
	}
	return found
}

func blacklistKey(sessionID string) string {
	return "auth:revoked-session:" + sessionID
}
