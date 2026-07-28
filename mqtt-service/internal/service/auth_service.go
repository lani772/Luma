package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"mqtt-service/internal/config"
	"mqtt-service/internal/dto"
	"mqtt-service/internal/models"
	"mqtt-service/internal/repository"
	"mqtt-service/pkg/crypto"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrUserExists       = errors.New("username or email already registered")
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrInvalidToken     = errors.New("invalid or expired token")
)

type JWTClaims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type AuthService struct {
	userRepo repository.UserRepository
	cfg      config.ServerConfig
	redis    repository.RedisClient
}

func NewAuthService(userRepo repository.UserRepository, cfg config.ServerConfig, redis repository.RedisClient) *AuthService {
	return &AuthService{
		userRepo: userRepo,
		cfg:      cfg,
		redis:    redis,
	}
}

func (s *AuthService) Register(req dto.RegisterRequest) (*dto.UserResponse, error) {
	// Check if user already exists by username or email
	existingUser, err := s.userRepo.FindByUsername(req.Username)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, ErrUserExists
	}

	existingEmail, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		return nil, err
	}
	if existingEmail != nil {
		return nil, ErrUserExists
	}

	hash, err := crypto.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	role := "user"
	if req.Role != "" {
		role = req.Role
	}

	user := &models.User{
		ID:           uuid.New(),
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         role,
	}

	err = s.userRepo.Create(user)
	if err != nil {
		return nil, err
	}

	return &dto.UserResponse{
		ID:        user.ID.String(),
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}, nil
}

func (s *AuthService) Login(req dto.LoginRequest) (*dto.TokenResponse, error) {
	user, err := s.userRepo.FindByUsername(req.Username)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	if !crypto.CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	return s.generateTokenPair(user)
}

func (s *AuthService) RefreshToken(refreshToken string) (*dto.TokenResponse, error) {
	// Parse/validate refresh token
	claims, err := s.verifyToken(refreshToken, s.cfg.JWTRefreshSecret)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Check if this refresh token was blacklisted/revoked in Redis
	key := "revoked_token:" + hashString(refreshToken)
	isRevoked, _ := s.redis.GetDevicePresence(key) // reuse GetDevicePresence for key check
	if isRevoked {
		return nil, ErrInvalidToken
	}

	// Revoke the old refresh token (refresh token rotation!)
	_ = s.redis.SetDevicePresence(key, true, s.cfg.JWTRefreshTTL)

	// Fetch user
	uid, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, ErrInvalidToken
	}
	user, err := s.userRepo.FindByID(uid)
	if err != nil || user == nil {
		return nil, ErrInvalidToken
	}

	// Generate new pair
	return s.generateTokenPair(user)
}

func (s *AuthService) Logout(refreshToken string) error {
	// Revoke the refresh token immediately
	key := "revoked_token:" + hashString(refreshToken)
	return s.redis.SetDevicePresence(key, true, s.cfg.JWTRefreshTTL)
}

func (s *AuthService) generateTokenPair(user *models.User) (*dto.TokenResponse, error) {
	now := time.Now()
	accessExpiresAt := now.Add(s.cfg.JWTAccessTTL)
	refreshExpiresAt := now.Add(s.cfg.JWTRefreshTTL)

	// Access Token
	accessClaims := &JWTClaims{
		UserID:   user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "luma-mqtt-service",
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenStr, err := accessToken.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh Token
	refreshClaims := &JWTClaims{
		UserID:   user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExpiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "luma-mqtt-service",
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenStr, err := refreshToken.SignedString([]byte(s.cfg.JWTRefreshSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &dto.TokenResponse{
		AccessToken:  accessTokenStr,
		RefreshToken: refreshTokenStr,
		ExpiresAt:    accessExpiresAt,
	}, nil
}

func (s *AuthService) verifyToken(tokenStr, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid claims or token")
	}

	return claims, nil
}

func (s *AuthService) VerifyAccessToken(tokenStr string) (*JWTClaims, error) {
	return s.verifyToken(tokenStr, s.cfg.JWTSecret)
}

func hashString(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
