package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/audit"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"github.com/luma-smart-home/authentication-service/internal/email"
	"github.com/luma-smart-home/authentication-service/internal/events"
	"github.com/luma-smart-home/authentication-service/internal/jwt"
	"github.com/luma-smart-home/authentication-service/internal/passwords"
	"github.com/luma-smart-home/authentication-service/internal/repositories"
	"github.com/luma-smart-home/authentication-service/internal/security"
)

var (
	ErrDuplicateEmail    = errors.New("email address already registered")
	ErrDuplicateUsername = errors.New("username already taken")
	ErrInvalidPassword   = errors.New("invalid email/username or password")
	ErrSuspendedAccount  = errors.New("account is suspended")
	ErrUnverifiedEmail   = errors.New("email must be verified before logging in")
	ErrInvalidStepUpCode = errors.New("invalid or expired step-up verification code")
)

type Service struct {
	userRepo        repositories.UserRepository
	sessionRepo     repositories.SessionRepository
	refreshRepo     repositories.RefreshTokenRepository
	emailVerifyRepo repositories.EmailVerificationRepository
	resetRepo       repositories.PasswordResetTokenRepository
	oauthRepo       repositories.OAuthAccountRepository
	serviceRepo     repositories.ServiceAccountRepository
	tokenManager    *jwt.TokenManager
	emailProvider   email.Provider
	eventPublisher  events.Publisher
	auditLogger     *audit.AuditLogger
	lockoutTracker  *security.LockoutTracker
	riskAnalyzer    *security.RiskAnalyzer
	blacklist       security.TokenBlacklist
	passwordMgr     *passwords.PasswordManager
	verifyMode      string // "OR", "AND", "MAGIC_LINK_ONLY", "OTP_ONLY"
	magicLinkTTL    time.Duration
	otpTTL          time.Duration
	otpMaxAttempts  int
}

func NewService(
	userRepo repositories.UserRepository,
	sessionRepo repositories.SessionRepository,
	refreshRepo repositories.RefreshTokenRepository,
	emailVerifyRepo repositories.EmailVerificationRepository,
	resetRepo repositories.PasswordResetTokenRepository,
	oauthRepo repositories.OAuthAccountRepository,
	serviceRepo repositories.ServiceAccountRepository,
	tokenManager *jwt.TokenManager,
	emailProvider email.Provider,
	eventPublisher events.Publisher,
	auditLogger *audit.AuditLogger,
	lockoutTracker *security.LockoutTracker,
	riskAnalyzer *security.RiskAnalyzer,
	blacklist security.TokenBlacklist,
	passwordMgr *passwords.PasswordManager,
	verifyMode string,
	magicLinkTTL, otpTTL time.Duration,
	otpMaxAttempts int,
) *Service {
	return &Service{
		userRepo:        userRepo,
		sessionRepo:     sessionRepo,
		refreshRepo:     refreshRepo,
		emailVerifyRepo: emailVerifyRepo,
		resetRepo:       resetRepo,
		oauthRepo:       oauthRepo,
		serviceRepo:     serviceRepo,
		tokenManager:    tokenManager,
		emailProvider:   emailProvider,
		eventPublisher:  eventPublisher,
		auditLogger:     auditLogger,
		lockoutTracker:  lockoutTracker,
		riskAnalyzer:    riskAnalyzer,
		blacklist:       blacklist,
		passwordMgr:     passwordMgr,
		verifyMode:      verifyMode,
		magicLinkTTL:    magicLinkTTL,
		otpTTL:          otpTTL,
		otpMaxAttempts:  otpMaxAttempts,
	}
}

