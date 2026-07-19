// Command api is the entrypoint for the LUMA cloud backend: the API Gateway
// process that hosts the Phase 1 engines (Auth, User, Device Registration,
// MQTT Broker Adapter, Firmware, Deployment, Notifications, Sync, Backup)
// behind one Gin server, backed by MongoDB Atlas.
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

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/api"
	"github.com/luma-smart-home/cloud-backend/internal/config"
	authengine "github.com/luma-smart-home/cloud-backend/internal/engines/auth"
	backupengine "github.com/luma-smart-home/cloud-backend/internal/engines/backup"
	deploymentengine "github.com/luma-smart-home/cloud-backend/internal/engines/deployment"
	devicesengine "github.com/luma-smart-home/cloud-backend/internal/engines/devices"
	firmwareengine "github.com/luma-smart-home/cloud-backend/internal/engines/firmware"
	mqttengine "github.com/luma-smart-home/cloud-backend/internal/engines/mqtt"
	notificationengine "github.com/luma-smart-home/cloud-backend/internal/engines/notifications"
	syncengine "github.com/luma-smart-home/cloud-backend/internal/engines/sync"
	usersengine "github.com/luma-smart-home/cloud-backend/internal/engines/users"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"github.com/luma-smart-home/cloud-backend/internal/storage"
	"github.com/luma-smart-home/cloud-backend/internal/storage/cache"
	"github.com/luma-smart-home/cloud-backend/internal/storage/database"
	"github.com/luma-smart-home/cloud-backend/internal/worker"
	"github.com/luma-smart-home/cloud-backend/pkg/mqttadapter"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	mongoopts "go.mongodb.org/mongo-driver/v2/mongo/options"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		log.Error("config_load_failed", "error", err)
		os.Exit(1)
	}

	db, err := database.Connect(cfg.MongoURI)
	if err != nil {
		log.Error("database_connect_failed", "error", err)
		os.Exit(1)
	}
	log.Info("database_connected")

	if err := database.EnsureIndexes(db); err != nil {
		log.Error("database_indexes_failed", "error", err)
		os.Exit(1)
	}
	log.Info("database_indexes_ensured")

	appCache := selectCache(cfg.RedisURL, log)
	defer appCache.Close()

	mqttAdapter := selectMQTTAdapter(cfg.MQTT, log)
	if err := mqttAdapter.Connect(context.Background()); err != nil {
		// Non-fatal: the mobile app's local Core Engine keeps working over
		// the LAN even if the cloud can't reach the broker; only cloud-relay
		// features degrade. Logged loudly, never silently swallowed.
		log.Warn("mqtt_broker_connect_failed_continuing_degraded", "error", err)
	}
	defer mqttAdapter.Disconnect(5 * time.Second)

	// --- Auth engine ---
	authRepo := authengine.NewRepository(db)
	authBlacklist := authengine.NewBlacklist(appCache)
	authSvc := authengine.NewService(authRepo, cfg.JWT, authBlacklist, nil, log)
	authHandler := authengine.NewHandler(authSvc)

	// --- Device Registration engine ---
	devicesRepo := devicesengine.NewRepository(db)
	devicesSvc := devicesengine.NewService(devicesRepo, authSvc, nil)
	devicesHandler := devicesengine.NewHandler(devicesSvc)

	// --- User engine (depends on devices for the "my devices" view) ---
	usersRepo := usersengine.NewRepository(db)
	usersSvc := usersengine.NewService(usersRepo, devicesSvc)
	usersHandler := usersengine.NewHandler(usersSvc)

	// --- MQTT Adapter engine ---
	mqttRepo := mqttengine.NewRepository(db)
	mqttSvc := mqttengine.NewService(mqttRepo, mqttAdapter, cfg.MQTT.BrokerURL)
	mqttHandler := mqttengine.NewHandler(mqttSvc)

	// --- Firmware engine ---
	firmwarePath := os.Getenv("FIRMWARE_STORAGE_PATH")
	if firmwarePath == "" {
		firmwarePath = "data/firmware"
	}
	firmwareStore, err := storage.NewLocalStorageProvider(firmwarePath)
	if err != nil {
		log.Error("failed_to_initialize_firmware_storage", "error", err)
		os.Exit(1)
	}
	firmwareRepo := firmwareengine.NewRepository(db)
	firmwareSvc := firmwareengine.NewService(firmwareRepo, firmwareStore, 20*1024*1024)
	firmwareHandler := firmwareengine.NewHandler(firmwareSvc)

	// --- Firmware Deployment engine ---
	deploymentRepo := deploymentengine.NewRepository(db)
	deploymentSvc := deploymentengine.NewService(deploymentRepo, firmwareSvc)
	deploymentHandler := deploymentengine.NewHandler(deploymentSvc)

	// --- Notification engine ---
	notificationRepo := notificationengine.NewRepository(db)
	notifPrefsAdapter := &notificationsPrefsAdapter{db: db}
	mockFCM := &notificationengine.MockPushProvider{Name: "fcm", Log: log}
	mockAPNs := &notificationengine.MockPushProvider{Name: "apns", Log: log}
	mockEmail := &notificationengine.MockEmailProvider{Log: log}
	notificationSvc := notificationengine.NewService(notificationRepo, notifPrefsAdapter, mockFCM, mockAPNs, mockEmail, log)
	notificationHandler := notificationengine.NewHandler(notificationSvc)

	// --- Cloud Sync engine ---
	syncRepo := syncengine.NewRepository(db)
	syncSvc := syncengine.NewService(syncRepo)
	syncHandler := syncengine.NewHandler(syncSvc)

	// --- Cloud Backup engine ---
	backupPath := os.Getenv("BACKUP_STORAGE_PATH")
	if backupPath == "" {
		backupPath = "data/backups"
	}
	backupStore, err := storage.NewLocalStorageProvider(backupPath)
	if err != nil {
		log.Error("failed_to_initialize_backup_storage", "error", err)
		os.Exit(1)
	}
	backupRepo := backupengine.NewRepository(db)
	backupSvc := backupengine.NewService(backupRepo, backupStore)
	backupHandler := backupengine.NewHandler(backupSvc)

	router := api.NewRouter(api.Config{
		JWTAccessSecret:     cfg.JWT.AccessSecret,
		CORSOrigins:         cfg.CORSOrigins,
		RateLimitRPM:        cfg.RateLimit.RequestsPerMinute,
		RateLimitBurst:      cfg.RateLimit.Burst,
		Cache:               appCache,
		Blacklist:           authBlacklist,
		AuthHandler:         authHandler,
		UsersHandler:        usersHandler,
		DevicesHandler:      devicesHandler,
		DevicesService:      devicesSvc,
		MQTTHandler:         mqttHandler,
		FirmwareHandler:     firmwareHandler,
		DeploymentHandler:   deploymentHandler,
		NotificationHandler: notificationHandler,
		SyncHandler:         syncHandler,
		BackupHandler:       backupHandler,
		StartedAt:           time.Now(),
		Logger:              log,
	})

	bgWorker := worker.New(db, log, deploymentSvc, notificationSvc, backupSvc)
	workerCtx, cancelWorker := context.WithCancel(context.Background())
	go bgWorker.Run(workerCtx)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Info("server_starting", "port", cfg.Port, "basePath", api.BasePath, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server_failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Info("shutdown_initiated")
	cancelWorker()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("shutdown_error", "error", err)
	}
	log.Info("shutdown_complete")
}

