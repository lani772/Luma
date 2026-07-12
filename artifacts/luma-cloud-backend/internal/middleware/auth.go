package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/luma-smart-home/cloud-backend/internal/httputil"
)

// ContextUserIDKey/ContextSessionIDKey are the gin.Context keys handlers use
// to read the authenticated principal after RequireAuth has run.
const (
	ContextUserIDKey    = "authUserID"
	ContextSessionIDKey = "authSessionID"
)

// Claims is the JWT access-token payload. Refresh tokens are opaque random
// strings stored hashed in the sessions table, not JWTs — see
// internal/engines/auth/tokens.go for the rationale.
type Claims struct {
	UserID    string `json:"sub"`
	SessionID string `json:"sid"`
	Role      string `json:"role"`
	jwt.RegisteredClaims
}

// TokenBlacklist is checked on every authenticated request so a revoked
// session (logout, password reset, admin action) takes effect immediately
// instead of waiting for the access token's own short TTL to expire.
type TokenBlacklist interface {
	IsRevoked(sessionID string) bool
}

// RequireAuth validates the bearer JWT, rejects revoked sessions, and
// populates the request context with the authenticated user/session ids.
func RequireAuth(secret string, blacklist TokenBlacklist) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "missing bearer token", nil)
			return
		}
		raw := strings.TrimPrefix(header, "Bearer ")

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			if err != nil && strings.Contains(err.Error(), "expired") {
				httputil.Fail(c, http.StatusUnauthorized, httputil.ErrTokenExpired, "access token expired", nil)
				return
			}
			httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid access token", nil)
			return
		}

		if blacklist != nil && blacklist.IsRevoked(claims.SessionID) {
			httputil.Fail(c, http.StatusUnauthorized, httputil.ErrTokenRevoked, "session has been revoked", nil)
			return
		}

		c.Set(ContextUserIDKey, claims.UserID)
		c.Set(ContextSessionIDKey, claims.SessionID)
		c.Set("authRole", claims.Role)
		c.Next()
	}
}

// RequireRole gates a route to one of the given roles. Call after
// RequireAuth so authRole is already populated.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		role, _ := c.Get("authRole")
		if _, ok := allowed[role.(string)]; !ok {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, "insufficient role", nil)
			return
		}
		c.Next()
	}
}
