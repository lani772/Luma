package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Env      string `mapstructure:"ENV"`       // "development", "production", "test"
	Port     string `mapstructure:"PORT"`      // REST API port, e.g. "8081"
	GRPCPort string `mapstructure:"GRPC_PORT"` // gRPC API port, e.g. "50051"

	// Database Settings
	DatabaseURL string `mapstructure:"DATABASE_URL"` // PostgreSQL connection string

	// Cache Settings
	RedisURL string `mapstructure:"REDIS_URL"` // Redis connection URL

	// JWT Settings
	JWT JWTSettings `mapstructure:",squash"`

	// Email Settings
	Email EmailSettings `mapstructure:",squash"`

	// Event Settings
	Events EventSettings `mapstructure:",squash"`

	// Google Sign-In Settings
	Google GoogleSettings `mapstructure:",squash"`

	// Security Settings
	Security SecuritySettings `mapstructure:",squash"`
}

type JWTSettings struct {
	JWTIssuer        string        `mapstructure:"JWT_ISSUER"`
	JWTAccessTTL     time.Duration `mapstructure:"JWT_ACCESS_TTL"`
	JWTRefreshTTL    time.Duration `mapstructure:"JWT_REFRESH_TTL"`
	JWTAlgorithm     string        `mapstructure:"JWT_ALGORITHM"`      // "EdDSA" or "RS256"
	JWTPrivateKeyB64 string        `mapstructure:"JWT_PRIVATE_KEY_B64"` // Base64 encoded private key
	JWTPublicKeyB64  string        `mapstructure:"JWT_PUBLIC_KEY_B64"`  // Base64 encoded public key
}

type EmailSettings struct {
	EmailVerificationMode string        `mapstructure:"EMAIL_VERIFICATION_MODE"` // "OR", "AND", "MAGIC_LINK_ONLY", "OTP_ONLY"
	EmailProvider         string        `mapstructure:"EMAIL_PROVIDER"`          // "smtp", "mock", "console"
	SMTPHost              string        `mapstructure:"SMTP_HOST"`
	SMTPPort              int           `mapstructure:"SMTP_PORT"`
	SMTPUser              string        `mapstructure:"SMTP_USER"`
	SMTPPassword          string        `mapstructure:"SMTP_PASSWORD"`
	SMTPFrom              string        `mapstructure:"SMTP_FROM"`
	MagicLinkTTL          time.Duration `mapstructure:"MAGIC_LINK_TTL"`
	OTPTTL                time.Duration `mapstructure:"OTP_TTL"`
	OTPMaxAttempts        int           `mapstructure:"OTP_MAX_ATTEMPTS"`
}

type EventSettings struct {
	BrokerType string `mapstructure:"EVENT_BROKER_TYPE"` // "nats", "kafka", "rabbitmq", "memory"
	NATSURL    string `mapstructure:"NATS_URL"`
	KafkaURL   string `mapstructure:"KAFKA_URL"`
	RabbitMQURL string `mapstructure:"RABBITMQ_URL"`
}

type GoogleSettings struct {
	GoogleClientID string `mapstructure:"GOOGLE_CLIENT_ID"`
}

type SecuritySettings struct {
	LockoutAttempts       int           `mapstructure:"LOCKOUT_ATTEMPTS"`
	LockoutDuration       time.Duration `mapstructure:"LOCKOUT_DURATION"`
	RateLimitLoginRPM     int           `mapstructure:"RATE_LIMIT_LOGIN_RPM"`
	RateLimitOTPRPM       int           `mapstructure:"RATE_LIMIT_OTP_RPM"`
	RateLimitPasswordRPM  int           `mapstructure:"RATE_LIMIT_PASSWORD_RPM"`
	RateLimitGeneralRPM   int           `mapstructure:"RATE_LIMIT_GENERAL_RPM"`
	DeviceFingerprintSalt string        `mapstructure:"DEVICE_FINGERPRINT_SALT"`
}

func LoadConfig() (*Config, error) {
	viper.SetDefault("ENV", "development")
	viper.SetDefault("PORT", "8081")
	viper.SetDefault("GRPC_PORT", "50051")
	viper.SetDefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/luma_auth?sslmode=disable")
	viper.SetDefault("REDIS_URL", "redis://localhost:6379/0")

	// JWT Defaults
	viper.SetDefault("JWT_ISSUER", "luma-auth-service")
	viper.SetDefault("JWT_ACCESS_TTL", "15m")
	viper.SetDefault("JWT_REFRESH_TTL", "720h") // 30 days
	viper.SetDefault("JWT_ALGORITHM", "EdDSA")

	// Email Defaults
	viper.SetDefault("EMAIL_VERIFICATION_MODE", "OR")
	viper.SetDefault("EMAIL_PROVIDER", "console")
	viper.SetDefault("MAGIC_LINK_TTL", "15m")
	viper.SetDefault("OTP_TTL", "5m")
	viper.SetDefault("OTP_MAX_ATTEMPTS", 5)

	// Events Defaults
	viper.SetDefault("EVENT_BROKER_TYPE", "memory")

	// Security Defaults
	viper.SetDefault("LOCKOUT_ATTEMPTS", 5)
	viper.SetDefault("LOCKOUT_DURATION", "15m")
	viper.SetDefault("RATE_LIMIT_LOGIN_RPM", 5)
	viper.SetDefault("RATE_LIMIT_OTP_RPM", 5)
	viper.SetDefault("RATE_LIMIT_PASSWORD_RPM", 3)
	viper.SetDefault("RATE_LIMIT_GENERAL_RPM", 60)
	viper.SetDefault("DEVICE_FINGERPRINT_SALT", "luma-fingerprint-salt-secure-xyz")

	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