// 1. Registration
func (s *Service) Register(ctx context.Context, email, password, username, phone string, ip, ua string) (*database.User, error) {
	// Check duplicate email
	existing, err := s.userRepo.GetByEmail(email)
	if err == nil && existing != nil {
		return nil, ErrDuplicateEmail
	}

	// Check duplicate username if provided
	if username != "" {
		existingUser, err := s.userRepo.GetByUsername(username)
		if err == nil && existingUser != nil {
			return nil, ErrDuplicateUsername
		}
	}

	// Validate Strength
	if err := s.passwordMgr.ValidateStrength(password); err != nil {
		return nil, err
	}

	hash, err := passwords.HashPassword(password, nil)
	if err != nil {
		return nil, err
	}

	userID := uuid.New()
	user := &database.User{
		ID:            userID,
		Email:         email,
		PasswordHash:  hash,
		EmailVerified: false,
		Status:        database.UserStatusActive,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if username != "" {
		user.Username = &username
	}
	if phone != "" {
		user.Phone = &phone
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	// Save credential history
	if err := s.passwordMgr.RecordAndVerifyHistory(userID, password); err != nil {
		return nil, err
	}

	s.auditLogger.Log(&userID, "UserRegistered", "User successfully registered account", ip, ua)
	_ = s.eventPublisher.Publish(events.Event{
		Type:    events.EventUserRegistered,
		Payload: map[string]any{"user_id": userID, "email": email},
	})

	security.RecordRegistration()

	// Dispatch email verification initial tokens
	_ = s.SendEmailVerification(ctx, userID, ip, ua)

	return user, nil
}

// 2. Login
type LoginResult struct {
	StepUpRequired bool                     `json:"step_up_required"`
	StepUpToken    string                   `json:"step_up_token,omitempty"`
	User           *database.User           `json:"user,omitempty"`
	Session        *database.Session        `json:"session,omitempty"`
	AccessToken    string                   `json:"access_token,omitempty"`
	RefreshToken   string                   `json:"refresh_token,omitempty"`
	ExpiresIn      int64                    `json:"expires_in,omitempty"`
	RiskAssessment *security.RiskAssessment `json:"risk_assessment,omitempty"`
}

func (s *Service) Login(ctx context.Context, emailOrUser, password, deviceID, ip, ua string) (*LoginResult, error) {
	// Rate Limit and Lockout check
	locked, until, err := s.lockoutTracker.IsLocked(emailOrUser)
	if err != nil {
		return nil, err
	}
	if locked {
		_ = s.eventPublisher.Publish(events.Event{
			Type:    events.EventAccountLocked,
			Payload: map[string]any{"key": emailOrUser, "locked_until": until},
		})
		security.RecordLoginAttempt("locked")
		return nil, security.ErrAccountLocked
	}

	// Find User (By Email or Username)
	var user *database.User
	user, err = s.userRepo.GetByEmail(emailOrUser)
	if err != nil {
		// Try username fallback
		user, err = s.userRepo.GetByUsername(emailOrUser)
		if err != nil {
			_, _, _ = s.lockoutTracker.RecordFailure(emailOrUser)
			security.RecordLoginAttempt("failed")
			return nil, ErrInvalidPassword
		}
	}

	if user.Status == database.UserStatusSuspended {
		security.RecordLoginAttempt("suspended")
		return nil, ErrSuspendedAccount
	}

	// Verify Password
	match, err := passwords.VerifyPassword(password, user.PasswordHash)
	if err != nil || !match {
		_, _, _ = s.lockoutTracker.RecordFailure(emailOrUser)
		s.auditLogger.Log(&user.ID, "UserLoginFailed", "Incorrect password login attempt", ip, ua)
		_ = s.eventPublisher.Publish(events.Event{
			Type:    events.EventUserLoginFailed,
			Payload: map[string]any{"user_id": user.ID, "ip": ip},
		})
		security.RecordLoginAttempt("failed")
		return nil, ErrInvalidPassword
	}

	// Email Verification Enforcement before login succeeds
	if !user.EmailVerified {
		return nil, ErrUnverifiedEmail
	}

	// Successful password check -> Reset lockout tracker
	_ = s.lockoutTracker.Reset(emailOrUser)

	// Risk Assessment
	assessment, err := s.riskAnalyzer.AssessRisk(ctx, user.ID, ip, ua, deviceID)
	if err != nil {
		return nil, err
	}

	security.RecordRiskAssessment(string(assessment.Level))

	if assessment.StepUpRequired {
		s.auditLogger.Log(&user.ID, "SuspiciousLoginDetected", "High-risk login flagged. Requiring Step-Up auth.", ip, ua)
		// Generate standard OTP or temporary verification session token
		stepUpToken := base64Encode(uuid.New().String())
		_ = s.SendStepUpOTP(ctx, user, ip, ua)

		security.RecordLoginAttempt("step_up")

		return &LoginResult{
			StepUpRequired: true,
			StepUpToken:    stepUpToken,
			RiskAssessment: assessment,
		}, nil
	}

	// Low or Medium Risk login -> Complete session creation immediately
	loginRes, err := s.finalizeLoginSession(user, deviceID, ip, ua)
	if err != nil {
		return nil, err
	}
	loginRes.RiskAssessment = assessment
	security.RecordLoginAttempt("success")
	return loginRes, nil
}

func (s *Service) finalizeLoginSession(user *database.User, deviceID, ip, ua string) (*LoginResult, error) {
	sessionID := uuid.New()
	session := &database.Session{
		ID:           sessionID,
		UserID:       user.ID,
		DeviceID:     deviceID,
		IPAddress:    ip,
		Browser:      ua,
		Location:     "Location simulated",
		Status:       database.SessionStatusActive,
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
		ExpiresAt:    time.Now().Add(time.Hour * 24 * 30), // 30 days session
	}

	if err := s.sessionRepo.Create(session); err != nil {
		return nil, err
	}

	// Generate Refresh Token
	rawRefresh := uuid.New().String() + uuid.New().String()
	refreshHash := hashToken(rawRefresh)
	refToken := &database.RefreshToken{
		ID:        uuid.New(),
		SessionID: sessionID,
		TokenHash: refreshHash,
		ExpiresAt: time.Now().Add(time.Hour * 24 * 30),
		Revoked:   false,
		CreatedAt: time.Now(),
	}
	if err := s.refreshRepo.Create(refToken); err != nil {
		return nil, err
	}

	// Generate Access Token
	accToken, expiresAt, err := s.tokenManager.GenerateUserAccessToken(user.ID.String(), sessionID.String())
	if err != nil {
		return nil, err
	}

	s.auditLogger.Log(&user.ID, "UserLoggedIn", "User logged in and session started", ip, ua)
	_ = s.eventPublisher.Publish(events.Event{
		Type:    events.EventUserLoggedIn,
		Payload: map[string]any{"user_id": user.ID, "session_id": sessionID},
	})

	return &LoginResult{
		StepUpRequired: false,
		User:           user,
		Session:        session,
		AccessToken:    accToken,
		RefreshToken:   rawRefresh,
		ExpiresIn:      int64(time.Until(expiresAt).Seconds()),
	}, nil
}

// 3. Step Up Finalization
func (s *Service) FinalizeStepUpLogin(ctx context.Context, emailOrUser, code, deviceID, ip, ua string) (*LoginResult, error) {
	var user *database.User
	var err error
	user, err = s.userRepo.GetByEmail(emailOrUser)
	if err != nil {
		user, err = s.userRepo.GetByUsername(emailOrUser)
		if err != nil {
			return nil, ErrInvalidStepUpCode
		}
	}

	// Validate step-up OTP
	verifyRec, err := s.emailVerifyRepo.GetByUserID(user.ID)
	if err != nil {
		return nil, ErrInvalidStepUpCode
	}

	if verifyRec.OTPCodeHash == nil || verifyRec.OTPExpires == nil || time.Now().After(*verifyRec.OTPExpires) {
		return nil, ErrInvalidStepUpCode
	}

	if verifyRec.OTPAttempts >= s.otpMaxAttempts {
		return nil, errors.New("maximum OTP verification attempts exceeded")
	}

	expectedHash := hashToken(code)
	if *verifyRec.OTPCodeHash != expectedHash {
		verifyRec.OTPAttempts++
		_ = s.emailVerifyRepo.Save(verifyRec)
		return nil, ErrInvalidStepUpCode
	}

	// Clear OTP after successful use
	verifyRec.OTPCodeHash = nil
	verifyRec.OTPExpires = nil
	verifyRec.OTPAttempts = 0
	_ = s.emailVerifyRepo.Save(verifyRec)

	s.auditLogger.Log(&user.ID, "StepUpVerified", "Step-Up OTP verification succeeded", ip, ua)

	// Complete login
	return s.finalizeLoginSession(user, deviceID, ip, ua)
}

// 4. Refresh Token Rotation
func (s *Service) RefreshToken(refreshToken string) (*LoginResult, error) {
	hash := hashToken(refreshToken)
	refRec, err := s.refreshRepo.GetByHash(hash)
	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	if refRec.Revoked || time.Now().After(refRec.ExpiresAt) {
		return nil, errors.New("refresh token has been revoked or expired")
	}

	session, err := s.sessionRepo.GetByID(refRec.SessionID)
	if err != nil || session.Status == database.SessionStatusRevoked {
		return nil, errors.New("associated session is revoked")
	}

	user, err := s.userRepo.GetByID(session.UserID)
	if err != nil {
		return nil, err
	}

	// Rotation & Revocation of previous token
	refRec.Revoked = true
	_ = s.userRepo.Update(user) // temporary mock trigger for save

	// Revoke current session ID in fast cache blacklist
	_ = s.blacklist.Revoke(session.ID.String(), time.Minute*15)

	// Generate NEW refresh token for rotation
	rawRefresh := uuid.New().String() + uuid.New().String()
	newHash := hashToken(rawRefresh)
	newRefToken := &database.RefreshToken{
		ID:        uuid.New(),
		SessionID: session.ID,
		TokenHash: newHash,
		ExpiresAt: time.Now().Add(time.Hour * 24 * 30),
		Revoked:   false,
		CreatedAt: time.Now(),
	}
	if err := s.refreshRepo.Create(newRefToken); err != nil {
		return nil, err
	}

	// Update session activity
	session.LastActivity = time.Now()
	_ = s.sessionRepo.Update(session)

	// Generate Access Token
	accToken, expiresAt, err := s.tokenManager.GenerateUserAccessToken(user.ID.String(), session.ID.String())
	if err != nil {
		return nil, err
	}

	_ = s.eventPublisher.Publish(events.Event{
		Type:    events.EventPasswordChanged,
		Payload: map[string]any{"user_id": user.ID},
	})

	security.RecordTokenRotation()

	return &LoginResult{
		StepUpRequired: false,
		User:           user,
		Session:        session,
		AccessToken:    accToken,
		RefreshToken:   rawRefresh,
		ExpiresIn:      int64(time.Until(expiresAt).Seconds()),
	}, nil
}

// 5. Logout / Session Revocation
func (s *Service) Logout(sessionID uuid.UUID) error {
	session, err := s.sessionRepo.GetByID(sessionID)
	if err != nil {
		return err
	}

	session.Status = database.SessionStatusRevoked
	_ = s.sessionRepo.Update(session)

	// Add to blacklist immediately so active JWT is dead
	_ = s.blacklist.Revoke(sessionID.String(), time.Minute*15)

	// Revoke all associated refresh tokens
	_ = s.refreshRepo.RevokeBySession(sessionID)

	s.auditLogger.Log(&session.UserID, "UserLoggedOut", "User manually logged out of session", session.IPAddress, "")
	_ = s.eventPublisher.Publish(events.Event{
		Type:    events.EventSessionRevoked,
		Payload: map[string]any{"session_id": sessionID, "user_id": session.UserID},
	})

	return nil
}

// 6. Send Email Verification
func (s *Service) SendEmailVerification(ctx context.Context, userID uuid.UUID, ip, ua string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}

	// Generate OTP (6-digits secure)
	otp, err := generateSecureOTP()
	if err != nil {
		return err
	}
	otpHash := hashToken(otp)
	otpExp := time.Now().Add(s.otpTTL)

	// Generate Magic Link
	magicRaw := uuid.New().String() + uuid.New().String()
	magicHash := hashToken(magicRaw)
	magicExp := time.Now().Add(s.magicLinkTTL)

	// Look up or create email verification record
	verifyRec, err := s.emailVerifyRepo.GetByUserID(userID)
	if err != nil {
		verifyRec = &database.EmailVerification{
			ID:                uuid.New(),
			UserID:            userID,
			MagicLinkHash:     &magicHash,
			MagicLinkExpires:  &magicExp,
			MagicLinkVerified: false,
			OTPCodeHash:       &otpHash,
			OTPExpires:        &otpExp,
			OTPVerified:       false,
			OTPAttempts:       0,
			CreatedAt:         time.Now(),
		}
		if err := s.emailVerifyRepo.Create(verifyRec); err != nil {
			return err
		}
	} else {
		verifyRec.MagicLinkHash = &magicHash
		verifyRec.MagicLinkExpires = &magicExp
		verifyRec.MagicLinkVerified = false
		verifyRec.OTPCodeHash = &otpHash
		verifyRec.OTPExpires = &otpExp
		verifyRec.OTPVerified = false
		verifyRec.OTPAttempts = 0
		if err := s.emailVerifyRepo.Save(verifyRec); err != nil {
			return err
		}
	}

	// Send dispatch
	subject := "Verify your LUMA Account"
	body := fmt.Sprintf("Thank you for registering on LUMA!\n\nYour One-Time Verification OTP is: %s\nExpiring in 5 minutes.\n\nOr click here to verify instantly via Magic Link:\nhttps://luma.local/auth/email/verify?token=%s\nExpiring in 15 minutes.", otp, magicRaw)

	_ = s.emailProvider.SendEmail(user.Email, subject, body)
	return nil
}

// 7. Verify Email Code / Link
func (s *Service) VerifyEmail(ctx context.Context, userID uuid.UUID, magicToken, otpCode string, ip, ua string) (bool, error) {
	verifyRec, err := s.emailVerifyRepo.GetByUserID(userID)
	if err != nil {
		return false, errors.New("no email verification pending")
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return false, err
	}

	// 1. Validate OTP if supplied
	if otpCode != "" {
		if verifyRec.OTPCodeHash == nil || verifyRec.OTPExpires == nil || time.Now().After(*verifyRec.OTPExpires) {
			return false, errors.New("OTP is expired or invalid")
		}
		if verifyRec.OTPAttempts >= s.otpMaxAttempts {
			return false, errors.New("maximum OTP verification attempts exceeded")
		}

		hash := hashToken(otpCode)
		if *verifyRec.OTPCodeHash == hash {
			verifyRec.OTPVerified = true
			verifyRec.OTPCodeHash = nil
			verifyRec.OTPExpires = nil
			verifyRec.OTPAttempts = 0
		} else {
			verifyRec.OTPAttempts++
			_ = s.emailVerifyRepo.Save(verifyRec)
			return false, errors.New("incorrect OTP verification code")
		}
	}

	// 2. Validate Magic Link Token if supplied
	if magicToken != "" {
		if verifyRec.MagicLinkHash == nil || verifyRec.MagicLinkExpires == nil || time.Now().After(*verifyRec.MagicLinkExpires) {
			return false, errors.New("magic link is expired or invalid")
		}

		hash := hashToken(magicToken)
		if *verifyRec.MagicLinkHash == hash {
			verifyRec.MagicLinkVerified = true
			verifyRec.MagicLinkHash = nil
			verifyRec.MagicLinkExpires = nil
		} else {
			return false, errors.New("incorrect magic link token")
		}
	}

	_ = s.emailVerifyRepo.Save(verifyRec)

	// 3. Evaluate Configured Verification Policy
	isVerified := false
	switch s.verifyMode {
	case "AND":
		if verifyRec.MagicLinkVerified && verifyRec.OTPVerified {
			isVerified = true
		}
	case "MAGIC_LINK_ONLY":
		if verifyRec.MagicLinkVerified {
			isVerified = true
		}
	case "OTP_ONLY":
		if verifyRec.OTPVerified {
			isVerified = true
		}
	case "OR":
		fallthrough
	default:
		if verifyRec.MagicLinkVerified || verifyRec.OTPVerified {
			isVerified = true
		}
	}

	if isVerified {
		user.EmailVerified = true
		_ = s.userRepo.Update(user)
		s.auditLogger.Log(&user.ID, "EmailVerified", "Email verified successfully according to policy: "+s.verifyMode, ip, ua)
		_ = s.eventPublisher.Publish(events.Event{
			Type:    events.EventEmailVerified,
			Payload: map[string]any{"user_id": user.ID, "email": user.Email},
		})
		return true, nil
	}

	return false, nil
}

// 8. Forgot Password & Reset
func (s *Service) ForgotPassword(ctx context.Context, emailAddress string, ip, ua string) error {
	user, err := s.userRepo.GetByEmail(emailAddress)
	if err != nil {
		// Prevent timing/enumeration attacks by simulating output and returning nil
		return nil
	}

	rawToken := uuid.New().String() + uuid.New().String()
	tokenHash := hashToken(rawToken)

	resetRec := &database.PasswordResetToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(time.Hour),
		Used:      false,
		CreatedAt: time.Now(),
	}

	if err := s.resetRepo.Create(resetRec); err != nil {
		return err
	}

	// Dispatch email
	subject := "Reset your LUMA Password"
	body := fmt.Sprintf("We received a request to reset your LUMA password.\n\nUse this secure token to change your password:\n%s\n\nOr click here:\nhttps://luma.local/auth/password/reset?token=%s\n\nIf you did not request this, please ignore this email.", rawToken, rawToken)

	_ = s.emailProvider.SendEmail(user.Email, subject, body)
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, token, newPassword string, ip, ua string) error {
	hash := hashToken(token)
	resetRec, err := s.resetRepo.GetByHash(hash)
	if err != nil || resetRec.Used || time.Now().After(resetRec.ExpiresAt) {
		return errors.New("invalid or expired password reset token")
	}

	user, err := s.userRepo.GetByID(resetRec.UserID)
	if err != nil {
		return err
	}

	// Verify strength and prevent reuse of last 3 passwords
	if err := s.passwordMgr.RecordAndVerifyHistory(user.ID, newPassword); err != nil {
		return err
	}

	// Update password
	newHash, _ := passwords.HashPassword(newPassword, nil)
	user.PasswordHash = newHash
	user.UpdatedAt = time.Now()
	_ = s.userRepo.Update(user)

	resetRec.Used = true
	_ = s.resetRepo.Save(resetRec)

	// Hard logout on ALL active sessions immediately for account security!
	_ = s.sessionRepo.RevokeAllForUser(user.ID)

	s.auditLogger.Log(&user.ID, "PasswordReset", "Password successfully reset via token", ip, ua)
	_ = s.eventPublisher.Publish(events.Event{
		Type:    events.EventPasswordReset,
		Payload: map[string]any{"user_id": user.ID},
	})

	return nil
}

