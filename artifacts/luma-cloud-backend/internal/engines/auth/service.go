package auth

import (
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/config"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrEmailAlreadyRegistered = errors.New("email already registered")
	ErrInvalidCredentials     = errors.New("invalid email or password")
	ErrTokenInvalidOrExpired  = errors.New("token invalid or expired")
	ErrSessionNotFound        = errors.New("session not found")
)

// AuditRecorder is implemented by the Audit Log Engine. Kept as a narrow
// interface here so the Auth Engine can stay independent of that package
// (and so Phase 1 can run with a no-op recorder before Phase 2 lands).
type AuditRecorder interface {
	Record(actorUserID *uuid.UUID, action, resourceType, resourceID, ipAddress string, metadata map[string]any)
}

type noopAuditRecorder struct{}

func (noopAuditRecorder) Record(*uuid.UUID, string, string, string, string, map[string]any) {}

type Service struct {
	repo      *Repository
	cfg       config.JWTConfig
	blacklist *Blacklist
	audit     AuditRecorder
	log       *slog.Logger
}

func NewService(repo *Repository, cfg config.JWTConfig, blacklist *Blacklist, audit AuditRecorder, log *slog.Logger) *Service {
	if audit == nil {
		audit = noopAuditRecorder{}
	}
	return &Service{repo: repo, cfg: cfg, blacklist: blacklist, audit: audit, log: log}
}

func (s *Service) Register(req RegisterRequest, ip string) (*AuthResponse, error) {
	if _, err := s.repo.FindUserByEmail(req.Email); err == nil {
		return nil, ErrEmailAlreadyRegistered
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("auth: lookup email: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("auth: hash password: %w", err)
	}

	now := time.Now()
	user := &models.User{
		ID:               uuid.New(),
		Email:            req.Email,
		PasswordHash:     string(hash),
		FullName:         req.FullName,
		Role:             models.RoleOwner,
		Status:           models.UserStatusActive,
		SubscriptionTier: "free",
		Preferences:      models.JSONMap{},
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.repo.CreateUser(user); err != nil {
		return nil, fmt.Errorf("auth: create user: %w", err)
	}

	s.audit.Record(&user.ID, "user.registered", "user", user.ID.String(), ip, nil)

	return s.startSession(user, req.DeviceName, req.Platform, "", ip)
}

func (s *Service) Login(req LoginRequest, ip string) (*AuthResponse, error) {
	user, err := s.repo.FindUserByEmail(req.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("auth: lookup email: %w", err)
	}
	if user.Status != models.UserStatusActive {
		return nil, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	s.audit.Record(&user.ID, "user.login", "user", user.ID.String(), ip, map[string]any{"platform": req.Platform})

	return s.startSession(user, req.DeviceName, req.Platform, req.PushToken, ip)
}

// startSession is shared by Register and Login: it finds/creates the phone
// row for this device, mints a session + refresh token, and returns the
// full auth response. Because sessions are scoped per phone (not per user),
// a user can be logged in from many phones at once without one login
// invalidating another — the "multiple phones" requirement.
func (s *Service) startSession(user *models.User, deviceName, platform, pushToken, ip string) (*AuthResponse, error) {
	phone, err := s.repo.FindOrCreatePhone(user.ID, deviceName, platform, pushToken)
	if err != nil {
		return nil, fmt.Errorf("auth: find or create phone: %w", err)
	}

	sessionID := uuid.New()
	rawRefresh, refreshHash, err := generateOpaqueToken()
	if err != nil {
		return nil, err
	}
	refreshExpiresAt := time.Now().Add(s.cfg.RefreshTTL)

	session := &models.Session{
		ID:               sessionID,
		UserID:           user.ID,
		PhoneID:          &phone.ID,
		RefreshTokenHash: refreshHash,
		ExpiresAt:        refreshExpiresAt,
		CreatedAt:        time.Now(),
	}
	if ip != "" {
		session.IPAddress = &ip
	}
	if err := s.repo.CreateSession(session); err != nil {
		return nil, fmt.Errorf("auth: create session: %w", err)
	}

	accessToken, accessExpiresAt, err := s.issueAccessToken(user.ID.String(), sessionID.String(), string(user.Role))
	if err != nil {
		return nil, fmt.Errorf("auth: issue access token: %w", err)
	}

	return &AuthResponse{
		AccessToken:           accessToken,
		AccessTokenExpiresAt:  accessExpiresAt,
		RefreshToken:          rawRefresh,
		RefreshTokenExpiresAt: refreshExpiresAt,
		SessionID:             sessionID.String(),
		User:                  toUserDTO(user),
	}, nil
}

// Refresh rotates the refresh token: the old one is revoked and a new
// session row (same phone) is created, so a stolen-and-replayed old refresh
// token is detectable (its hash no longer resolves to an active session).
func (s *Service) Refresh(req RefreshRequest) (*AuthResponse, error) {
	hash := hashToken(req.RefreshToken)
	session, err := s.repo.FindSessionByRefreshHash(hash)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTokenInvalidOrExpired
		}
		return nil, fmt.Errorf("auth: lookup session: %w", err)
	}
	if session.RevokedAt != nil || time.Now().After(session.ExpiresAt) {
		return nil, ErrTokenInvalidOrExpired
	}

	user, err := s.repo.FindUserByID(session.UserID.String())
	if err != nil {
		return nil, fmt.Errorf("auth: lookup user: %w", err)
	}

	if err := s.repo.RevokeSession(session.ID); err != nil {
		return nil, fmt.Errorf("auth: revoke old session: %w", err)
	}
	if s.blacklist != nil {
		s.blacklist.Revoke(session.ID.String(), s.cfg.AccessTTL)
	}

	newSessionID := uuid.New()
	rawRefresh, refreshHash, err := generateOpaqueToken()
	if err != nil {
		return nil, err
	}
	refreshExpiresAt := time.Now().Add(s.cfg.RefreshTTL)
	newSession := &models.Session{
		ID:               newSessionID,
		UserID:           user.ID,
		PhoneID:          session.PhoneID,
		RefreshTokenHash: refreshHash,
		ExpiresAt:        refreshExpiresAt,
		CreatedAt:        time.Now(),
	}
	if err := s.repo.CreateSession(newSession); err != nil {
		return nil, fmt.Errorf("auth: create rotated session: %w", err)
	}

	accessToken, accessExpiresAt, err := s.issueAccessToken(user.ID.String(), newSessionID.String(), string(user.Role))
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		AccessToken:           accessToken,
		AccessTokenExpiresAt:  accessExpiresAt,
		RefreshToken:          rawRefresh,
		RefreshTokenExpiresAt: refreshExpiresAt,
		SessionID:             newSessionID.String(),
		User:                  toUserDTO(user),
	}, nil
}

