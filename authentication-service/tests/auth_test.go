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
	passwordMgr := passwords.NewPasswordManager(db)

	service := auth.NewService(
		userRepo, sessionRepo, refreshRepo, emailVerifyRepo, resetRepo, oauthRepo, serviceRepo,
		tokenManager, emailProv, publisher, auditLogger, lockout, risk, blacklist, passwordMgr,
		"OR", 15*time.Minute, 5*time.Minute, 3,
	)

	// 1. Register User with a strong password
	emailAddr := "john@luma.com"
	user, err := service.Register(context.Background(), emailAddr, "LumaPassword123!", "john_luma", "+15555555", "127.0.0.1", "Chrome")
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

	verifyRec.MagicLinkVerified = true
	_ = emailVerifyRepo.Save(verifyRec)

	verified, err := service.VerifyEmail(context.Background(), user.ID, "", "", "127.0.0.1", "Chrome")
	if err != nil {
		t.Fatalf("failed to evaluate email verification: %v", err)
	}

	if !verified {
		t.Fatal("expected email verification to succeed on OR policy when magic link is verified")
	}

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
	passwordMgr := passwords.NewPasswordManager(db)

	service := auth.NewService(
		userRepo, sessionRepo, refreshRepo, emailVerifyRepo, resetRepo, oauthRepo, serviceRepo,
		tokenManager, emailProv, publisher, auditLogger, lockout, risk, blacklist, passwordMgr,
		"AND", 15*time.Minute, 5*time.Minute, 3,
	)

	// Register User
	emailAddr := "sandra@luma.com"
	user, _ := service.Register(context.Background(), emailAddr, "LumaPassword123!", "sandra_luma", "", "127.0.0.1", "Chrome")

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

	attempts, lockedUntil, err := lockout.RecordFailure(key)
	if err != nil {
		t.Fatalf("failed to record failure: %v", err)
	}
	if attempts != 1 || lockedUntil != nil {
		t.Fatalf("expected attempts=1, lockedUntil=nil; got %d, %v", attempts, lockedUntil)
	}

	isLocked, _, _ := lockout.IsLocked(key)
	if isLocked {
		t.Fatal("expected key to not be locked yet")
	}

	_, _, _ = lockout.RecordFailure(key)

	attempts, lockedUntil, err = lockout.RecordFailure(key)
	if attempts != 3 || lockedUntil == nil {
		t.Fatalf("expected attempts=3, lockedUntil!=nil on third failure; got %d, %v", attempts, lockedUntil)
	}

	isLocked, until, _ := lockout.IsLocked(key)
	if !isLocked || until == nil {
		t.Fatal("expected key to be locked after 3 failures")
	}
	if until.Before(time.Now()) {
		t.Fatal("expected lock time to be in the future")
	}

	_ = lockout.Reset(key)

	isLocked, _, _ = lockout.IsLocked(key)
	if isLocked {
		t.Fatal("expected key to be unlocked after reset")
	}
}

func TestPasswordHistoryAndStrength(t *testing.T) {
	db := setupTestDB(t)
	pm := passwords.NewPasswordManager(db)

	userID := uuid.New()

	// 1. Weak password must fail validation
	err := pm.ValidateStrength("weak")
	if err == nil {
		t.Fatal("expected weak password to fail validation")
	}

	// 2. Strong password must succeed
	strongPass := "StrongP@ss1"
	err = pm.ValidateStrength(strongPass)
	if err != nil {
		t.Fatalf("expected strong password to pass validation: %v", err)
	}

	// 3. Initial recording
	err = pm.RecordAndVerifyHistory(userID, strongPass)
	if err != nil {
		t.Fatalf("failed to record initial password history: %v", err)
	}

	// 4. Attempting to reuse the exact same password must fail history check
	err = pm.RecordAndVerifyHistory(userID, strongPass)
	if err == nil {
		t.Fatal("expected password history check to fail when reusing current password")
	}

	// 5. Change to a second and third strong password
	err = pm.RecordAndVerifyHistory(userID, "SecondP@ss2")
	if err != nil {
		t.Fatalf("failed to change password: %v", err)
	}
	err = pm.RecordAndVerifyHistory(userID, "ThirdP@ss3")
	if err != nil {
		t.Fatalf("failed to change password: %v", err)
	}

	// 6. Attempting to reuse the original "StrongP@ss1" must still fail because it is within the last 3 passwords
	err = pm.RecordAndVerifyHistory(userID, strongPass)
	if err == nil {
		t.Fatal("expected password history check to fail when reusing one of the last 3 passwords")
	}

	// 7. Change to a fourth password, moving "StrongP@ss1" out of the last 3 entries
	err = pm.RecordAndVerifyHistory(userID, "FourthP@ss4")
	if err != nil {
		t.Fatalf("failed to change password: %v", err)
	}

	// 8. Reusing the original "StrongP@ss1" must now succeed because it has rolled out of the history ledger of length 3!
	err = pm.RecordAndVerifyHistory(userID, strongPass)
	if err != nil {
		t.Fatalf("expected password change to succeed after rolling out of the 3 entries ledger: %v", err)
	}
}

