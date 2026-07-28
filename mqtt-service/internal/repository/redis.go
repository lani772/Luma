package repository

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient interface {
	SetDevicePresence(deviceID string, online bool, ttl time.Duration) error
	GetDevicePresence(deviceID string) (bool, error)
	GetOnlineDevices() ([]string, error)
	EnqueueOfflineMessage(deviceID string, payload string) error
	DequeueOfflineMessages(deviceID string) ([]string, error)
	EnqueueRetryMessage(msgID string, topic string, payload string, qos byte, attempts int, nextRun time.Time) error
	GetRetryMessages() ([]RetryMessage, error)
	RemoveRetryMessage(msgID string) error
	RateLimitAllow(key string, limit int, window time.Duration) (bool, error)
	AcquireLock(key string, value string, ttl time.Duration) (bool, error)
	ReleaseLock(key string, value string) error
}

type RetryMessage struct {
	ID        string    `json:"id"`
	Topic     string    `json:"topic"`
	Payload   string    `json:"payload"`
	QoS       byte      `json:"qos"`
	Attempts  int       `json:"attempts"`
	NextRunAt time.Time `json:"nextRunAt"`
}

// RealRedisClient implements RedisClient using github.com/redis/go-redis/v9
type RealRedisClient struct {
	rdb *redis.Client
	ctx context.Context
}

func NewRealRedisClient(host string, port int, password string, db int, log *slog.Logger) (*RealRedisClient, error) {
	addr := fmt.Sprintf("%s:%d", host, port)
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	log.Info("connected_to_redis", "addr", addr)
	return &RealRedisClient{rdb: rdb, ctx: context.Background()}, nil
}

func (c *RealRedisClient) SetDevicePresence(deviceID string, online bool, ttl time.Duration) error {
	key := "presence:" + deviceID
	if online {
		return c.rdb.Set(c.ctx, key, "online", ttl).Err()
	}
	return c.rdb.Del(c.ctx, key).Err()
}

func (c *RealRedisClient) GetDevicePresence(deviceID string) (bool, error) {
	key := "presence:" + deviceID
	val, err := c.rdb.Get(c.ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	}
	return val == "online", err
}

func (c *RealRedisClient) GetOnlineDevices() ([]string, error) {
	keys, err := c.rdb.Keys(c.ctx, "presence:*").Result()
	if err != nil {
		return nil, err
	}
	devices := make([]string, len(keys))
	for i, k := range keys {
		devices[i] = k[9:] // strip "presence:"
	}
	return devices, nil
}

func (c *RealRedisClient) EnqueueOfflineMessage(deviceID string, payload string) error {
	key := "offline_queue:" + deviceID
	return c.rdb.RPush(c.ctx, key, payload).Err()
}

func (c *RealRedisClient) DequeueOfflineMessages(deviceID string) ([]string, error) {
	key := "offline_queue:" + deviceID
	msgs, err := c.rdb.LRange(c.ctx, key, 0, -1).Result()
	if err != nil {
		return nil, err
	}
	_ = c.rdb.Del(c.ctx, key) // clear the queue
	return msgs, nil
}

func (c *RealRedisClient) EnqueueRetryMessage(msgID string, topic string, payload string, qos byte, attempts int, nextRun time.Time) error {
	key := "retry_queue:" + msgID
	fields := map[string]interface{}{
		"topic":       topic,
		"payload":     payload,
		"qos":         qos,
		"attempts":    attempts,
		"next_run_at": nextRun.Format(time.RFC3339),
	}
	return c.rdb.HSet(c.ctx, key, fields).Err()
}

func (c *RealRedisClient) GetRetryMessages() ([]RetryMessage, error) {
	keys, err := c.rdb.Keys(c.ctx, "retry_queue:*").Result()
	if err != nil {
		return nil, err
	}

	var retryMsgs []RetryMessage
	for _, key := range keys {
		vals, err := c.rdb.HGetAll(c.ctx, key).Result()
		if err != nil {
			continue
		}
		qosVal, _ := strconvParseUint(vals["qos"])
		attemptsVal, _ := strconvParseInt(vals["attempts"])
		nextRunVal, _ := time.Parse(time.RFC3339, vals["next_run_at"])
		msgID := key[12:] // strip "retry_queue:"

		retryMsgs = append(retryMsgs, RetryMessage{
			ID:        msgID,
			Topic:     vals["topic"],
			Payload:   vals["payload"],
			QoS:       byte(qosVal),
			Attempts:  attemptsVal,
			NextRunAt: nextRunVal,
		})
	}
	return retryMsgs, nil
}

func (c *RealRedisClient) RemoveRetryMessage(msgID string) error {
	key := "retry_queue:" + msgID
	return c.rdb.Del(c.ctx, key).Err()
}