func (s *Service) Logout(refreshToken string) error {
	hash := hashToken(refreshToken)
	session, err := s.repo.FindSessionByRefreshHash(hash)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil // already logged out; logout is idempotent
		}
		return fmt.Errorf("auth: lookup session: %w", err)
	}
	if err := s.repo.RevokeSession(session.ID); err != nil {
		return fmt.Errorf("auth: revoke session: %w", err)
	}
	if s.blacklist != nil {
		s.blacklist.Revoke(session.ID.String(), s.cfg.AccessTTL)
	}
	return nil
}

// RevokeAllOtherSessions supports "log out all other phones" — token
// revocation across the whole account, keeping only currentSessionID alive.
func (s *Service) RevokeAllOtherSessions(userID uuid.UUID, currentSessionID string) error {
	sessions, err := s.repo.ListActiveSessionsForUser(userID)
	if err != nil {
		return err
	}
	for _, sess := range sessions {
		if sess.ID.String() == currentSessionID {
			continue
		}
		if err := s.repo.RevokeSession(sess.ID); err != nil {
			return err
		}
		if s.blacklist != nil {
			s.blacklist.Revoke(sess.ID.String(), s.cfg.AccessTTL)
		}
	}
	return nil
}

// FindUserIDByEmail implements devices.UserLookup so the Device Registration
// Engine can resolve ownership-transfer/admin-grant emails without importing
// this whole package.
func (s *Service) FindUserIDByEmail(email string) (uuid.UUID, error) {
	user, err := s.repo.FindUserByEmail(email)
	if err != nil {
		return uuid.UUID{}, err
	}
	return user.ID, nil
}

