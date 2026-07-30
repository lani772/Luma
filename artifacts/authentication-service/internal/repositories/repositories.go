package repositories

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound          = errors.New("user not found")
	ErrSessionNotFound       = errors.New("session not found")
	ErrTokenNotFound         = errors.New("token not found")
	ErrServiceAccountNotFound = errors.New("service account not found")
)

type UserRepository interface {
	Create(user *database.User) error
	GetByID(id uuid.UUID) (*database.User, error)
	GetByEmail(email string) (*database.User, error)
	GetByUsername(username string) (*database.User, error)
	Update(user *database.User) error
	Delete(id uuid.UUID) error
}

type GORMUserRepository struct {
	db *gorm.DB
}

func NewGORMUserRepository(db *gorm.DB) UserRepository {
	return &GORMUserRepository{db: db}
}

func (r *GORMUserRepository) Create(user *database.User) error {
	return r.db.Create(user).Error
}

func (r *GORMUserRepository) GetByID(id uuid.UUID) (*database.User, error) {
	var user database.User
	err := r.db.First(&user, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *GORMUserRepository) GetByEmail(email string) (*database.User, error) {
	var user database.User
	err := r.db.First(&user, "email = ?", email).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *GORMUserRepository) GetByUsername(username string) (*database.User, error) {
	var user database.User
	err := r.db.First(&user, "username = ?", username).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *GORMUserRepository) Update(user *database.User) error {
	return r.db.Save(user).Error
}

func (r *GORMUserRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&database.User{}, "id = ?", id).Error
}

// SessionRepository
type SessionRepository interface {
	Create(session *database.Session) error
	GetByID(id uuid.UUID) (*database.Session, error)
	ListActiveByUser(userID uuid.UUID) ([]database.Session, error)
	Update(session *database.Session) error
	RevokeAllForUser(userID uuid.UUID) error
	RevokeAllExcept(userID uuid.UUID, activeSessionID uuid.UUID) error
}

type GORMSessionRepository struct {
	db *gorm.DB
}

func NewGORMSessionRepository(db *gorm.DB) SessionRepository {
	return &GORMSessionRepository{db: db}
}

func (r *GORMSessionRepository) Create(session *database.Session) error {
	return r.db.Create(session).Error
}

func (r *GORMSessionRepository) GetByID(id uuid.UUID) (*database.Session, error) {
	var session database.Session
	err := r.db.First(&session, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}
	return &session, nil
}

func (r *GORMSessionRepository) ListActiveByUser(userID uuid.UUID) ([]database.Session, error) {
	var sessions []database.Session
	err := r.db.Where("user_id = ? AND status = 'active' AND expires_at > ?", userID, time.Now()).Find(&sessions).Error
	return sessions, err
}

func (r *GORMSessionRepository) Update(session *database.Session) error {
	return r.db.Save(session).Error
}

func (r *GORMSessionRepository) RevokeAllForUser(userID uuid.UUID) error {
	return r.db.Model(&database.Session{}).
		Where("user_id = ? AND status = 'active'", userID).
		Update("status", "revoked").Error
}

func (r *GORMSessionRepository) RevokeAllExcept(userID uuid.UUID, activeSessionID uuid.UUID) error {
	return r.db.Model(&database.Session{}).
		Where("user_id = ? AND id != ? AND status = 'active'", userID, activeSessionID).
		Update("status", "revoked").Error
}

// RefreshTokenRepository
type RefreshTokenRepository interface {
	Create(token *database.RefreshToken) error
	GetByHash(hash string) (*database.RefreshToken, error)
	RevokeBySession(sessionID uuid.UUID) error
}

type GORMRefreshTokenRepository struct {
	db *gorm.DB
}

func NewGORMRefreshTokenRepository(db *gorm.DB) RefreshTokenRepository {
	return &GORMRefreshTokenRepository{db: db}
}

func (r *GORMRefreshTokenRepository) Create(token *database.RefreshToken) error {
	return r.db.Create(token).Error
}

func (r *GORMRefreshTokenRepository) GetByHash(hash string) (*database.RefreshToken, error) {
	var token database.RefreshToken
	err := r.db.First(&token, "token_hash = ?", hash).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTokenNotFound
		}
		return nil, err
	}
	return &token, nil
}

