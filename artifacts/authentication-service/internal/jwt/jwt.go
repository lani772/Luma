package jwt

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
)

type TokenManager struct {
	mu           sync.RWMutex
	algorithm    string
	issuer       string
	accessTTL    time.Duration
	refreshTTL   time.Duration

	// Active key pair
	ed25519Priv  ed25519.PrivateKey
	ed25519Pub   ed25519.PublicKey
	rsaPriv      *rsa.PrivateKey
	rsaPub       *rsa.PublicKey

	// Previous public keys (to support verification of previously issued tokens during rotation)
	prevEd25519Pub ed25519.PublicKey
	prevRsaPub     *rsa.PublicKey

	logger       *zap.Logger
}

type UserClaims struct {
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
	jwt.RegisteredClaims
}

type ServiceClaims struct {
	ServiceID   string `json:"service_id"`
	ServiceName string `json:"service_name"`
	jwt.RegisteredClaims
}

func NewTokenManager(alg, issuer string, accessTTL, refreshTTL time.Duration, privB64, pubB64 string, logger *zap.Logger) (*TokenManager, error) {
	m := &TokenManager{
		algorithm:  alg,
		issuer:     issuer,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
		logger:     logger,
	}

	if privB64 != "" && pubB64 != "" {
		err := m.loadKeysFromBase64(privB64, pubB64)
		if err == nil {
			return m, nil
		}
		logger.Error("failed to load configured cryptographic keys, falling back to dynamic generation", zap.Error(err))
	} else {
		logger.Warn("cryptographic keys not provided, generating transient keypair for development/runtime")
	}

	if err := m.generateTransientKeyPair(); err != nil {
		return nil, fmt.Errorf("failed to generate transient keypair: %w", err)
	}

	return m, nil
}

func (m *TokenManager) loadKeysFromBase64(privB64, pubB64 string) error {
	privBytes, err := base64.StdEncoding.DecodeString(privB64)
	if err != nil {
		return fmt.Errorf("decode private key: %w", err)
	}
	pubBytes, err := base64.StdEncoding.DecodeString(pubB64)
	if err != nil {
		return fmt.Errorf("decode public key: %w", err)
	}

	if m.algorithm == "RS256" {
		priv, err := jwt.ParseRSAPrivateKeyFromPEM(privBytes)
		if err != nil {
			p, err := x509.ParsePKCS8PrivateKey(privBytes)
			if err != nil {
				return fmt.Errorf("parse rsa private key: %w", err)
			}
			var ok bool
			priv, ok = p.(*rsa.PrivateKey)
			if !ok {
				return errors.New("not an RSA private key")
			}
		}
		pub, err := jwt.ParseRSAPublicKeyFromPEM(pubBytes)
		if err != nil {
			p, err := x509.ParsePKIXPublicKey(pubBytes)
			if err != nil {
				return fmt.Errorf("parse rsa public key: %w", err)
			}
			var ok bool
			pub, ok = p.(*rsa.PublicKey)
			if !ok {
				return errors.New("not an RSA public key")
			}
		}
		m.rsaPriv = priv
		m.rsaPub = pub
		return nil
	}

	blockPriv, _ := pem.Decode(privBytes)
	if blockPriv != nil {
		privBytes = blockPriv.Bytes
	}
	blockPub, _ := pem.Decode(pubBytes)
	if blockPub != nil {
		pubBytes = blockPub.Bytes
	}

	privKey, err := x509.ParsePKCS8PrivateKey(privBytes)
	if err != nil {
		if len(privBytes) == ed25519.PrivateKeySize {
			m.ed25519Priv = ed25519.PrivateKey(privBytes)
		} else {
			return fmt.Errorf("parse ed25519 private key: %w", err)
		}
	} else {
		var ok bool
		m.ed25519Priv, ok = privKey.(ed25519.PrivateKey)
		if !ok {
			return errors.New("not an Ed25519 private key")
		}
	}

	pubKey, err := x509.ParsePKIXPublicKey(pubBytes)
	if err != nil {
		if len(pubBytes) == ed25519.PublicKeySize {
			m.ed25519Pub = ed25519.PublicKey(pubBytes)
		} else {
			return fmt.Errorf("parse ed25519 public key: %w", err)
		}
	} else {
		var ok bool
		m.ed25519Pub, ok = pubKey.(ed25519.PublicKey)
		if !ok {
			return errors.New("not an Ed25519 public key")
		}
	}

	return nil
}

func (m *TokenManager) generateTransientKeyPair() error {
	m.logger.Warn("generating dynamic transient cryptographic keypair...")
	if m.algorithm == "RS256" {
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return err
		}
		m.rsaPriv = priv
		m.rsaPub = &priv.PublicKey
		m.logger.Info("transient RSA-2048 keypair generated successfully")
		return nil
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return err
	}
	m.ed25519Priv = priv
	m.ed25519Pub = pub
	m.logger.Info("transient Ed25519 keypair generated successfully")
	return nil
}

// RotateKeys generates a brand new keypair, shifting the previous active public key to the fallback slot
func (m *TokenManager) RotateKeys() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logger.Warn("executing cryptographic key rotation event...")

	if m.algorithm == "RS256" {
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return err
		}
		m.prevRsaPub = m.rsaPub
		m.rsaPriv = priv
		m.rsaPub = &priv.PublicKey
		m.logger.Info("RSA-2048 keys rotated successfully")
		return nil
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return err
	}
	m.prevEd25519Pub = m.ed25519Pub
	m.ed25519Priv = priv
	m.ed25519Pub = pub
	m.logger.Info("Ed25519 keys rotated successfully")
	return nil
}

