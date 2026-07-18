// Package config loads and validates all runtime configuration for the LUMA
// cloud backend from environment variables. Nothing in this package talks to
// a specific MQTT broker, cloud provider, or push provider — those are all
// injected as plain strings/URLs so the broker/provider can be swapped later
// without touching business logic (see pkg/mqttadapter).
package config

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config is the fully resolved application configuration. It is built once
// at startup by Load() and passed by value/pointer through the DI graph in
// cmd/api/main.go — nothing reads os.Getenv() outside this package.
type Config struct {
	Env  string // "development" | "production"
	Port string

	// MongoURI is the MongoDB Atlas connection string (mongodb+srv://...).
	// Set via the MONGODB_URI secret in Replit.
	MongoURI string

	// RedisURL is optional. When empty, the cache layer falls back to an
	// in-memory implementation and logs a visible warning — the fallback is
	// never silent, matching the rest of the LUMA codebase's convention for
	// simulated/degraded subsystems.
	RedisURL string

	JWT JWTConfig

	MQTT MQTTConfig

	CORSOrigins []string

	RateLimit RateLimitConfig
}

type JWTConfig struct {
	AccessSecret  string
	RefreshSecret string
	AccessTTL     time.Duration
	RefreshTTL    time.Duration
	Issuer        string
}

// MQTTConfig configures the adapter's connection to whatever broker is
// currently deployed. Swapping mqtt.luma.local for a managed broker (EMQX,
// HiveMQ, AWS IoT, ...) later is a config-only change — see
// pkg/mqttadapter.Adapter.
type MQTTConfig struct {
	BrokerURL      string // e.g. tcp://mqtt.luma.local:1883
	ClientIDPrefix string
	Username       string
	Password       string
	TLSEnabled     bool
}

type RateLimitConfig struct {
	RequestsPerMinute int
	Burst             int
}

func Load() (*Config, error) {
	env := getenv("ENV", "development")

	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		return nil, fmt.Errorf("config: SESSION_SECRET is required (used to derive JWT signing keys)")
	}

	mongoURI := strings.Trim(os.Getenv("MONGODB_URI"), `"' `)
	if mongoURI == "" {
		return nil, fmt.Errorf("config: MONGODB_URI is required (MongoDB Atlas connection string)")
	}

	accessTTL, err := time.ParseDuration(getenv("JWT_ACCESS_TTL", "15m"))
	if err != nil {
		return nil, fmt.Errorf("config: invalid JWT_ACCESS_TTL: %w", err)
	}
	refreshTTL, err := time.ParseDuration(getenv("JWT_REFRESH_TTL", "720h")) // 30 days
	if err != nil {
		return nil, fmt.Errorf("config: invalid JWT_REFRESH_TTL: %w", err)
	}

	rpm, err := strconv.Atoi(getenv("RATE_LIMIT_RPM", "120"))
	if err != nil {
		return nil, fmt.Errorf("config: invalid RATE_LIMIT_RPM: %w", err)
	}
	burst, err := strconv.Atoi(getenv("RATE_LIMIT_BURST", "40"))
	if err != nil {
		return nil, fmt.Errorf("config: invalid RATE_LIMIT_BURST: %w", err)
	}

	cfg := &Config{
		Env:      env,
		Port:     getenv("CLOUD_API_PORT", "8090"),
		MongoURI: mongoURI,
		RedisURL: os.Getenv("REDIS_URL"),
		JWT: JWTConfig{
			AccessSecret:  sessionSecret,
			RefreshSecret: deriveSecret(sessionSecret, "luma-refresh-token-v1"),
			AccessTTL:     accessTTL,
			RefreshTTL:    refreshTTL,
			Issuer:        getenv("JWT_ISSUER", "luma-cloud-backend"),
		},
		MQTT: MQTTConfig{
			BrokerURL:      getenv("MQTT_BROKER_URL", "tcp://mqtt.luma.local:1883"),
			ClientIDPrefix: getenv("MQTT_CLIENT_ID_PREFIX", "luma-cloud"),
			Username:       os.Getenv("MQTT_USERNAME"),
			Password:       os.Getenv("MQTT_PASSWORD"),
			TLSEnabled:     getenv("MQTT_TLS_ENABLED", "false") == "true",
		},
		CORSOrigins: splitCSV(getenv("CORS_ORIGINS", "*")),
		RateLimit: RateLimitConfig{
			RequestsPerMinute: rpm,
			Burst:             burst,
		},
	}

	return cfg, nil
}

// deriveSecret derives an independent signing key from the base secret using
// HMAC-SHA256 with a fixed context string. This lets the backend get two
// cryptographically distinct JWT keys (access vs. refresh) out of the single
// SESSION_SECRET Replit secret already provisioned for the project, instead
// of requiring the user to mint and store extra secrets for an MVP.
func deriveSecret(base, context string) string {
	mac := hmac.New(sha256.New, []byte(base))
	mac.Write([]byte(context))
	return hex.EncodeToString(mac.Sum(nil))
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
