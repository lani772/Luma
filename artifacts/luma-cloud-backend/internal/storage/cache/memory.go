package cache

import (
	"context"
	"sync"
	"time"
)

// MemoryCache is a process-local fallback used only when REDIS_URL is not
// configured. It is NOT shared across replicas/instances — callers must
// treat it as best-effort. Startup code logs a visible warning whenever this
// implementation is selected (see cmd/api/main.go), matching the LUMA
// project-wide convention of never silently degrading a subsystem.
type MemoryCache struct {
	mu    sync.Mutex
	items map[string]memoryItem
}

type memoryItem struct {
	value     string
	expiresAt time.Time // zero = no expiry
}

func NewMemoryCache() *MemoryCache {
	c := &MemoryCache{items: make(map[string]memoryItem)}
	go c.reap()
	return c
}

func (c *MemoryCache) reap() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		c.mu.Lock()
		for k, v := range c.items {
			if !v.expiresAt.IsZero() && now.After(v.expiresAt) {
				delete(c.items, k)
			}
		}
		c.mu.Unlock()
	}
}

func (c *MemoryCache) Get(_ context.Context, key string) (string, bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item, ok := c.items[key]
	if !ok {
		return "", false, nil
	}
	if !item.expiresAt.IsZero() && time.Now().After(item.expiresAt) {
		delete(c.items, key)
		return "", false, nil
	}
	return item.value, true, nil
}

func (c *MemoryCache) Set(_ context.Context, key, value string, ttl time.Duration) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	var expiresAt time.Time
	if ttl > 0 {
		expiresAt = time.Now().Add(ttl)
	}
	c.items[key] = memoryItem{value: value, expiresAt: expiresAt}
	return nil
}

func (c *MemoryCache) Delete(_ context.Context, key string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
	return nil
}

func (c *MemoryCache) Incr(_ context.Context, key string, ttl time.Duration) (int64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item, ok := c.items[key]
	if !ok || (!item.expiresAt.IsZero() && time.Now().After(item.expiresAt)) {
		item = memoryItem{value: "0"}
		if ttl > 0 {
			item.expiresAt = time.Now().Add(ttl)
		}
	}
	n := parseInt(item.value) + 1
	item.value = itoa(n)
	c.items[key] = item
	return n, nil
}

func (c *MemoryCache) Backend() string { return "memory (fallback — set REDIS_URL for shared/production caching)" }

func (c *MemoryCache) Close() error { return nil }

func parseInt(s string) int64 {
	var n int64
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0
		}
		n = n*10 + int64(r-'0')
	}
	return n
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