func (m *TokenManager) GenerateUserAccessToken(userID, sessionID string) (string, time.Time, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now()
	expiresAt := now.Add(m.accessTTL)

	claims := UserClaims{
		UserID:    userID,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(m.getSigningMethod(), claims)
	tokenStr, err := m.signToken(token)
	return tokenStr, expiresAt, err
}

func (m *TokenManager) GenerateServiceToken(serviceID, serviceName string, ttl time.Duration) (string, time.Time, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now()
	expiresAt := now.Add(ttl)

	claims := ServiceClaims{
		ServiceID:   serviceID,
		ServiceName: serviceName,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   serviceID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(m.getSigningMethod(), claims)
	tokenStr, err := m.signToken(token)
	return tokenStr, expiresAt, err
}

func (m *TokenManager) VerifyUserAccessToken(tokenStr string) (*UserClaims, error) {
	claims := &UserClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != m.algorithm {
			return nil, fmt.Errorf("unexpected signing method: %s", t.Method.Alg())
		}
		m.mu.RLock()
		defer m.mu.RUnlock()
		if m.algorithm == "RS256" {
			return m.rsaPub, nil
		}
		return m.ed25519Pub, nil
	})

	// Fallback to previous key if active signature verification fails
	if err != nil && (errors.Is(err, jwt.ErrSignatureInvalid) || strings.Contains(err.Error(), "signature is invalid")) {
		claimsFallback := &UserClaims{}
		tokenFallback, errFallback := jwt.ParseWithClaims(tokenStr, claimsFallback, func(t *jwt.Token) (any, error) {
			m.mu.RLock()
			defer m.mu.RUnlock()
			if m.algorithm == "RS256" {
				if m.prevRsaPub == nil {
					return nil, errors.New("no fallback RSA public key")
				}
				return m.prevRsaPub, nil
			}
			if len(m.prevEd25519Pub) == 0 {
				return nil, errors.New("no fallback Ed25519 public key")
			}
			return m.prevEd25519Pub, nil
		})
		if errFallback == nil && tokenFallback.Valid {
			return claimsFallback, nil
		}
	}

	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

func (m *TokenManager) VerifyServiceToken(tokenStr string) (*ServiceClaims, error) {
	claims := &ServiceClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != m.algorithm {
			return nil, fmt.Errorf("unexpected signing method: %s", t.Method.Alg())
		}
		m.mu.RLock()
		defer m.mu.RUnlock()
		if m.algorithm == "RS256" {
			return m.rsaPub, nil
		}
		return m.ed25519Pub, nil
	})

	// Fallback to previous key if active signature verification fails
	if err != nil && (errors.Is(err, jwt.ErrSignatureInvalid) || strings.Contains(err.Error(), "signature is invalid")) {
		claimsFallback := &ServiceClaims{}
		tokenFallback, errFallback := jwt.ParseWithClaims(tokenStr, claimsFallback, func(t *jwt.Token) (any, error) {
			m.mu.RLock()
			defer m.mu.RUnlock()
			if m.algorithm == "RS256" {
				if m.prevRsaPub == nil {
					return nil, errors.New("no fallback RSA public key")
				}
				return m.prevRsaPub, nil
			}
			if len(m.prevEd25519Pub) == 0 {
				return nil, errors.New("no fallback Ed25519 public key")
			}
			return m.prevEd25519Pub, nil
		})
		if errFallback == nil && tokenFallback.Valid {
			return claimsFallback, nil
		}
	}

	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid service token")
	}

	return claims, nil
}

func (m *TokenManager) getSigningMethod() jwt.SigningMethod {
	if m.algorithm == "RS256" {
		return jwt.SigningMethodRS256
	}
	return jwt.SigningMethodEdDSA
}

func (m *TokenManager) signToken(token *jwt.Token) (string, error) {
	if m.algorithm == "RS256" {
		return token.SignedString(m.rsaPriv)
	}
	return token.SignedString(m.ed25519Priv)
}

func (m *TokenManager) getValidationKey(tokenStr string, claims any) (any, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// 1. Try active key validation first
	if m.algorithm == "RS256" {
		if m.rsaPub == nil {
			return nil, errors.New("rsa public key not initialized")
		}
		// If verification with active rsaPub fails or if we want to support fallback, standard parser will call this.
		// Since jwt.Parse calls our key-finding function directly, we'll try validating with active.
		// Wait, if active fails, how does jwt.v5 support fallback?
		// We can return a helper that wraps active and fallback. However, in standard JWT signature checking,
		// jwt-go expects the raw key.
		// Thus, we'll first try active. If there is a fallback, let's see: we can parse the token with active first.
		// If that fails, we can catch signature invalid error and retry with previous key!
		// But inside this callback, we don't know if active will fail. So we can just return active.
		// Wait, can we perform a quick trial verification or just inspect?
		// Actually, we can return the active key, and if that fails, we can handle it during Verify.
		// Let's implement fallback verification directly in Verify! That's extremely robust and elegant.
		return m.rsaPub, nil
	}

	if len(m.ed25519Pub) == 0 {
		return nil, errors.New("ed25519 public key not initialized")
	}
	return m.ed25519Pub, nil
}
