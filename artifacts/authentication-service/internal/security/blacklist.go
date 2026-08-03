package security

import (
	"context"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type TokenBlacklist interface {
	Revoke(sessionID string, ttl time.Duration) error
	IsRevoked(sessionID string) bool
}

type RedisBlacklist struct {
	client *redis.Client
	ctx    context.Context
	logger *zap.Logger
}

func NewRedisBlacklist(redisURL string, logger *zap.Logger) TokenBlacklist {
	if redisURL == "" {
		logger.Warn("redis url empty, initializing in-memory token blacklist fallback")
		return NewInMemoryBlacklist(logger)
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		logger.Error("failed to parse redis url, falling back to in-memory blacklist", zap.Error(err))
		return NewInMemoryBlacklist(logger)
	}

	client := redis.NewClient(opts)
	ctx := context.Background()

	if err := client.Ping(ctx).Err(); err != nil {
		logger.Error("failed to ping redis server, falling back to in-memory blacklist", zap.Error(err))
		return NewInMemoryBlacklist(logger)
	}

	logger.Info("redis token blacklist initialized successfully")
	return &RedisBlacklist{
		client: client,
		ctx:    ctx,
		logger: logger,
	}
}

func (b *RedisBlacklist) Revoke(sessionID string, ttl time.Duration) error {
	b.logger.Info("revoking session in redis blacklist", zap.String("sessionId", sessionID), zap.Duration("ttl", ttl))
	return b.client.Set(b.ctx, "blacklist:session:"+sessionID, "revoked", ttl).Err()
}

func (b *RedisBlacklist) IsRevoked(sessionID string) bool {
	exists, err := b.client.Exists(b.ctx, "blacklist:session:"+sessionID).Result()
	if err != nil {
		b.logger.Error("failed to check redis blacklist status, assuming not revoked", zap.Error(err))
		return false
	}
	return exists > 0
}

type InMemoryBlacklist struct {
	mu     sync.RWMutex
	items  map[string]time.Time
	logger *zap.Logger
}

func NewInMemoryBlacklist(logger *zap.Logger) *InMemoryBlacklist {
	b := &InMemoryBlacklist{
		items:  make(map[string]time.Time),
		logger: logger,
	}
	// background janitor to cleanup expired revoked items
	go b.startJanitor(time.Minute * 10)
	return b
}

func (b *InMemoryBlacklist) Revoke(sessionID string, ttl time.Duration) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.items[sessionID] = time.Now().Add(ttl)
	b.logger.Info("revoked session in in-memory blacklist", zap.String("sessionId", sessionID), zap.Duration("ttl", ttl))
	return nil
}

func (b *InMemoryBlacklist) IsRevoked(sessionID string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	expireAt, ok := b.items[sessionID]
	if !ok {
		return false
	}
	if time.Now().After(expireAt) {
		return false
	}
	return true
}

func (b *InMemoryBlacklist) startJanitor(interval time.Duration) {
	ticker := time.NewTicker(interval)
	for range ticker.C {
		b.mu.Lock()
		now := time.Now()
		for id, expireAt := range b.items {
			if now.After(expireAt) {
				delete(b.items, id)
			}
		}
		b.mu.Unlock()
	}
}
