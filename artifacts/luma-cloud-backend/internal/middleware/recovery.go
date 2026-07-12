package middleware

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/cloud-backend/internal/httputil"
)

// Recovery turns a panic in any handler into a structured 500 response
// instead of killing the connection/process, and logs the stack for
// operators. Placed first in the middleware chain (after RequestID) so the
// response still carries a request ID for correlation.
func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(nil, func(c *gin.Context, recovered any) {
		logger.Error("panic_recovered",
			"requestId", GetRequestID(c),
			"path", c.FullPath(),
			"recovered", recovered,
		)
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "internal server error", nil)
	})
}