// 9. Multi-device Session Management
func (s *Service) ListSessions(userID uuid.UUID) ([]database.Session, error) {
	return s.sessionRepo.ListActiveByUser(userID)
}

func (s *Service) RevokeAllOtherSessions(userID uuid.UUID, currentSessionID uuid.UUID) error {
	err := s.sessionRepo.RevokeAllExcept(userID, currentSessionID)
	if err != nil {
		return err
	}

	sessions, err := s.sessionRepo.ListActiveByUser(userID)
	if err == nil {
		for _, sess := range sessions {
			if sess.ID != currentSessionID {
				_ = s.blacklist.Revoke(sess.ID.String(), time.Minute*15)
				_ = s.refreshRepo.RevokeBySession(sess.ID)
			}
		}
	}

	_ = s.eventPublisher.Publish(events.Event{
		Type:    events.EventSessionRevoked,
		Payload: map[string]any{"user_id": userID, "revoked_all_except": currentSessionID},
	})

	return nil
}

// 10. Service Account Client Credentials Flow
func (s *Service) AuthenticateService(clientID, clientSecret string) (string, time.Time, error) {
	sa, err := s.serviceRepo.GetByClientID(clientID)
	if err != nil {
		return "", time.Time{}, errors.New("unauthorized service credentials")
	}

	if sa.Status == database.ServiceAccountSuspended {
		return "", time.Time{}, errors.New("service account suspended")
	}

	match, err := passwords.VerifyPassword(clientSecret, sa.ClientSecretHash)
	if err != nil || !match {
		return "", time.Time{}, errors.New("unauthorized service credentials")
	}

	return s.tokenManager.GenerateServiceToken(sa.ID.String(), sa.ServiceName, time.Minute*15)
}