// selectCache picks Redis when REDIS_URL is configured and reachable,
// falling back to the in-memory implementation with a loud warning
// otherwise — never a silent degrade.
func selectCache(redisURL string, log *slog.Logger) cache.Cache {
	if redisURL == "" {
		log.Warn("cache_backend_memory_fallback", "reason", "REDIS_URL not set; rate limiting and session revocation will not be shared across instances")
		return cache.NewMemoryCache()
	}
	redisCache, err := cache.NewRedisCache(redisURL)
	if err != nil {
		log.Warn("cache_backend_memory_fallback", "reason", "failed to connect to REDIS_URL", "error", err)
		return cache.NewMemoryCache()
	}
	log.Info("cache_backend_redis")
	return redisCache
}

// notificationsPrefsAdapter bridges the notification engine's preference
// lookup to the MongoDB users and user_phones collections.
type notificationsPrefsAdapter struct {
	db *mongo.Database
}

func (a *notificationsPrefsAdapter) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) ([]string, *string, *string, error) {
	var u models.User
	if err := a.db.Collection("users").FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err != nil {
		return nil, nil, nil, err
	}

	var phone models.UserPhone
	phoneOpts := mongoopts.FindOne().SetSort(bson.D{{Key: "last_seen_at", Value: -1}})
	_ = a.db.Collection("user_phones").FindOne(ctx, bson.M{
		"user_id":    userID,
		"revoked_at": nil,
		"push_token": bson.M{"$ne": nil},
	}, phoneOpts).Decode(&phone)

	var pushToken *string
	if phone.PushToken != nil {
		pushToken = phone.PushToken
	}

	enabledTypes := []string{"firmware", "device", "automation", "schedule", "user", "system"}
	return enabledTypes, pushToken, &u.Email, nil
}

func selectMQTTAdapter(mqttCfg config.MQTTConfig, log *slog.Logger) mqttadapter.Adapter {
	return mqttadapter.NewPahoAdapter(mqttadapter.Config{
		BrokerURL:      mqttCfg.BrokerURL,
		ClientIDPrefix: mqttCfg.ClientIDPrefix,
		Username:       mqttCfg.Username,
		Password:       mqttCfg.Password,
		TLSEnabled:     mqttCfg.TLSEnabled,
	}, log)
}
