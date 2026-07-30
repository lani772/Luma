package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/jwt"
	"github.com/luma-smart-home/authentication-service/internal/security"
	"go.uber.org/zap"
)

const (
	ContextUserIDKey    = "userID"
	ContextSessionIDKey = "sessionID"
	ContextRequestIDKey = "requestID"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		reqID := c.GetHeader("X-Request-ID")
		if reqID == "" {
			reqID = uuid.New().String()
		}
		c.Set(ContextRequestIDKey, reqID)
		c.Header("X-Request-ID", reqID)
		c.Next()
	}
}

func StructuredLogging(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		reqID, _ := c.Get(ContextRequestIDKey)

		fields := []zap.Field{
			zap.Int("status", status),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", query),
			zap.String("ip", c.ClientIP()),
			zap.String("user-agent", c.Request.UserAgent()),
			zap.Duration("latency", latency),
		}
		if reqID != nil {
			fields = append(fields, zap.String("request_id", reqID.(string)))
		}

		if len(c.Errors) > 0 {
			for _, e := range c.Errors.Errors() {
				logger.Error(e, fields...)
			}
		} else {
			logger.Info("request processed", fields...)
		}
	}
}

func Recovery(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				reqID, _ := c.Get(ContextRequestIDKey)
				logger.Error("panic recovered during request execution",
					zap.Any("error", err),
					zap.Any("request_id", reqID),
				)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_ERROR",
						"message": "An unexpected server panic occurred.",
					},
				})
			}
		}()
		c.Next()
	}
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func RequireAuth(tokenManager *jwt.TokenManager, blacklist security.TokenBlacklist) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "Authorization bearer token is missing or malformed",
				},
			})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := tokenManager.VerifyUserAccessToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": fmt.Sprintf("invalid access token: %v", err),
				},
			})
			return
		}

		// Blacklist check (fast memory/Redis validation)
		if blacklist.IsRevoked(claims.SessionID) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "TOKEN_REVOKED",
					"message": "this session token has been revoked",
				},
			})
			return
		}

		c.Set(ContextUserIDKey, claims.UserID)
		c.Set(ContextSessionIDKey, claims.SessionID)
		c.Next()
	}
}

// Simple IP Rate Limiter
type RateLimiter struct {
	mu       sync.Mutex
	ips      map[string][]time.Time
	rpmLimit int
}

func NewRateLimiter(rpmLimit int) *RateLimiter {
	return &RateLimiter{
		ips:      make(map[string][]time.Time),
		rpmLimit: rpmLimit,
	}
}

func (rl *RateLimiter) Limit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		rl.mu.Lock()
		defer rl.mu.Unlock()

		now := time.Now()
		var active []time.Time
		for _, t := range rl.ips[ip] {
			if now.Sub(t) < time.Minute {
				active = append(active, t)
			}
		}

		if len(active) >= rl.rpmLimit {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "RATE_LIMITED",
					"message": "too many requests, please slow down.",
				},
			})
			return
		}

		active = append(active, now)
		rl.ips[ip] = active
		c.Next()
	}
}