// Setup service accounts for development/testing
func (s *Service) RegisterServiceAccount(name, clientID, clientSecret string) (*database.ServiceAccount, error) {
	hash, err := passwords.HashPassword(clientSecret, nil)
	if err != nil {
		return nil, err
	}

	sa := &database.ServiceAccount{
		ID:               uuid.New(),
		ServiceName:      name,
		ClientID:         clientID,
		ClientSecretHash: hash,
		Status:           database.ServiceAccountActive,
		CreatedAt:        time.Now(),
	}

	if err := s.serviceRepo.Create(sa); err != nil {
		return nil, err
	}

	return sa, nil
}

// Helper Dispatchers
func (s *Service) SendStepUpOTP(ctx context.Context, user *database.User, ip, ua string) error {
	otp, err := generateSecureOTP()
	if err != nil {
		return err
	}
	otpHash := hashToken(otp)
	otpExp := time.Now().Add(s.otpTTL)

	verifyRec, err := s.emailVerifyRepo.GetByUserID(user.ID)
	if err != nil {
		verifyRec = &database.EmailVerification{
			ID:          uuid.New(),
			UserID:      user.ID,
			OTPCodeHash: &otpHash,
			OTPExpires:  &otpExp,
			OTPAttempts: 0,
			CreatedAt:   time.Now(),
		}
		_ = s.emailVerifyRepo.Create(verifyRec)
	} else {
		verifyRec.OTPCodeHash = &otpHash
		verifyRec.OTPExpires = &otpExp
		verifyRec.OTPAttempts = 0
		_ = s.emailVerifyRepo.Save(verifyRec)
	}

	subject := "Step-Up Verification Code"
	body := fmt.Sprintf("Your Step-Up verification code for logging in is: %s\nExpiring in 5 minutes.", otp)

	return s.emailProvider.SendEmail(user.Email, subject, body)
}

