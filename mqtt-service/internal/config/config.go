package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Redis    RedisConfig    `yaml:"redis"`
	EMQX     EMQXConfig     `yaml:"emqx"`
	Logger   LoggerConfig   `yaml:"logger"`
}

type ServerConfig struct {
	Port             string        `yaml:"port"`
	Env              string        `yaml:"env"`
	JWTSecret        string        `yaml:"jwt_secret"`
	JWTRefreshSecret string        `yaml:"jwt_refresh_secret"`
	JWTAccessTTL     time.Duration `yaml:"jwt_access_ttl"`
	JWTRefreshTTL    time.Duration `yaml:"jwt_refresh_ttl"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Name     string `yaml:"name"`
	SSLMode  string `yaml:"sslmode"`
}

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type EMQXConfig struct {
	APIEndpoint    string `yaml:"api_endpoint"`
	APIKey         string `yaml:"api_key"`
	APISecret      string `yaml:"api_secret"`
	BrokerHost     string `yaml:"broker_host"`
	BrokerPort     int    `yaml:"broker_port"`
	Username       string `yaml:"username"`
	Password       string `yaml:"password"`
	TLSWithEMQX    bool   `yaml:"tls_enabled"`
	CACertPath     string `yaml:"ca_cert_path"`
	ClientIDPrefix string `yaml:"client_id_prefix"`
	KeepAlive      int    `yaml:"keep_alive"`
	CleanSession   bool   `yaml:"clean_session"`
	ConnectTimeout int    `yaml:"connect_timeout"`
	WriteTimeout   int    `yaml:"write_timeout"`
}

type LoggerConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
}

func Load(configDir string) (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Port:             "8091",
			Env:              "development",
			JWTSecret:        "change-me-to-a-long-random-string",
			JWTRefreshSecret: "change-me-to-a-refresh-random-string",
			JWTAccessTTL:     15 * time.Minute,
			JWTRefreshTTL:    720 * time.Hour,
		},
		Database: DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			User:     "luma",
			Password: "luma_password",
			Name:     "luma_mqtt",
			SSLMode:  "disable",
		},
		Redis: RedisConfig{
			Host: "localhost",
			Port: 6379,
			DB:   0,
		},
		EMQX: EMQXConfig{
			APIEndpoint:    "https://cloud-intl.emqx.com/public_api/v1",
			BrokerHost:     "localhost",
			BrokerPort:     1883,
			ClientIDPrefix: "luma-gateway",
			KeepAlive:      60,
			CleanSession:   true,
			ConnectTimeout: 10,
			WriteTimeout:   10,
		},
		Logger: LoggerConfig{
			Level:  "info",
			Format: "json",
		},
	}

	// 1. Try to load from yaml configuration files
	if configDir != "" {
		_ = loadYAML(filepath.Join(configDir, "app.yaml"), cfg)
		_ = loadYAML(filepath.Join(configDir, "mqtt.yaml"), cfg)
		_ = loadYAML(filepath.Join(configDir, "logger.yaml"), cfg)
	}

	// 2. Override with Environment Variables
	overrideWithEnv(cfg)

	// Validate critical configuration
	if cfg.Server.JWTSecret == "" || cfg.Server.JWTSecret == "change-me-to-a-long-random-string" {
		if cfg.Server.Env == "production" {
			return nil, fmt.Errorf("config: secure Server.JWTSecret is required in production environment")
		}
	}

	return cfg, nil
}

func loadYAML(path string, cfg *Config) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return yaml.Unmarshal(data, cfg)
}

func overrideWithEnv(cfg *Config) {
	// Server overrides
	if port := os.Getenv("PORT"); port != "" {
		cfg.Server.Port = port
	} else if apiPort := os.Getenv("CLOUD_API_PORT"); apiPort != "" {
		cfg.Server.Port = apiPort
	}
	if env := os.Getenv("ENV"); env != "" {
		cfg.Server.Env = env
	}
	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		cfg.Server.JWTSecret = jwtSecret
	}
	if jwtRefSec := os.Getenv("JWT_REFRESH_SECRET"); jwtRefSec != "" {
		cfg.Server.JWTRefreshSecret = jwtRefSec
	}
	if jwtAccessTTL := os.Getenv("JWT_ACCESS_TTL"); jwtAccessTTL != "" {
		if dur, err := time.ParseDuration(jwtAccessTTL); err == nil {
			cfg.Server.JWTAccessTTL = dur
		}
	}
	if jwtRefreshTTL := os.Getenv("JWT_REFRESH_TTL"); jwtRefreshTTL != "" {
		if dur, err := time.ParseDuration(jwtRefreshTTL); err == nil {
			cfg.Server.JWTRefreshTTL = dur
		}
	}

	// Database overrides
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		// Try parsing postgresql connection string postgres://user:pass@host:port/dbname?sslmode=disable
		parseDatabaseURL(dbURL, &cfg.Database)
	}
	if dbHost := os.Getenv("DB_HOST"); dbHost != "" {
		cfg.Database.Host = dbHost
	}
	if dbPortStr := os.Getenv("DB_PORT"); dbPortStr != "" {
		if p, err := strconv.Atoi(dbPortStr); err == nil {
			cfg.Database.Port = p
		}
	}
	if dbUser := os.Getenv("DB_USER"); dbUser != "" {
		cfg.Database.User = dbUser
	}
	if dbPassword := os.Getenv("DB_PASSWORD"); dbPassword != "" {
		cfg.Database.Password = dbPassword
	}
	if dbName := os.Getenv("DB_NAME"); dbName != "" {
		cfg.Database.Name = dbName
	}
	if dbSSLMode := os.Getenv("DB_SSLMODE"); dbSSLMode != "" {
		cfg.Database.SSLMode = dbSSLMode
	}

	// Redis overrides
	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		parseRedisURL(redisURL, &cfg.Redis)
	}
	if redisHost := os.Getenv("REDIS_HOST"); redisHost != "" {
		cfg.Redis.Host = redisHost
	}
	if redisPortStr := os.Getenv("REDIS_PORT"); redisPortStr != "" {
		if p, err := strconv.Atoi(redisPortStr); err == nil {
			cfg.Redis.Port = p
		}
	}
	if redisPassword := os.Getenv("REDIS_PASSWORD"); redisPassword != "" {
		cfg.Redis.Password = redisPassword
	}
	if redisDBStr := os.Getenv("REDIS_DB"); redisDBStr != "" {
		if db, err := strconv.Atoi(redisDBStr); err == nil {
			cfg.Redis.DB = db
		}
	}

	// EMQX overrides
	if emqxAPIEndpoint := os.Getenv("EMQX_API_ENDPOINT"); emqxAPIEndpoint != "" {
		cfg.EMQX.APIEndpoint = emqxAPIEndpoint
	}
	if emqxAPIKey := os.Getenv("EMQX_API_KEY"); emqxAPIKey != "" {
		cfg.EMQX.APIKey = emqxAPIKey
	}
	if emqxAPISecret := os.Getenv("EMQX_API_SECRET"); emqxAPISecret != "" {
		cfg.EMQX.APISecret = emqxAPISecret
	}
	if emqxBrokerHost := os.Getenv("EMQX_BROKER_HOST"); emqxBrokerHost != "" {
		cfg.EMQX.BrokerHost = emqxBrokerHost
	}
	if emqxBrokerPortStr := os.Getenv("EMQX_BROKER_PORT"); emqxBrokerPortStr != "" {
		if p, err := strconv.Atoi(emqxBrokerPortStr); err == nil {
			cfg.EMQX.BrokerPort = p
		}
	}
	if emqxUsername := os.Getenv("EMQX_USERNAME"); emqxUsername != "" {
		cfg.EMQX.Username = emqxUsername
	}
	if emqxPassword := os.Getenv("EMQX_PASSWORD"); emqxPassword != "" {
		cfg.EMQX.Password = emqxPassword
	}
	if emqxTLSEnabledStr := os.Getenv("EMQX_TLS_ENABLED"); emqxTLSEnabledStr != "" {
		cfg.EMQX.TLSWithEMQX = (emqxTLSEnabledStr == "true")
	}
	if emqxCACertPath := os.Getenv("EMQX_CA_CERT_PATH"); emqxCACertPath != "" {
		cfg.EMQX.CACertPath = emqxCACertPath
	}

	// Logger overrides
	if logLogLevel := os.Getenv("LOG_LEVEL"); logLogLevel != "" {
		cfg.Logger.Level = logLogLevel
	}
	if logFormat := os.Getenv("LOG_FORMAT"); logFormat != "" {
		cfg.Logger.Format = logFormat
	}
}

func parseDatabaseURL(url string, dbCfg *DatabaseConfig) {
	// Simple manual parser for: postgres://user:pass@host:port/dbname?sslmode=disable
	if !strings.HasPrefix(url, "postgres://") && !strings.HasPrefix(url, "postgresql://") {
		return
	}
	trimmed := strings.TrimPrefix(strings.TrimPrefix(url, "postgres://"), "postgresql://")

	// Split queries
	parts := strings.Split(trimmed, "?")
	mainPart := parts[0]
	if len(parts) > 1 {
		queries := strings.Split(parts[1], "&")
		for _, q := range queries {
			pair := strings.Split(q, "=")
			if len(pair) == 2 && pair[0] == "sslmode" {
				dbCfg.SSLMode = pair[1]
			}
		}
	}

	// Split user/password and host/port/dbname
	authAndHost := strings.Split(mainPart, "@")
	var hostAndDB string
	if len(authAndHost) == 2 {
		userAndPass := strings.Split(authAndHost[0], ":")
		dbCfg.User = userAndPass[0]
		if len(userAndPass) > 1 {
			dbCfg.Password = userAndPass[1]
		}
		hostAndDB = authAndHost[1]
	} else {
		hostAndDB = authAndHost[0]
	}

	// Split host, port and dbname
	hostAndPortDB := strings.Split(hostAndDB, "/")
	if len(hostAndPortDB) > 1 {
		dbCfg.Name = hostAndPortDB[1]
	}
	hostPort := strings.Split(hostAndPortDB[0], ":")
	dbCfg.Host = hostPort[0]
	if len(hostPort) > 1 {
		if p, err := strconv.Atoi(hostPort[1]); err == nil {
			dbCfg.Port = p
		}
	}
}

func parseRedisURL(url string, rCfg *RedisConfig) {
	// Simple manual parser for: redis://:pass@host:port/db
	if !strings.HasPrefix(url, "redis://") {
		return
	}
	trimmed := strings.TrimPrefix(url, "redis://")
	authAndHost := strings.Split(trimmed, "@")
	var hostAndDB string
	if len(authAndHost) == 2 {
		pass := authAndHost[0]
		if strings.HasPrefix(pass, ":") {
			rCfg.Password = strings.TrimPrefix(pass, ":")
		} else {
			userPass := strings.Split(pass, ":")
			if len(userPass) > 1 {
				rCfg.Password = userPass[1]
			}
		}
		hostAndDB = authAndHost[1]
	} else {
		hostAndDB = authAndHost[0]
	}

	hostPortDB := strings.Split(hostAndDB, "/")
	if len(hostPortDB) > 1 {
		if db, err := strconv.Atoi(hostPortDB[1]); err == nil {
			rCfg.DB = db
		}
	}
	hostPort := strings.Split(hostPortDB[0], ":")
	rCfg.Host = hostPort[0]
	if len(hostPort) > 1 {
		if p, err := strconv.Atoi(hostPort[1]); err == nil {
			rCfg.Port = p
		}
	}
}
