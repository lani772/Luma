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
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
)

type TokenManager struct {
	algorithm    string
	issuer       string
	accessTTL    time.Duration
	refreshTTL   time.Duration
	ed25519Priv  ed25519.PrivateKey
	ed25519Pub   ed25519.PublicKey
	rsaPriv      *rsa.PrivateKey
	rsaPub       *rsa.PublicKey
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
			// Try as PKCS8 or PKCS1 binary
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

	// Default algorithm is EdDSA
	// Let's parse Ed25519 private key from block, or parse directly
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

	// EdDSA
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return err
	}
	m.ed25519Priv = priv
	m.ed25519Pub = pub
	m.logger.Info("transient Ed25519 keypair generated successfully")
	return nil
}

func (m *TokenManager) GenerateUserAccessToken(userID, sessionID string) (string, time.Time, error) {
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
		return m.getValidationKey()
	})

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
		return m.getValidationKey()
	})

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

func (m *TokenManager) getValidationKey() (any, error) {
	if m.algorithm == "RS256" {
		if m.rsaPub == nil {
			return nil, errors.New("rsa public key not initialized")
		}
		return m.rsaPub, nil
	}
	if len(m.ed25519Pub) == 0 {
		return nil, errors.New("ed25519 public key not initialized")
	}
	return m.ed25519Pub, nil
}