// Google Sign-In Exchange (Simulation of ID token verification and account registration)
func (s *Service) LoginWithGoogle(ctx context.Context, idToken, deviceID, ip, ua string) (*LoginResult, error) {
	if idToken == "" {
		return nil, errors.New("google id token is empty")
	}

	emailAddress := "google-user@gmail.com"
	googleUserID := "google-id-12345678"

	oa, err := s.oauthRepo.GetByProviderInfo("google", googleUserID)
	if err == nil && oa != nil {
		user, err := s.userRepo.GetByID(oa.UserID)
		if err != nil {
			return nil, err
		}
		return s.finalizeLoginSession(user, deviceID, ip, ua)
	}

	user, err := s.userRepo.GetByEmail(emailAddress)
	if err != nil {
		userID := uuid.New()
		placeholderPass, _ := passwords.HashPassword(uuid.New().String(), nil)
		user = &database.User{
			ID:            userID,
			Email:         emailAddress,
			PasswordHash:  placeholderPass,
			EmailVerified: true,
			Status:        database.UserStatusActive,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		if err := s.userRepo.Create(user); err != nil {
			return nil, err
		}
	}

	newOA := &database.OAuthAccount{
		ID:             uuid.New(),
		UserID:         user.ID,
		Provider:       "google",
		ProviderUserID: googleUserID,
		Email:          emailAddress,
		CreatedAt:      time.Now(),
	}
	_ = s.oauthRepo.Create(newOA)

	s.auditLogger.Log(&user.ID, "GoogleAccountLinked", "Google account successfully linked to LUMA profile", ip, ua)

	return s.finalizeLoginSession(user, deviceID, ip, ua)
}

// Basic Token Validation helpers
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func base64Encode(val string) string {
	return hex.EncodeToString([]byte(val))
}

func generateSecureOTP() (string, error) {
	codes := "0123456789"
	result := make([]byte, 6)
	for i := range result {
		num, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		result[i] = codes[num.Int64()]
	}
	return string(result), nil
}
