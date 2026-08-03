package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/device-registration-service/internal/ai"
	"github.com/luma-smart-home/device-registration-service/internal/domain"
	"github.com/luma-smart-home/device-registration-service/internal/events"
	"github.com/luma-smart-home/device-registration-service/internal/firmware"
	"github.com/luma-smart-home/device-registration-service/internal/handlers"
	"github.com/luma-smart-home/device-registration-service/internal/repository"
	"github.com/luma-smart-home/device-registration-service/internal/routes"
	"github.com/luma-smart-home/device-registration-service/internal/security"
	"github.com/luma-smart-home/device-registration-service/internal/services"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	log.Println("[DRDMS] Starting LUMA Device Registration & Device Management Service...")

	// 1. Initialize DB (SQLite fallback for dev/testing, Postgres for prod)
	var db *gorm.DB
	var err error
	dbURL := os.Getenv("DATABASE_URL")

	if dbURL != "" {
		log.Println("[DRDMS] Connecting to PostgreSQL database...")
		db, err = gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	} else {
		log.Println("[DRDMS] No DATABASE_URL found. Initializing Local SQLite Database (luma_drdms.db)...")
		db, err = gorm.Open(sqlite.Open("luma_drdms.db"), &gorm.Config{})
	}

	if err != nil {
		log.Fatalf("[DRDMS] Failed to connect to database: %v", err)
	}

	// 2. Run schema auto-migrations (stable local models check)
	log.Println("[DRDMS] Running database schema auto-migrations...")
	err = db.AutoMigrate(
		&domain.Controller{},
		&domain.Room{},
		&domain.Resource{},
		&domain.DeviceCapability{},
		&domain.DeviceConfiguration{},
		&domain.DeviceCredentials{},
		&domain.DeviceSimulation{},
	)
	if err != nil {
		log.Fatalf("[DRDMS] AutoMigration failed: %v", err)
	}

	// 3. Initialize Repositories
	ctrlRepo := repository.NewControllerRepository(db)
	roomRepo := repository.NewRoomRepository(db)
	resRepo := repository.NewResourceRepository(db)
	capRepo := repository.NewCapabilityRepository(db)
	configRepo := repository.NewConfigurationRepository(db)
	credsRepo := repository.NewCredentialsRepository(db)
	simRepo := repository.NewSimulationRepository(db)

	// 4. Initialize Utilities & Services
	encryptor, err := security.NewAESGCMEncryptor()
	if err != nil {
		log.Fatalf("[DRDMS] Failed to initialize AESGCMEncryptor: %v", err)
	}

	jwtMiddleware, err := security.NewJWTMiddleware()
	if err != nil {
		log.Fatalf("[DRDMS] Failed to initialize JWTMiddleware: %v", err)
	}

	pub := events.NewLogPublisher()
	aiProvider := ai.NewMockAIProvider()
	fwGen := firmware.NewGenerator()

	regService := services.NewRegistrationService(
		ctrlRepo, credsRepo, simRepo, configRepo, resRepo, capRepo, encryptor, pub,
	)
	resService := services.NewResourceManagementService(
		ctrlRepo, resRepo, configRepo, roomRepo,
	)
	capService := services.NewCapabilityManagementService(
		resRepo, capRepo,
	)

	// 5. Setup Gin Engine & Router
	r := gin.Default()

	// Global Health Check
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "OK", "service": "luma-device-registration-service"})
	})

	ctrlHandler := handlers.NewControllerHandler(
		*regService, *resService, *capService, aiProvider, *fwGen, ctrlRepo, credsRepo,
	)

	routes.RegisterControllerRoutes(r, ctrlHandler, jwtMiddleware)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8095"
	}

	log.Printf("[DRDMS] Server listening on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("[DRDMS] Server failed to start: %v", err)
	}
}
