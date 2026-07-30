package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/luma-smart-home/user-access-management-service/internal/httputil"
)

const (
	ContextUserIDKey    = "authUserID"
	ContextSessionIDKey = "authSessionID"
	ContextUserRoleKey  = "authRole"
)

type Claims struct {
	UserID    string `json:"sub"`
	SessionID string `json:"sid"`
	Role      string `json:"role"`
	jwt.RegisteredClaims
}

func RequireAuth() gin.HandlerFunc {
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "fallback-secret-for-dev"
	}

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
			httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid access token", nil)
			return
		}

		c.Set(ContextUserIDKey, claims.UserID)
		c.Set(ContextSessionIDKey, claims.SessionID)
		c.Set(ContextUserRoleKey, claims.Role)
		c.Next()
	}
}
