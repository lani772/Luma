package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"

	"github.com/luma-smart-home/authentication-service/internal/audit"
	"github.com/luma-smart-home/authentication-service/internal/auth"
	"github.com/luma-smart-home/authentication-service/internal/config"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"github.com/luma-smart-home/authentication-service/internal/email"
	"github.com/luma-smart-home/authentication-service/internal/events"
	"github.com/luma-smart-home/authentication-service/internal/jwt"
	"github.com/luma-smart-home/authentication-service/internal/middleware"
	"github.com/luma-smart-home/authentication-service/internal/passwords"
	"github.com/luma-smart-home/authentication-service/internal/repositories"
	"github.com/luma-smart-home/authentication-service/internal/security"
	"github.com/luma-smart-home/authentication-service/internal/users"
)

func main() {
	// 1. Load Configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		fmt.Printf("failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize Zap Logger
	logger, err := config.InitLogger(cfg.Env)
	if err != nil {
		fmt.Printf("failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer func() { _ = logger.Sync() }()

	logger.Info("starting LUMA independent authentication service...",
		zap.String("env", cfg.Env),
		zap.String("port", cfg.Port),
		zap.String("grpc_port", cfg.GRPCPort),
	)

	// 3. Connect to PostgreSQL
	db, err := database.Connect(cfg.DatabaseURL, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}

	// 4. Perform Auto-Migration
	logger.Info("running database auto-migrations...")
	if err := database.AutoMigrate(db); err != nil {
		logger.Fatal("failed to run database migrations", zap.Error(err))
	}
	logger.Info("database schema synchronized successfully")

	// 5. Initialize Blacklist & Redis
	blacklist := security.NewRedisBlacklist(cfg.RedisURL, logger)

	// 6. Initialize JWT Token Manager
	tokenManager, err := jwt.NewTokenManager(
		cfg.JWT.JWTAlgorithm,
		cfg.JWT.JWTIssuer,
		cfg.JWT.JWTAccessTTL,
		cfg.JWT.JWTRefreshTTL,
		cfg.JWT.JWTPrivateKeyB64,
		cfg.JWT.JWTPublicKeyB64,
		logger,
	)
	if err != nil {
		logger.Fatal("failed to initialize token manager", zap.Error(err))
	}

	// 7. Initialize Email Provider
	var emailProv email.Provider
	switch cfg.Email.EmailProvider {
	case "smtp":
		emailProv = email.NewSMTPProvider(
			cfg.Email.SMTPHost,
			cfg.Email.SMTPPort,
			cfg.Email.SMTPUser,
			cfg.Email.SMTPPassword,
			cfg.Email.SMTPFrom,
			logger,
		)
	case "mock":
		emailProv = email.NewMockProvider()
	case "console":
		fallthrough
	default:
		emailProv = email.NewConsoleProvider(logger)
	}

	// 8. Initialize Event Publisher
	eventPublisher := events.NewPublisher(
		cfg.Events.BrokerType,
		cfg.Events.NATSURL,
		cfg.Events.KafkaURL,
		cfg.Events.RabbitMQURL,
		logger,
	)

	// 9. Initialize Lockout, Risk Analyzer, and Audit Logger
	lockoutTracker := security.NewLockoutTracker(db, cfg.Security.LockoutAttempts, cfg.Security.LockoutDuration)
	riskAnalyzer := security.NewRiskAnalyzer(db)
	auditLogger := audit.NewAuditLogger(db, logger)
	passwordMgr := passwords.NewPasswordManager(db)

	// 10. Initialize Repositories
	userRepo := repositories.NewGORMUserRepository(db)
	sessionRepo := repositories.NewGORMSessionRepository(db)
	refreshRepo := repositories.NewGORMRefreshTokenRepository(db)
	emailVerifyRepo := repositories.NewGORMEmailVerificationRepository(db)
	resetRepo := repositories.NewGORMPasswordResetTokenRepository(db)
	oauthRepo := repositories.NewGORMOOAuthAccountRepository(db)
	serviceRepo := repositories.NewGORMServiceAccountRepository(db)

	// 11. Initialize Services
	authService := auth.NewService(
		userRepo,
		sessionRepo,
		refreshRepo,
		emailVerifyRepo,
		resetRepo,
		oauthRepo,
		serviceRepo,
		tokenManager,
		emailProv,
		eventPublisher,
		auditLogger,
		lockoutTracker,
		riskAnalyzer,
		blacklist,
		passwordMgr,
		cfg.Email.EmailVerificationMode,
		cfg.Email.MagicLinkTTL,
		cfg.Email.OTPTTL,
		cfg.Email.OTPMaxAttempts,
	)

	userService := users.NewUserService(userRepo)

	// 12. Setup router, routes and middleware
	h := auth.NewHandlers(authService, userService)

	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogging(logger))
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.CORS())

	// General Rate Limiting Middleware
	generalLimiter := middleware.NewRateLimiter(cfg.Security.RateLimitGeneralRPM)
	r.Use(generalLimiter.Limit())

	// Specific Rate Limiters
	loginLimiter := middleware.NewRateLimiter(cfg.Security.RateLimitLoginRPM)
	otpLimiter := middleware.NewRateLimiter(cfg.Security.RateLimitOTPRPM)
	passwordLimiter := middleware.NewRateLimiter(cfg.Security.RateLimitPasswordRPM)

	// Observability Endpoint
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// REST Endpoints Mapping
	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", h.Register)
		authGroup.POST("/login", loginLimiter.Limit(), h.Login)
		authGroup.POST("/login/step-up", loginLimiter.Limit(), h.StepUpVerify)
		authGroup.POST("/refresh", h.Refresh)
		authGroup.POST("/password/forgot", passwordLimiter.Limit(), h.ForgotPassword)
		authGroup.POST("/password/reset", passwordLimiter.Limit(), h.ResetPassword)
		authGroup.POST("/google/login", h.GoogleLogin)

		// Authenticated Routes
		authenticated := authGroup.Group("")
		authenticated.Use(middleware.RequireAuth(tokenManager, blacklist))
		{
			authenticated.POST("/logout", h.Logout)
			authenticated.GET("/me", h.Me)
			authenticated.POST("/email/send", otpLimiter.Limit(), h.SendEmailVerify)
			authenticated.POST("/email/verify", h.EmailVerify)
		}
	}

	// Internal APIs (M2M and Diagnostics)
	internalGroup := r.Group("/internal")
	{
		internalGroup.POST("/token/verify", h.InternalTokenVerify)
		internalGroup.POST("/token/introspect", h.InternalTokenIntrospect)
		internalGroup.POST("/service/token", h.InternalServiceToken)
		internalGroup.POST("/service/verify", h.InternalServiceVerify)
		internalGroup.POST("/session/revoke", h.InternalSessionRevoke)
		internalGroup.GET("/users/:id", h.InternalGetUserID)
	}

	// Seed standard development service accounts
	seedServiceAccounts(authService, logger)

	// 13. Start HTTP Server with Graceful Shutdown
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		logger.Info("REST API Server listening", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("REST API Server failed to listen", zap.Error(err))
		}
	}()

	// 14. Start dummy/mock gRPC server listener on configured port for clean infrastructure compliance
	grpcListener, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err == nil {
		go func() {
			logger.Info("gRPC Mock Service listening", zap.String("port", cfg.GRPCPort))
			for {
				conn, err := grpcListener.Accept()
				if err != nil {
					break
				}
				_ = conn.Close()
			}
		}()
	} else {
		logger.Error("failed to start gRPC mock service port", zap.Error(err))
	}

	// Listen for OS signals to execute clean shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down HTTP server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("HTTP Server forced to shutdown", zap.Error(err))
	}

	if grpcListener != nil {
		_ = grpcListener.Close()
	}

	logger.Info("authentication service shutdown clean and complete")
}

func seedServiceAccounts(s *auth.Service, logger *zap.Logger) {
	services := []struct {
		name   string
		id     string
		secret string
	}{
		{"device-service", "device-srv-id", "device-srv-secret-12345"},
		{"mqtt-service", "mqtt-srv-id", "mqtt-srv-secret-12345"},
		{"firmware-service", "firmware-srv-id", "firmware-srv-secret-12345"},
		{"notification-service", "notification-srv-id", "notification-srv-secret-12345"},
		{"automation-service", "automation-srv-id", "automation-srv-secret-12345"},
	}

	for _, svc := range services {
		_, err := s.RegisterServiceAccount(svc.name, svc.id, svc.secret)
		if err == nil {
			logger.Info("seeded service account client credentials", zap.String("service", svc.name), zap.String("clientId", svc.id))
		}
	}
}
