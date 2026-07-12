package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// StructuredLogging logs one structured line per request via log/slog,
// tagging it with the request ID assigned by RequestID().
func StructuredLogging(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		logger.Info("http_request",
			"requestId", GetRequestID(c),
			"method", c.Request.Method,
			"path", c.FullPath(),
			"status", c.Writer.Status(),
			"durationMs", time.Since(start).Milliseconds(),
			"clientIp", c.ClientIP(),
			"userId", userIDFromContext(c),
		)
	}
}

func userIDFromContext(c *gin.Context) string {
	if v, ok := c.Get(ContextUserIDKey); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
