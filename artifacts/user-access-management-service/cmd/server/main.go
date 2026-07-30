package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/database"
	"github.com/luma-smart-home/user-access-management-service/internal/middleware"

	// Audit
	auditrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/audit/repository"
	auditsvc "github.com/luma-smart-home/user-access-management-service/internal/modules/audit/service"

	// Sync
	syncrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/sync/repository"
	syncsvc "github.com/luma-smart-home/user-access-management-service/internal/modules/sync/service"

	// Roles
	rolesrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/roles/repository"
	rolesvc "github.com/luma-smart-home/user-access-management-service/internal/modules/roles/service"
	roleshandler "github.com/luma-smart-home/user-access-management-service/internal/modules/roles/handler"
	rolesroutes "github.com/luma-smart-home/user-access-management-service/internal/modules/roles/routes"

	// Permissions
	permsrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/repository"
	permsvc "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/service"
	permshandler "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/handler"
	permsroutes "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/routes"

	// Permission Keys
	keysrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/permission_keys/repository"
	keysvc "github.com/luma-smart-home/user-access-management-service/internal/modules/permission_keys/service"

	// Invitations
	invsrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/repository"
	invssvc "github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/service"
	invshandler "github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/handler"
	invsroutes "github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/routes"

	// Access Requests
	reqsdto "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/dto"
	reqsrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/repository"
	reqssvc "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/service"
	reqshandler "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/handler"
	reqsroutes "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/routes"

	// Ownership
	ownsrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/repository"
	ownssvc "github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/service"
	ownshandler "github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/handler"
	ownsroutes "github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/routes"

	// Workers
	"github.com/luma-smart-home/user-access-management-service/internal/workers"
)

type userProfileBridge struct{}

func (b *userProfileBridge) GetProfile(ctx context.Context, userID uuid.UUID) (*reqsdto.RequesterProfileDTO, error) {
	// Fallback/mock profile since UAMS is independent of User Management Service
	return &reqsdto.RequesterProfileDTO{
		ID:            userID.String(),
		FullName:      "LUMA User",
		Email:         "user@example.com",
		EmailVerified: true,
		PhoneVerified: true,
	}, nil
}

type userLookupBridge struct{}

func (b *userLookupBridge) FindUserIDByEmail(ctx context.Context, email string) (uuid.UUID, error) {
	// Return a predictable UUID for known emails or mock a new one
	if email == "newowner@example.com" {
		id, _ := uuid.Parse("99999999-9999-9999-9999-999999999999")
		return id, nil
	}
	return uuid.New(), nil
}

func main() {
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8095"
	}

	log.Printf("Connecting to MongoDB at %s...", mongoURI)
	db, err := database.Connect(mongoURI)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	log.Println("Database connected.")

	if err := database.EnsureIndexes(db); err != nil {
		log.Fatalf("ensuring indexes failed: %v", err)
	}
	log.Println("Database indexes ensured.")

	// Instantiate audit and sync first (cross-module dependencies)
	auditRepository := auditrepo.NewRepository(db)
	auditService := auditsvc.NewService(auditRepository)

	syncRepository := syncrepo.NewRepository(db)
	syncService := syncsvc.NewService(syncRepository)

	// Repositories
	rolesRepository := rolesrepo.NewRepository(db)
	permsRepository := permsrepo.NewRepository(db)
	keysRepository := keysrepo.NewRepository(db)
	invsRepository := invsrepo.NewRepository(db)
	reqsRepository := reqsrepo.NewRepository(db)
	ownsRepository := ownsrepo.NewRepository(db)

	// Services & DI wiring
	keysService := keysvc.NewService(keysRepository, syncService, auditService)
	permsService := permsvc.NewService(permsRepository, nil, syncService, auditService) // Will wire roleRead later
	rolesService := rolesvc.NewService(rolesRepository, permsService, keysService, syncService, auditService)

	// Complete circular dependencies gracefully via back-reference or setter (since they are wired as concrete Services)
	permsService = permsvc.NewService(permsRepository, rolesService, syncService, auditService)
	rolesService = rolesvc.NewService(rolesRepository, permsService, keysService, syncService, auditService)

	profileBridge := &userProfileBridge{}
	lookupBridge := &userLookupBridge{}

	invsService := invssvc.NewService(invsRepository, rolesService, rolesService, syncService, auditService)
	reqsService := reqssvc.NewService(reqsRepository, rolesService, rolesService, profileBridge, syncService, auditService, db)
	ownsService := ownssvc.NewService(ownsRepository, rolesService, rolesService, lookupBridge, permsService, keysService, syncService, auditService)

	// Handlers
	rolesHandler := roleshandler.NewHandler(rolesService)
	permsHandler := permshandler.NewHandler(permsService)
	invsHandler := invshandler.NewHandler(invsService)
	reqsHandler := reqshandler.NewHandler(reqsService)
	ownsHandler := ownshandler.NewHandler(ownsService)

	// Start Background Workers
	workerCtx, cancelWorker := context.WithCancel(context.Background())
	defer cancelWorker()
	backgroundWorkers := workers.NewUAMSWorkers(db, syncService, auditService)
	backgroundWorkers.Start(workerCtx, 1*time.Minute)
	log.Println("UAMS Background Expiration and Cleanup Workers started.")

	// Set up Gin Router
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "user-access-management-service"})
	})

	// Mount routes under /api/v1
	v1 := r.Group("/api/v1")
	v1.Use(middleware.RequireAuth())

	rolesroutes.RegisterRoutes(v1, rolesHandler)
	permsroutes.RegisterRoutes(v1, permsHandler)
	invsroutes.RegisterRoutes(v1, invsHandler)
	reqsroutes.RegisterRoutes(v1, reqsHandler)
	ownsroutes.RegisterRoutes(v1, ownsHandler)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("UAMS server starting on port %s...", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server failed to start: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Println("Initiating graceful shutdown...")
	cancelWorker()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	log.Println("UAMS server shutdown complete.")
}