func (c *RealRedisClient) RateLimitAllow(key string, limit int, window time.Duration) (bool, error) {
	rkey := "ratelimit:" + key
	count, err := c.rdb.Incr(c.ctx, rkey).Result()
	if err != nil {
		return false, err
	}
	if count == 1 {
		c.rdb.Expire(c.ctx, rkey, window)
	}
	return count <= int64(limit), nil
}

func (c *RealRedisClient) AcquireLock(key string, value string, ttl time.Duration) (bool, error) {
	rkey := "lock:" + key
	return c.rdb.SetNX(c.ctx, rkey, value, ttl).Result()
}

func (c *RealRedisClient) ReleaseLock(key string, value string) error {
	rkey := "lock:" + key
	// Simple release: delete key if its value matches
	val, err := c.rdb.Get(c.ctx, rkey).Result()
	if err == redis.Nil {
		return nil
	} else if err != nil {
		return err
	}
	if val == value {
		return c.rdb.Del(c.ctx, rkey).Err()
	}
	return nil
}

// Helper parsing utils
func strconvParseUint(s string) (uint64, error) {
	if s == "" {
		return 0, nil
	}
	var res uint64
	_, err := fmt.Sscanf(s, "%d", &res)
	return res, err
}

func strconvParseInt(s string) (int, error) {
	if s == "" {
		return 0, nil
	}
	var res int
	_, err := fmt.Sscanf(s, "%d", &res)
	return res, err
}

// InMemoryRedisClient is a fully-featured mock implementation of RedisClient
// for local execution/testing when Redis is not available.
type InMemoryRedisClient struct {
	mu         sync.RWMutex
	presence   map[string]bool
	offlineQ   map[string][]string
	retryQ     map[string]RetryMessage
	rateLimits map[string]int
	locks      map[string]string
}

func NewInMemoryRedisClient() *InMemoryRedisClient {
	return &InMemoryRedisClient{
		presence:   make(map[string]bool),
		offlineQ:   make(map[string][]string),
		retryQ:     make(map[string]RetryMessage),
		rateLimits: make(map[string]int),
		locks:      make(map[string]string),
	}
}

func (c *InMemoryRedisClient) SetDevicePresence(deviceID string, online bool, ttl time.Duration) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if online {
		c.presence[deviceID] = true
	} else {
		delete(c.presence, deviceID)
	}
	return nil
}

func (c *InMemoryRedisClient) GetDevicePresence(deviceID string) (bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.presence[deviceID], nil
}

func (c *InMemoryRedisClient) GetOnlineDevices() ([]string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var list []string
	for k := range c.presence {
		list = append(list, k)
	}
	return list, nil
}

func (c *InMemoryRedisClient) EnqueueOfflineMessage(deviceID string, payload string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.offlineQ[deviceID] = append(c.offlineQ[deviceID], payload)
	return nil
}

func (c *InMemoryRedisClient) DequeueOfflineMessages(deviceID string) ([]string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	msgs := c.offlineQ[deviceID]
	delete(c.offlineQ, deviceID)
	return msgs, nil
}

func (c *InMemoryRedisClient) EnqueueRetryMessage(msgID string, topic string, payload string, qos byte, attempts int, nextRun time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.retryQ[msgID] = RetryMessage{
		ID:        msgID,
		Topic:     topic,
		Payload:   payload,
		QoS:       qos,
		Attempts:  attempts,
		NextRunAt: nextRun,
	}
	return nil
}

func (c *InMemoryRedisClient) GetRetryMessages() ([]RetryMessage, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var list []RetryMessage
	for _, v := range c.retryQ {
		list = append(list, v)
	}
	return list, nil
}

func (c *InMemoryRedisClient) RemoveRetryMessage(msgID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.retryQ, msgID)
	return nil
}

func (c *InMemoryRedisClient) RateLimitAllow(key string, limit int, window time.Duration) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.rateLimits[key]++
	if c.rateLimits[key] > limit {
		return false, nil
	}
	// Simple reset
	go func() {
		time.Sleep(window)
		c.mu.Lock()
		delete(c.rateLimits, key)
		c.mu.Unlock()
	}()
	return true, nil
}

func (c *InMemoryRedisClient) AcquireLock(key string, value string, ttl time.Duration) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.locks[key]; ok {
		return false, nil
	}
	c.locks[key] = value
	go func() {
		time.Sleep(ttl)
		c.mu.Lock()
		if c.locks[key] == value {
			delete(c.locks, key)
		}
		c.mu.Unlock()
	}()
	return true, nil
}

func (c *InMemoryRedisClient) ReleaseLock(key string, value string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if val, ok := c.locks[key]; ok && val == value {
		delete(c.locks, key)
	}
	return nil
}
