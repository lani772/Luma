package tests

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/luma-smart-home/authentication-service/internal/audit"
	"github.com/luma-smart-home/authentication-service/internal/auth"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"github.com/luma-smart-home/authentication-service/internal/email"
	"github.com/luma-smart-home/authentication-service/internal/events"
	"github.com/luma-smart-home/authentication-service/internal/jwt"
	"github.com/luma-smart-home/authentication-service/internal/passwords"
	"github.com/luma-smart-home/authentication-service/internal/repositories"
	"github.com/luma-smart-home/authentication-service/internal/security"
	"go.uber.org/zap"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite db: %v", err)
	}

	err = db.AutoMigrate(
		&database.User{},
		&database.Credential{},
		&database.Session{},
		&database.RefreshToken{},
		&database.EmailVerification{},
		&database.PasswordResetToken{},
		&database.OAuthAccount{},
		&database.ServiceAccount{},
		&database.AuditLog{},
		&database.LoginAttempt{},
	)
	if err != nil {
		t.Fatalf("failed to migrate schema: %v", err)
	}

	return db
}

func TestArgon2idPasswordHashing(t *testing.T) {
	password := "SecretLumaPassword123!"

	hash, err := passwords.HashPassword(password, nil)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	if hash == "" {
		t.Fatal("expected non-empty hash string")
	}

	match, err := passwords.VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("failed to verify password: %v", err)
	}
	if !match {
		t.Fatal("expected password to match its hash")
	}

	// Verify incorrect password doesn't match
	match2, err := passwords.VerifyPassword("wrongPassword", hash)
	if err != nil {
		t.Fatalf("failed to verify password: %v", err)
	}
	if match2 {
		t.Fatal("expected incorrect password to not match")
	}
}

func TestJWTEdDSASignAndVerify(t *testing.T) {
	logger := zap.NewNop()
	tokenManager, err := jwt.NewTokenManager("EdDSA", "luma-issuer", 15*time.Minute, 720*time.Hour, "", "", logger)
	if err != nil {
		t.Fatalf("failed to initialize token manager: %v", err)
	}

	userID := uuid.New().String()
	sessionID := uuid.New().String()

	tokenStr, expiresAt, err := tokenManager.GenerateUserAccessToken(userID, sessionID)
	if err != nil {
		t.Fatalf("failed to generate access token: %v", err)
	}

	if tokenStr == "" {
		t.Fatal("expected non-empty token string")
	}
	if expiresAt.Before(time.Now()) {
		t.Fatal("expected token expiration time in the future")
	}

	claims, err := tokenManager.VerifyUserAccessToken(tokenStr)
	if err != nil {
		t.Fatalf("failed to verify access token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected userID %s, got %s", userID, claims.UserID)
	}
	if claims.SessionID != sessionID {
		t.Errorf("expected sessionID %s, got %s", sessionID, claims.SessionID)
	}
}

func TestRegistrationAndVerificationFlow_OR_Policy(t *testing.T) {
	db := setupTestDB(t)
	logger := zap.NewNop()

	userRepo := repositories.NewGORMUserRepository(db)
	sessionRepo := repositories.NewGORMSessionRepository(db)
	refreshRepo := repositories.NewGORMRefreshTokenRepository(db)
	emailVerifyRepo := repositories.NewGORMEmailVerificationRepository(db)
	resetRepo := repositories.NewGORMPasswordResetTokenRepository(db)
	oauthRepo := repositories.NewGORMOOAuthAccountRepository(db)
	serviceRepo := repositories.NewGORMServiceAccountRepository(db)

	tokenManager, _ := jwt.NewTokenManager("EdDSA", "test-issuer", 15*time.Minute, 720*time.Hour, "", "", logger)
	emailProv := email.NewMockProvider()
	publisher := events.NewMemoryPublisher()
	auditLogger := audit.NewAuditLogger(db, logger)
	lockout := security.NewLockoutTracker(db, 3, 5*time.Minute)
	risk := security.NewRiskAnalyzer(db)
	blacklist := security.NewInMemoryBlacklist(logger)

	service := auth.NewService(
		userRepo, sessionRepo, refreshRepo, emailVerifyRepo, resetRepo, oauthRepo, serviceRepo,
		tokenManager, emailProv, publisher, auditLogger, lockout, risk, blacklist,
		"OR", 15*time.Minute, 5*time.Minute, 3,
	)

	// 1. Register User
	emailAddr := "john@luma.com"
	user, err := service.Register(context.Background(), emailAddr, "lumaPassword123!", "john_luma", "+15555555", "127.0.0.1", "Chrome")
	if err != nil {
		t.Fatalf("failed to register user: %v", err)
	}

	if user.EmailVerified {
		t.Fatal("expected email_verified to be false upon registration")
	}

	if len(emailProv.SentEmails) != 1 {
		t.Fatalf("expected 1 email to be sent, got %d", len(emailProv.SentEmails))
	}

	// 2. Query verify record to retrieve simulated OTP and Link Token
	verifyRec, err := emailVerifyRepo.GetByUserID(user.ID)
	if err != nil {
		t.Fatalf("failed to find email verification record: %v", err)
	}

	// Since they are stored hashed, we simulate the OTP and Magic Link check via our mocking
	// Let's manually mark magic link verified to test the OR policy evaluation
	verifyRec.MagicLinkVerified = true
	_ = emailVerifyRepo.Save(verifyRec)

	verified, err := service.VerifyEmail(context.Background(), user.ID, "", "", "127.0.0.1", "Chrome")
	if err != nil {
		t.Fatalf("failed to evaluate email verification: %v", err)
	}

	if !verified {
		t.Fatal("expected email verification to succeed on OR policy when magic link is verified")
	}

	// Fetch updated user to check verification flag
	updatedUser, _ := userRepo.GetByID(user.ID)
	if !updatedUser.EmailVerified {
		t.Fatal("expected user email_verified flag to be true in the database")
	}
}

