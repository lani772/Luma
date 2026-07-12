package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/cloud-backend/internal/httputil"
	"github.com/luma-smart-home/cloud-backend/internal/storage/cache"
)

// RateLimit implements a fixed-window counter per client IP (or per
// authenticated user, once RequireAuth has run) backed by the shared Cache
// abstraction — Redis in production, in-memory in dev. window is always one
// minute; requestsPerWindow/burst come from RateLimitConfig.
func RateLimit(c cache.Cache, requestsPerWindow, burst int) gin.HandlerFunc {
	limit := requestsPerWindow + burst
	return func(ctx *gin.Context) {
		key := rateLimitKey(ctx)
		count, err := c.Incr(ctx.Request.Context(), key, time.Minute)
		if err != nil {
			// Fail open: a cache outage should not take the whole API down.
			ctx.Next()
			return
		}
		ctx.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
		remaining := limit - int(count)
		if remaining < 0 {
			remaining = 0
		}
		ctx.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

		if int(count) > limit {
			httputil.Fail(ctx, http.StatusTooManyRequests, httputil.ErrRateLimited, "rate limit exceeded, try again shortly", nil)
			return
		}
		ctx.Next()
	}
}

func rateLimitKey(c *gin.Context) string {
	if userID, ok := c.Get(ContextUserIDKey); ok {
		return "ratelimit:user:" + userID.(string)
	}
	return "ratelimit:ip:" + c.ClientIP()
}