func (r *GORMRefreshTokenRepository) RevokeBySession(sessionID uuid.UUID) error {
	return r.db.Model(&database.RefreshToken{}).
		Where("session_id = ? AND revoked = false", sessionID).
		Update("revoked", true).Error
}

// EmailVerificationRepository
type EmailVerificationRepository interface {
	Create(v *database.EmailVerification) error
	GetByUserID(userID uuid.UUID) (*database.EmailVerification, error)
	GetByMagicLinkHash(hash string) (*database.EmailVerification, error)
	Save(v *database.EmailVerification) error
}

type GORMEmailVerificationRepository struct {
	db *gorm.DB
}

func NewGORMEmailVerificationRepository(db *gorm.DB) EmailVerificationRepository {
	return &GORMEmailVerificationRepository{db: db}
}

func (r *GORMEmailVerificationRepository) Create(v *database.EmailVerification) error {
	return r.db.Create(v).Error
}

func (r *GORMEmailVerificationRepository) GetByUserID(userID uuid.UUID) (*database.EmailVerification, error) {
	var v database.EmailVerification
	err := r.db.First(&v, "user_id = ?", userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTokenNotFound
		}
		return nil, err
	}
	return &v, nil
}

func (r *GORMEmailVerificationRepository) GetByMagicLinkHash(hash string) (*database.EmailVerification, error) {
	var v database.EmailVerification
	err := r.db.First(&v, "magic_link_hash = ?", hash).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTokenNotFound
		}
		return nil, err
	}
	return &v, nil
}

func (r *GORMEmailVerificationRepository) Save(v *database.EmailVerification) error {
	return r.db.Save(v).Error
}

// PasswordResetTokenRepository
type PasswordResetTokenRepository interface {
	Create(t *database.PasswordResetToken) error
	GetByHash(hash string) (*database.PasswordResetToken, error)
	Save(t *database.PasswordResetToken) error
}

type GORMPasswordResetTokenRepository struct {
	db *gorm.DB
}

func NewGORMPasswordResetTokenRepository(db *gorm.DB) PasswordResetTokenRepository {
	return &GORMPasswordResetTokenRepository{db: db}
}

func (r *GORMPasswordResetTokenRepository) Create(t *database.PasswordResetToken) error {
	return r.db.Create(t).Error
}

func (r *GORMPasswordResetTokenRepository) GetByHash(hash string) (*database.PasswordResetToken, error) {
	var t database.PasswordResetToken
	err := r.db.First(&t, "token_hash = ?", hash).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTokenNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *GORMPasswordResetTokenRepository) Save(t *database.PasswordResetToken) error {
	return r.db.Save(t).Error
}

// OAuthAccountRepository
type OAuthAccountRepository interface {
	Create(acc *database.OAuthAccount) error
	GetByProviderInfo(provider, providerUserID string) (*database.OAuthAccount, error)
}

type GORMOOAuthAccountRepository struct {
	db *gorm.DB
}

func NewGORMOOAuthAccountRepository(db *gorm.DB) OAuthAccountRepository {
	return &GORMOOAuthAccountRepository{db: db}
}

func (r *GORMOOAuthAccountRepository) Create(acc *database.OAuthAccount) error {
	return r.db.Create(acc).Error
}

func (r *GORMOOAuthAccountRepository) GetByProviderInfo(provider, providerUserID string) (*database.OAuthAccount, error) {
	var acc database.OAuthAccount
	err := r.db.First(&acc, "provider = ? AND provider_user_id = ?", provider, providerUserID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTokenNotFound
		}
		return nil, err
	}
	return &acc, nil
}

// ServiceAccountRepository
type ServiceAccountRepository interface {
	Create(sa *database.ServiceAccount) error
	GetByClientID(clientID string) (*database.ServiceAccount, error)
}

type GORMServiceAccountRepository struct {
	db *gorm.DB
}

func NewGORMServiceAccountRepository(db *gorm.DB) ServiceAccountRepository {
	return &GORMServiceAccountRepository{db: db}
}

func (r *GORMServiceAccountRepository) Create(sa *database.ServiceAccount) error {
	return r.db.Create(sa).Error
}

func (r *GORMServiceAccountRepository) GetByClientID(clientID string) (*database.ServiceAccount, error) {
	var sa database.ServiceAccount
	err := r.db.First(&sa, "client_id = ?", clientID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrServiceAccountNotFound
		}
		return nil, err
	}
	return &sa, nil
}
