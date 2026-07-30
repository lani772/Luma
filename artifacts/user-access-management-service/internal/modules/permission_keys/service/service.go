package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permission_keys/domain/entities"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permission_keys/repository"
)

var (
	ErrKeyNotFound   = errors.New("permission key not found")
	ErrKeyInvalid    = errors.New("invalid or inactive permission key")
	ErrUnauthorized  = errors.New("unauthorized key management")
)

type SyncManager interface {
	CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error
}

type AuditManager interface {
	Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error
}

type Service struct {
	repo     *repository.Repository
	syncMgr  SyncManager
	auditMgr AuditManager
}

func NewService(repo *repository.Repository, syncMgr SyncManager, auditMgr AuditManager) *Service {
	return &Service{
		repo:     repo,
		syncMgr:  syncMgr,
		auditMgr: auditMgr,
	}
}

// GenerateRawKey returns a 128-char hex secure token, and its SHA256 hex hash
func (s *Service) GenerateRawKey() (string, string, error) {
	bytes := make([]byte, 64)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", err
	}
	raw := hex.EncodeToString(bytes)
	hash := sha256.Sum256([]byte(raw))
	hashStr := hex.EncodeToString(hash[:])
	return raw, hashStr, nil
}

func (s *Service) GenerateKeysForUser(ctx context.Context, userID uuid.UUID, controllerID uuid.UUID) error {
	raw, hash, err := s.GenerateRawKey()
	if err != nil {
		return err
	}

	pk := &entities.PermissionKey{
		ID:           uuid.New(),
		UserID:       userID,
		ResourceID:   controllerID.String(),
		PermissionID: uuid.Nil, // placeholder or linked to permission ID
		KeyHash:      hash,
		Type:         "user_permission",
		Status:       "active",
		CreatedAt:    time.Now(),
	}

	if err := s.repo.Save(ctx, pk); err != nil {
		return err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, userID, "permission_key", pk.ID.String(), map[string]any{
		"id":         pk.ID.String(),
		"userId":     userID.String(),
		"resourceId": controllerID.String(),
		"rawKey":     raw, // include rawKey in sync packet once safely encrypted or during registration flow
		"status":     "active",
	}, false)

	return nil
}

func (s *Service) RevokeKeysForUser(ctx context.Context, userID uuid.UUID, controllerID uuid.UUID) error {
	return s.repo.RevokeUserKeysOnController(ctx, userID, controllerID.String())
}

func (s *Service) ValidateKey(ctx context.Context, key string, resourceID string) (bool, string, error) {
	hash := sha256.Sum256([]byte(key))
	hashStr := hex.EncodeToString(hash[:])

	pk, err := s.repo.FindByHash(ctx, hashStr)
	if err != nil {
		return false, "", err
	}
	if pk == nil {
		return false, "", ErrKeyNotFound
	}

	if pk.Status != "active" {
		return false, "", ErrKeyInvalid
	}

	if pk.ExpiresAt != nil && time.Now().After(*pk.ExpiresAt) {
		pk.Status = "expired"
		_ = s.repo.Save(ctx, pk)
		return false, "", ErrKeyInvalid
	}

	if pk.ResourceID != resourceID {
		return false, "", ErrKeyInvalid
	}

	return true, pk.UserID.String(), nil
}
