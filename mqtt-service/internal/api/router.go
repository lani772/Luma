package api

import (
	"log/slog"
	"net/http"
	"time"

	"mqtt-service/internal/middleware"
	"mqtt-service/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func SetupRouter(h *Handlers, authSvc *service.AuthService, expectedAPIKey string, log *slog.Logger) *gin.Engine {
	r := gin.New()

	// Global Middlewares
	r.Use(gin.Recovery())

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-API-Key")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Prometheus Metrics Endpoint (Public)
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Health Endpoints (Public)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "UP", "timestamp": time.Now()})
	})
	r.GET("/ready", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "READY"})
	})
	r.GET("/live", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ALIVE"})
	})

	// API Version 1 Group
	api := r.Group("/api/v1")

	// Authentication Endpoints
	auth := api.Group("/auth")
	{
		auth.POST("/register", h.Register)
		auth.POST("/login", h.Login)
		auth.POST("/refresh", h.Refresh)
		auth.POST("/logout", h.Logout)
	}

	// Service-to-Service routes (API Key authorized)
	serviceAuth := middleware.APIKeyAuth(expectedAPIKey)

	// User authorized routes (JWT Auth)
	userAuth := middleware.JWTAuth(authSvc)

	// Device registration
	api.POST("/devices/register", userAuth, h.RegisterDevice)

	// MQTT Control Endpoints (supports either User JWT Auth or API Key service-to-service auth)
	mqttGroup := api.Group("/mqtt")
	mqttGroup.Use(func(c *gin.Context) {
		// Dual Authentication: checks for valid Bearer token OR X-API-Key
		authHeader := c.GetHeader("Authorization")
		apiKey := c.GetHeader("X-API-Key")

		if authHeader != "" {
			userAuth(c)
		} else if apiKey != "" {
			serviceAuth(c)
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: authentication required"})
			c.Abort()
		}
	})

	{
		mqttGroup.POST("/publish", h.Publish)
		mqttGroup.POST("/subscribe", h.Subscribe)
		mqttGroup.POST("/unsubscribe", h.Unsubscribe)
		mqttGroup.POST("/devices/:deviceId/commands", h.SendDeviceCommand)
		mqttGroup.GET("/devices/:deviceId/status", h.GetDeviceStatus)
		mqttGroup.GET("/devices/:deviceId/telemetry", h.GetDeviceTelemetry)
		mqttGroup.GET("/connections", h.GetActiveConnections)
		mqttGroup.GET("/health", h.GetBrokerHealth)
		mqttGroup.GET("/stats", h.GetStats)
	}

	return r
}