func (s *Service) Profile(userID string) (*UserDTO, error) {
	user, err := s.repo.FindUserByID(userID)
	if err != nil {
		return nil, err
	}
	dto := toUserDTO(user)
	return &dto, nil
}

func (s *Service) ListSessions(userID uuid.UUID, currentSessionID string) ([]SessionDTO, error) {
	sessions, err := s.repo.ListActiveSessionsForUser(userID)
	if err != nil {
		return nil, err
	}
	phones, err := s.repo.ListPhonesForUser(userID)
	if err != nil {
		return nil, err
	}
	phoneByID := make(map[uuid.UUID]models.UserPhone, len(phones))
	for _, p := range phones {
		phoneByID[p.ID] = p
	}

	out := make([]SessionDTO, 0, len(sessions))
	for _, sess := range sessions {
		dto := SessionDTO{
			ID:        sess.ID.String(),
			CreatedAt: sess.CreatedAt,
			IsCurrent: sess.ID.String() == currentSessionID,
		}
		if sess.PhoneID != nil {
			if p, ok := phoneByID[*sess.PhoneID]; ok {
				dto.DeviceName = p.DeviceName
				dto.Platform = string(p.Platform)
				dto.LastSeenAt = p.LastSeenAt
			}
		}
		out = append(out, dto)
	}
	return out, nil
}

// RequestPasswordReset always returns nil (no error) even for an unknown
// email, to avoid leaking which addresses are registered. The reset token
// is logged via the (stubbed) notification path rather than emailed — see
// docs/mobile-core-engine parity note in this engine's package doc.
func (s *Service) RequestPasswordReset(email string) (token string, err error) {
	user, err := s.repo.FindUserByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil
		}
		return "", err
	}
	raw, hash, err := generateOpaqueToken()
	if err != nil {
		return "", err
	}
	if err := s.repo.CreatePasswordResetToken(&models.PasswordResetToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(1 * time.Hour),
		CreatedAt: time.Now(),
	}); err != nil {
		return "", err
	}
	s.log.Info("password_reset_requested", "userId", user.ID, "note", "delivery goes through the Notification Engine (stubbed provider) once wired")
	return raw, nil
}

func (s *Service) ConfirmPasswordReset(req ConfirmPasswordResetRequest) error {
	hash := hashToken(req.Token)
	t, err := s.repo.FindPasswordResetToken(hash)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTokenInvalidOrExpired
		}
		return err
	}
	if t.UsedAt != nil || time.Now().After(t.ExpiresAt) {
		return ErrTokenInvalidOrExpired
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := s.repo.UpdateUserPassword(t.UserID, string(newHash)); err != nil {
		return err
	}
	if err := s.repo.MarkPasswordResetTokenUsed(t.ID); err != nil {
		return err
	}
	// Resetting a password revokes every existing session as a security
	// measure — the user re-authenticates each phone with the new password.
	return s.repo.RevokeAllSessionsForUser(t.UserID)
}

func (s *Service) RequestEmailVerification(userID uuid.UUID) (string, error) {
	raw, hash, err := generateOpaqueToken()
	if err != nil {
		return "", err
	}
	if err := s.repo.CreateEmailVerificationToken(&models.EmailVerificationToken{
		ID:        uuid.New(),
		UserID:    userID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
	}); err != nil {
		return "", err
	}
	return raw, nil
}

func (s *Service) ConfirmEmailVerification(token string) error {
	hash := hashToken(token)
	t, err := s.repo.FindEmailVerificationToken(hash)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTokenInvalidOrExpired
		}
		return err
	}
	if t.UsedAt != nil || time.Now().After(t.ExpiresAt) {
		return ErrTokenInvalidOrExpired
	}
	if err := s.repo.MarkEmailVerified(t.UserID); err != nil {
		return err
	}
	return s.repo.MarkEmailVerificationTokenUsed(t.ID)
}

func toUserDTO(u *models.User) UserDTO {
	return UserDTO{
		ID:               u.ID.String(),
		Email:            u.Email,
		FullName:         u.FullName,
		Role:             string(u.Role),
		EmailVerified:    u.EmailVerifiedAt != nil,
		SubscriptionTier: u.SubscriptionTier,
		CreatedAt:        u.CreatedAt,
	}
}