func TestCryptographicKeyRotation(t *testing.T) {
	logger := zap.NewNop()
	tokenManager, err := jwt.NewTokenManager("EdDSA", "luma-issuer", 15*time.Minute, 720*time.Hour, "", "", logger)
	if err != nil {
		t.Fatalf("failed to initialize token manager: %v", err)
	}

	userID := "rotated-user-123"
	sessionID := "rotated-session-123"

	// 1. Generate token with active key pair #1
	token1, _, err := tokenManager.GenerateUserAccessToken(userID, sessionID)
	if err != nil {
		t.Fatalf("failed to generate token 1: %v", err)
	}

	// 2. Verify token 1 immediately using active key pair #1 -> Should succeed
	claims, err := tokenManager.VerifyUserAccessToken(token1)
	if err != nil {
		t.Fatalf("failed to verify token 1 before rotation: %v", err)
	}
	if claims.UserID != userID {
		t.Errorf("expected userID %s, got %s", userID, claims.UserID)
	}

	// 3. Rotate cryptographic signature keys!
	err = tokenManager.RotateKeys()
	if err != nil {
		t.Fatalf("failed to rotate keys: %v", err)
	}

	// 4. Verify token 1 AFTER rotation -> Should still succeed using the fallback slot!
	claimsAfterRotation, err := tokenManager.VerifyUserAccessToken(token1)
	if err != nil {
		t.Fatalf("failed to verify token 1 after rotation using fallback: %v", err)
	}
	if claimsAfterRotation.UserID != userID {
		t.Errorf("expected userID %s, got %s", userID, claimsAfterRotation.UserID)
	}

	// 5. Generate token 2 with the NEW active key pair #2
	token2, _, err := tokenManager.GenerateUserAccessToken(userID, sessionID)
	if err != nil {
		t.Fatalf("failed to generate token 2: %v", err)
	}

	// 6. Verify token 2 using the active key pair #2 -> Should succeed
	claims2, err := tokenManager.VerifyUserAccessToken(token2)
	if err != nil {
		t.Fatalf("failed to verify token 2: %v", err)
	}
	if claims2.UserID != userID {
		t.Errorf("expected userID %s, got %s", userID, claims2.UserID)
	}
}

func TestNumericalThreatScoreRiskAnalysis(t *testing.T) {
	db := setupTestDB(t)
	analyzer := security.NewRiskAnalyzer(db)

	userID := uuid.New()

	// 1. Initial Assessment (No previous sessions) -> Low Risk (Score: 10)
	assessment, err := analyzer.AssessRisk(context.Background(), userID, "127.0.0.1", "Mozilla", "device-1")
	if err != nil {
		t.Fatalf("failed to assess risk: %v", err)
	}
	if assessment.Level != security.RiskLevelLow || assessment.ThreatScore != 10 {
		t.Errorf("expected Low Risk (10), got %s (%d)", assessment.Level, assessment.ThreatScore)
	}

	// Create a session for this user representing a known device and network
	sess := database.Session{
		ID:           uuid.New(),
		UserID:       userID,
		DeviceID:     "device-1",
		IPAddress:    "127.0.0.1",
		Browser:      "Mozilla",
		Status:       database.SessionStatusActive,
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
		ExpiresAt:    time.Now().Add(time.Hour),
	}
	_ = db.Create(&sess).Error

	// 2. Recognized Device and Recognized IP -> Low Risk (Score: 0)
	assessment, err = analyzer.AssessRisk(context.Background(), userID, "127.0.0.1", "Mozilla", "device-1")
	if err != nil {
		t.Fatalf("failed to assess risk: %v", err)
	}
	if assessment.Level != security.RiskLevelLow || assessment.ThreatScore != 0 || assessment.StepUpRequired {
		t.Errorf("expected Low Risk (0) without step-up, got %s (%d), step-up=%t", assessment.Level, assessment.ThreatScore, assessment.StepUpRequired)
	}

	// 3. New Device and New IP -> High Risk (Score: 75: 40 points new device + 35 points new network)
	assessment, err = analyzer.AssessRisk(context.Background(), userID, "192.168.1.100", "Mozilla", "device-2")
	if err != nil {
		t.Fatalf("failed to assess risk: %v", err)
	}
	if assessment.Level != security.RiskLevelHigh || assessment.ThreatScore != 75 || !assessment.StepUpRequired {
		t.Errorf("expected High Risk (75) with step-up required, got %s (%d), step-up=%t", assessment.Level, assessment.ThreatScore, assessment.StepUpRequired)
	}
}
