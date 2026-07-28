package unit

import (
	"mqtt-service/internal/config"
	"mqtt-service/internal/dto"
	"mqtt-service/internal/repository"
	"mqtt-service/internal/service"
	"testing"
	"time"
)

func TestAuthService_Flow(t *testing.T) {
	db := setupTestDB(t)
	userRepo := repository.NewUserRepository(db)
	redis := repository.NewInMemoryRedisClient()

	cfg := config.ServerConfig{
		Port:             "8091",
		Env:              "development",
		JWTSecret:        "test_secret_key_123456_longer_needed",
		JWTRefreshSecret: "test_refresh_secret_key_123456_longer",
		JWTAccessTTL:     5 * time.Minute,
		JWTRefreshTTL:    1 * time.Hour,
	}

	authSvc := service.NewAuthService(userRepo, cfg, redis)

	// 1. Register User
	regReq := dto.RegisterRequest{
		Username: "alice",
		Email:    "alice@example.com",
		Password: "password123",
	}

	resp, err := authSvc.Register(regReq)
	if err != nil {
		t.Fatalf("registration failed: %v", err)
	}

	if resp.Username != "alice" || resp.Role != "user" {
		t.Errorf("unexpected registered user response: %+v", resp)
	}

	// 2. Try duplicate registration
	_, err = authSvc.Register(regReq)
	if err == nil {
		t.Errorf("expected duplicate registration to fail")
	}

	// 3. Login
	loginReq := dto.LoginRequest{
		Username: "alice",
		Password: "password123",
	}

	tokens, err := authSvc.Login(loginReq)
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	if tokens.AccessToken == "" || tokens.RefreshToken == "" {
		t.Errorf("expected non-empty tokens, got: %+v", tokens)
	}

	// 4. Verify Access Token
	claims, err := authSvc.VerifyAccessToken(tokens.AccessToken)
	if err != nil {
		t.Fatalf("token verification failed: %v", err)
	}
	if claims.Username != "alice" || claims.Role != "user" {
		t.Errorf("unexpected claims: %+v", claims)
	}

	// 5. Refresh Token
	newTokens, err := authSvc.RefreshToken(tokens.RefreshToken)
	if err != nil {
		t.Fatalf("refresh failed: %v", err)
	}
	if newTokens.AccessToken == "" || newTokens.RefreshToken == "" {
		t.Errorf("expected valid new tokens on refresh")
	}

	// 6. Refresh again with old rotated token - should fail!
	_, err = authSvc.RefreshToken(tokens.RefreshToken)
	if err == nil {
		t.Errorf("expected old rotated refresh token to be invalid")
	}

	// 7. Logout and revoke new refresh token
	err = authSvc.Logout(newTokens.RefreshToken)
	if err != nil {
		t.Fatalf("logout failed: %v", err)
	}

	// Verify the revoked refresh token fails
	_, err = authSvc.RefreshToken(newTokens.RefreshToken)
	if err == nil {
		t.Errorf("expected revoked refresh token to be invalid")
	}
}
