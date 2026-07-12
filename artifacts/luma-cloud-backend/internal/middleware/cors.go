package middleware

import (
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
)

// CORS allows the configured origins (mobile web builds, local dev tools)
// to call the API cross-origin. Native mobile HTTP clients are unaffected
// by CORS entirely, so this mainly matters for Expo web / browser testing.
func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowAll := slices.Contains(allowedOrigins, "*")
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && (allowAll || slices.Contains(allowedOrigins, origin)) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