func TestRegistrationAndVerificationFlow_AND_Policy(t *testing.T) {
	db := setupTestDB(t)
	logger := zap.NewNop()

	userRepo := repositories.NewGORMUserRepository(db)
	sessionRepo := repositories.NewGORMSessionRepository(db)
	refreshRepo := repositories.NewGORMRefreshTokenRepository(db)
	emailVerifyRepo := repositories.NewGORMEmailVerificationRepository(db)
	resetRepo := repositories.NewGORMPasswordResetTokenRepository(db)
	oauthRepo := repositories.NewGORMOOAuthAccountRepository(db)
	serviceRepo := repositories.NewGORMServiceAccountRepository(db)

	tokenManager, _ := jwt.NewTokenManager("EdDSA", "test-issuer", 15*time.Minute, 720*time.Hour, "", "", logger)
	emailProv := email.NewMockProvider()
	publisher := events.NewMemoryPublisher()
	auditLogger := audit.NewAuditLogger(db, logger)
	lockout := security.NewLockoutTracker(db, 3, 5*time.Minute)
	risk := security.NewRiskAnalyzer(db)
	blacklist := security.NewInMemoryBlacklist(logger)

	service := auth.NewService(
		userRepo, sessionRepo, refreshRepo, emailVerifyRepo, resetRepo, oauthRepo, serviceRepo,
		tokenManager, emailProv, publisher, auditLogger, lockout, risk, blacklist,
		"AND", 15*time.Minute, 5*time.Minute, 3,
	)

	// Register User
	emailAddr := "sandra@luma.com"
	user, _ := service.Register(context.Background(), emailAddr, "lumaPassword123!", "sandra_luma", "", "127.0.0.1", "Chrome")

	// Verify only magic link
	verifyRec, _ := emailVerifyRepo.GetByUserID(user.ID)
	verifyRec.MagicLinkVerified = true
	_ = emailVerifyRepo.Save(verifyRec)

	// Evaluate: should fail because OTP is not verified yet
	verified, _ := service.VerifyEmail(context.Background(), user.ID, "", "", "127.0.0.1", "Chrome")
	if verified {
		t.Fatal("expected AND policy to fail when only magic link is verified")
	}

	// Verify OTP as well
	verifyRec, _ = emailVerifyRepo.GetByUserID(user.ID)
	verifyRec.OTPVerified = true
	_ = emailVerifyRepo.Save(verifyRec)

	// Evaluate: should now succeed!
	verified, _ = service.VerifyEmail(context.Background(), user.ID, "", "", "127.0.0.1", "Chrome")
	if !verified {
		t.Fatal("expected AND policy to succeed when both magic link and OTP are verified")
	}
}

func TestBruteForceLockout(t *testing.T) {
	db := setupTestDB(t)
	lockout := security.NewLockoutTracker(db, 3, 5*time.Minute)

	key := "target_user@luma.com"

	// Record 1st failed attempt
	attempts, lockedUntil, err := lockout.RecordFailure(key)
	if err != nil {
		t.Fatalf("failed to record failure: %v", err)
	}
	if attempts != 1 || lockedUntil != nil {
		t.Fatalf("expected attempts=1, lockedUntil=nil; got %d, %v", attempts, lockedUntil)
	}

	// Check if locked
	isLocked, _, _ := lockout.IsLocked(key)
	if isLocked {
		t.Fatal("expected key to not be locked yet")
	}

	// Record 2nd failed attempt
	_, _, _ = lockout.RecordFailure(key)

	// Record 3rd failed attempt -> Should trigger lockout
	attempts, lockedUntil, err = lockout.RecordFailure(key)
	if attempts != 3 || lockedUntil == nil {
		t.Fatalf("expected attempts=3, lockedUntil!=nil on third failure; got %d, %v", attempts, lockedUntil)
	}

	// Check if locked
	isLocked, until, _ := lockout.IsLocked(key)
	if !isLocked || until == nil {
		t.Fatal("expected key to be locked after 3 failures")
	}
	if until.Before(time.Now()) {
		t.Fatal("expected lock time to be in the future")
	}

	// Reset lockout tracker
	_ = lockout.Reset(key)

	// Check if unlocked
	isLocked, _, _ = lockout.IsLocked(key)
	if isLocked {
		t.Fatal("expected key to be unlocked after reset")
	}
}
