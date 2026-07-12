package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDHeader = "X-Request-Id"
const requestIDKey = "requestID"

// RequestID assigns a UUID to every request (or reuses the caller-supplied
// one) so it can be correlated across structured logs, audit log rows, and
// client-side error reports.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			id = uuid.NewString()
		}
		c.Set(requestIDKey, id)
		c.Header(RequestIDHeader, id)
		c.Next()
	}
}

func GetRequestID(c *gin.Context) string {
	if v, ok := c.Get(requestIDKey); ok {
		return v.(string)
	}
	return ""
}
