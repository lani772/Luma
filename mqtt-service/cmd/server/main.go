package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mqtt-service/internal/api"
	"mqtt-service/internal/config"
	"mqtt-service/internal/logger"
	"mqtt-service/internal/metrics"
	"mqtt-service/internal/repository"
	"mqtt-service/internal/service"
	"mqtt-service/internal/utils"
	"mqtt-service/internal/worker"
	"mqtt-service/pkg/emqxclient"
	"mqtt-service/pkg/mqttclient"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	// 1. Load configuration
	cfg, err := config.Load("configs")
	if err != nil {
		slog.Error("failed_to_load_config", "error", err)
		os.Exit(1)
	}

	// 2. Initialize structured logging
	log := logger.Init(cfg.Logger.Level, cfg.Logger.Format)
	log.Info("initializing_luma_mqtt_service", "env", cfg.Server.Env, "port", cfg.Server.Port)

	// 3. Initialize metrics
	metrics.Init()

	// 4. Connect to PostgreSQL (with resilient SQLite fallback in local development)
	var db *gorm.DB
	db, err = repository.ConnectPostgres(cfg.Database, log)
	if err != nil {
		if cfg.Server.Env == "development" {
			log.Warn("postgres_connection_failed_falling_back_to_sqlite", "error", err)
			sqliteDB, sqlErr := gorm.Open(sqlite.Open("luma_mqtt_dev.db"), &gorm.Config{})
			if sqlErr != nil {
				log.Error("sqlite_fallback_failed_critical", "error", sqlErr)
				os.Exit(1)
			}
			db = sqliteDB
			log.Info("sqlite_resilient_database_initialized")
		} else {
			log.Error("postgres_connection_failed_critical", "error", err)
			os.Exit(1)
		}
	}

	// Run Automigrations
	if err := repository.AutoMigrate(db); err != nil {
		log.Error("failed_to_run_database_migrations", "error", err)
		os.Exit(1)
	}
	log.Info("database_migrations_applied_successfully")

	// 5. Connect to Redis (with resilient InMemory fallback)
	var redisClient repository.RedisClient
	realRedis, rerr := repository.NewRealRedisClient(cfg.Redis.Host, cfg.Redis.Port, cfg.Redis.Password, cfg.Redis.DB, log)
	if rerr != nil {
		log.Warn("redis_connection_failed_falling_back_to_in_memory", "error", rerr)
		redisClient = repository.NewInMemoryRedisClient()
	} else {
		redisClient = realRedis
	}

	// 6. Initialize Repositories
	userRepo := repository.NewUserRepository(db)
	devRepo := repository.NewDeviceRepository(db)
	telRepo := repository.NewTelemetryRepository(db)
	cmdRepo := repository.NewCommandRepository(db)

	// 7. Initialize EMQX public API client
	emqxAPIClient := emqxclient.New(emqxclient.Config{
		APIEndpoint: cfg.EMQX.APIEndpoint,
		APIKey:      cfg.EMQX.APIKey,
		APISecret:   cfg.EMQX.APISecret,
	})

	// 8. Initialize Paho MQTT client
	mqttClient := mqttclient.New(mqttclient.Config{
		BrokerHost:     cfg.EMQX.BrokerHost,
		BrokerPort:     cfg.EMQX.BrokerPort,
		ClientIDPrefix: cfg.EMQX.ClientIDPrefix,
		Username:       cfg.EMQX.Username,
		Password:       cfg.EMQX.Password,
		TLSEnabled:     cfg.EMQX.TLSWithEMQX,
		CACertPath:     cfg.EMQX.CACertPath,
		KeepAlive:      cfg.EMQX.KeepAlive,
		CleanSession:   cfg.EMQX.CleanSession,
		ConnectTimeout: cfg.EMQX.ConnectTimeout,
	}, log)

	// Start MQTT Initial connection loop with backoff asynchronously
	mqttCtx, cancelMQTT := context.WithCancel(context.Background())
	defer cancelMQTT()
	go mqttclient.ReconnectWithExponentialBackoff(mqttCtx, mqttClient, log)

	// 9. Initialize Services
	authSvc := service.NewAuthService(userRepo, cfg.Server, redisClient)
	deviceSvc := service.NewDeviceService(devRepo, redisClient, log)
	telemetrySvc := service.NewTelemetryService(telRepo)
	commandSvc := service.NewCommandService(cmdRepo, redisClient, mqttClient, log)

	// Register MQTT OnConnect Handler to synchronize subscriptions
	mqttClient.SetOnConnect(func() {
		log.Info("mqtt_on_connect_callback_triggering")
		// Synchronize status/telemetry wildcard subscriptions
		err := mqttClient.Subscribe("luma/device/+/status", 1, func(msg mqttclient.Message) {
			log.Info("mqtt_received_presence_status", "topic", msg.Topic, "payload", string(msg.Payload))
			// Handle incoming presence status from devices
			info, err := utils.ParseDeviceTopic(msg.Topic)
			if err == nil {
				devID, err := uuid.Parse(info.DeviceID)
				if err == nil {
					online := string(msg.Payload) == "online" || string(msg.Payload) == `{"status":"online"}`
					_ = deviceSvc.UpdateDeviceStatus(devID, online)
				}
			}
		})
		if err != nil {
			log.Error("failed_to_subscribe_to_status_wildcard", "error", err)
		}

		err = mqttClient.Subscribe("luma/device/+/telemetry", 1, func(msg mqttclient.Message) {
			log.Info("mqtt_received_telemetry", "topic", msg.Topic)
			info, err := utils.ParseDeviceTopic(msg.Topic)
			if err == nil {
				devID, err := uuid.Parse(info.DeviceID)
				if err == nil {
					_ = telemetrySvc.RecordTelemetry(devID, msg.Topic, string(msg.Payload))
				}
			}
		})
		if err != nil {
			log.Error("failed_to_subscribe_to_telemetry_wildcard", "error", err)
		}

		err = mqttClient.Subscribe("luma/device/+/response", 1, func(msg mqttclient.Message) {
			log.Info("mqtt_received_command_response", "topic", msg.Topic)
			info, err := utils.ParseDeviceTopic(msg.Topic)
			if err == nil {
				devID, err := uuid.Parse(info.DeviceID)
				if err == nil {
					_ = commandSvc.HandleDeviceResponse(devID, string(msg.Payload))
				}
			}
		})
		if err != nil {
			log.Error("failed_to_subscribe_to_response_wildcard", "error", err)
		}
	})

	// 10. Start Background Workers
	workerCtx, cancelWorker := context.WithCancel(context.Background())
	defer cancelWorker()
	bgWorker := worker.NewWorker(devRepo, cmdRepo, redisClient, mqttClient, log)
	bgWorker.Start(workerCtx)

	// 11. Assemble Router
	handlers := api.NewHandlers(authSvc, deviceSvc, telemetrySvc, commandSvc, redisClient, mqttClient, emqxAPIClient)
	expectedAPIKey := os.Getenv("SERVICE_API_KEY")
	if expectedAPIKey == "" {
		expectedAPIKey = "test-api-key"
	}
	router := api.SetupRouter(handlers, authSvc, expectedAPIKey, log)

	srv := &http.Server{
		Addr:              ":" + cfg.Server.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// 12. Run HTTP Server
	go func() {
		log.Info("http_server_starting", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("http_server_failed", "error", err)
			os.Exit(1)
		}
	}()

	// 13. Graceful Shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Info("graceful_shutdown_initiated")
	cancelWorker()
	cancelMQTT()

	// Wait 5 seconds for background workers to drain, then stop HTTP server
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelShutdown()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("http_server_shutdown_failed", "error", err)
	}

	mqttClient.Disconnect(2 * time.Second)
	log.Info("luma_mqtt_service_shutdown_complete")
}
