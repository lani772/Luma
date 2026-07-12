// Package api assembles the Gin router: the API Gateway skeleton that fans
// out to each engine. Phase 1 wires Auth, Users, Devices, and the MQTT
// Adapter; Phase 2 engines (Firmware, Notifications, Sync, Backup,
// Analytics, Audit, Scene/Schedule) will each get their own RegisterRoutes
// call here once built, following the same pattern.
package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authengine "github.com/luma-smart-home/cloud-backend/internal/engines/auth"
	devicesengine "github.com/luma-smart-home/cloud-backend/internal/engines/devices"
	mqttengine "github.com/luma-smart-home/cloud-backend/internal/engines/mqtt"
	usersengine "github.com/luma-smart-home/cloud-backend/internal/engines/users"
	"github.com/luma-smart-home/cloud-backend/internal/httputil"
	"github.com/luma-smart-home/cloud-backend/internal/middleware"
	"github.com/luma-smart-home/cloud-backend/internal/storage/cache"
)

// BasePath is the proxy path prefix this artifact owns in the Replit
// workspace, distinct from the existing Node/Express api-server's "/api"
// prefix. Every route below is nested under it. The literal spec wording
// ("/api/engines/*") is preserved as an *additional* alias path
// ("/cloud/api/engines/*") so integrators following the spec verbatim still
// find working routes — see docs/openapi.yaml for the full path list.
const BasePath = "/cloud"

type Config struct {
	JWTAccessSecret   string
	CORSOrigins       []string
	RateLimitRPM      int
	RateLimitBurst    int
	Cache             cache.Cache
	Blacklist         middleware.TokenBlacklist
	AuthHandler       *authengine.Handler
	UsersHandler      *usersengine.Handler
	DevicesHandler    *devicesengine.Handler
	DevicesService    *devicesengine.Service
	MQTTHandler       *mqttengine.Handler
	StartedAt         time.Time
	Logger            *slog.Logger
}

func NewRouter(cfg Config) *gin.Engine {
	r := gin.New()
	r.Use(middleware.Recovery(cfg.Logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogging(cfg.Logger))
	r.Use(middleware.CORS(cfg.CORSOrigins))

	root := r.Group(BasePath)

	root.GET("/healthz", func(c *gin.Context) {
		httputil.OK(c, http.StatusOK, gin.H{
			"status":       "ok",
			"uptime":       time.Since(cfg.StartedAt).String(),
			"cacheBackend": cfg.Cache.Backend(),
		})
	})

	root.Use(middleware.RateLimit(cfg.Cache, cfg.RateLimitRPM, cfg.RateLimitBurst))

	requireAuth := middleware.RequireAuth(cfg.JWTAccessSecret, cfg.Blacklist)

	// Mobile-facing convenience paths, e.g. POST /cloud/auth/login.
	authGroup := root.Group("/auth")
	// Spec-literal gateway alias, e.g. POST /cloud/api/engines/auth/login.
	authGatewayGroup := root.Group("/api/engines/auth")
	cfg.AuthHandler.RegisterRoutes(authGroup, authGatewayGroup, requireAuth)

	usersGroup := root.Group("/users", requireAuth)
	cfg.UsersHandler.RegisterRoutes(usersGroup)
	usersGatewayGroup := root.Group("/api/engines/users", requireAuth)
	cfg.UsersHandler.RegisterRoutes(usersGatewayGroup)

	devicesGroup := root.Group("/devices", requireAuth)
	cfg.DevicesHandler.RegisterRoutes(devicesGroup)
	devicesGatewayGroup := root.Group("/api/engines/devices", requireAuth)
	cfg.DevicesHandler.RegisterRoutes(devicesGatewayGroup)

	mqttGroup := root.Group("/engines/mqtt")
	cfg.MQTTHandler.RegisterRoutes(mqttGroup)
	accessMiddleware := devicesAccessMiddleware(cfg.DevicesService)
	cfg.MQTTHandler.RegisterDeviceRoutes(devicesGroup, accessMiddleware)
	cfg.MQTTHandler.RegisterDeviceRoutes(devicesGatewayGroup, accessMiddleware)

	return r
}

// devicesAccessMiddleware re-checks owner/admin access for MQTT credential
// routes, which are mounted on the devices group but defined in the mqtt
// engine — kept here (rather than exported from the devices package) so the
// two engines don't need to import each other's handler internals.
func devicesAccessMiddleware(svc *devicesengine.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.GetString(middleware.ContextUserIDKey)
		deviceIDStr := c.Param("deviceId")
		if userIDStr == "" || deviceIDStr == "" {
			httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "missing auth or device context", nil)
			return
		}
		userID, err1 := uuid.Parse(userIDStr)
		deviceID, err2 := uuid.Parse(deviceIDStr)
		if err1 != nil || err2 != nil {
			httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid id", nil)
			return
		}
		allowed, err := svc.CanAccess(deviceID, userID)
		if err != nil {
			httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to check access", nil)
			return
		}
		if !allowed {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, "you do not have access to this device", nil)
			return
		}
		c.Next()
	}
}
