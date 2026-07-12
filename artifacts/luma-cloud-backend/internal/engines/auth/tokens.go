// Package auth implements the Authentication Engine: registration, login,
// refresh, logout, session/device management, password reset, and email
// verification for the mobile app (and, later, any first-party web client).
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/luma-smart-home/cloud-backend/internal/middleware"
)

// issueAccessToken signs a short-lived JWT carrying the session id, so a
// revoked session is rejected by RequireAuth even before the JWT's own exp
// is reached (see TokenBlacklist).
func (s *Service) issueAccessToken(userID, sessionID, role string) (string, time.Time, error) {
	expiresAt := time.Now().Add(s.cfg.AccessTTL)
	claims := middleware.Claims{
		UserID:    userID,
		SessionID: sessionID,
		Role:      role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.cfg.Issuer,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.AccessSecret))
	return signed, expiresAt, err
}

// generateOpaqueToken returns a random URL-safe token plus its SHA-256 hash.
// Refresh tokens, password-reset tokens, and email-verification tokens are
// all opaque (not JWTs): only the hash is stored, so a leaked database dump
// can't be replayed as a live token.
func generateOpaqueToken() (raw string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("auth: generate token: %w", err)
	}
	raw = base64.RawURLEncoding.EncodeToString(buf)
	hash = hashToken(raw)
	return raw, hash, nil
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
