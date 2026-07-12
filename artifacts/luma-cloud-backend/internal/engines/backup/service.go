package backup

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"github.com/luma-smart-home/cloud-backend/internal/storage"
)

type Service struct {
	repo    *Repository
	storage storage.StorageProvider
	log     any // Logger or equivalent, can use slog or print
}

func NewService(repo *Repository, store storage.StorageProvider) *Service {
	return &Service{
		repo:    repo,
		storage: store,
	}
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID) (*BackupDTO, error) {
	records, err := s.repo.GetUserSyncRecords(userID)
	if err != nil {
		return nil, err
	}

	payload, err := json.Marshal(records)
	if err != nil {
		return nil, err
	}

	sizeBytes := int64(len(payload))
	hash := sha256.New()
	hash.Write(payload)
	checksum := hex.EncodeToString(hash.Sum(nil))

	backupID := uuid.New()
	storagePath := fmt.Sprintf("backups/%s/%s.json", userID, backupID)

	_, err = s.storage.Save(ctx, storagePath, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}

	backup := &models.Backup{
		ID:          backupID,
		UserID:      userID,
		StoragePath: storagePath,
		SizeBytes:   sizeBytes,
		Checksum:    checksum,
		CreatedAt:   time.Now(),
	}

	if err := s.repo.Create(backup); err != nil {
		_ = s.storage.Delete(ctx, storagePath)
		return nil, err
	}

	return toBackupDTO(backup), nil
}

func (s *Service) List(userID uuid.UUID, page, perPage int) ([]BackupDTO, int64, error) {
	list, total, err := s.repo.ListForUser(userID, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	dtoList := make([]BackupDTO, 0, len(list))
	for _, b := range list {
		dtoList = append(dtoList, *toBackupDTO(&b))
	}
	return dtoList, total, nil
}

func (s *Service) Restore(ctx context.Context, userID uuid.UUID, backupID uuid.UUID, req RestoreBackupRequest) error {
	backup, err := s.repo.FindByID(backupID)
	if err != nil {
		return err
	}

	if backup.UserID != userID {
		return errors.New("unauthorized backup restore")
	}

	reader, err := s.storage.Get(ctx, backup.StoragePath)
	if err != nil {
		return err
	}
	defer reader.Close()

	payload, err := io.ReadAll(reader)
	if err != nil {
		return err
	}

	var records []models.CloudSyncRecord
	if err := json.Unmarshal(payload, &records); err != nil {
		return err
	}

	for _, rec := range records {
		shouldRestore := false

		switch req.TargetType {
		case "all":
			shouldRestore = true
		case "home":
			if rec.ResourceType == "homes" && rec.ResourceID == req.TargetID {
				shouldRestore = true
			}
		case "room":
			if rec.ResourceType == "rooms" && rec.ResourceID == req.TargetID {
				shouldRestore = true
			}
		case "controller":
			if rec.ResourceType == "devices" && rec.ResourceID == req.TargetID {
				shouldRestore = true
			}
		}

		if shouldRestore {
			// Save record back
			rec.UserID = userID // Ensure mapped correctly to current restorer
			rec.UpdatedAt = time.Now()
			// Increment version to push change down to client
			rec.Version++
			_ = s.repo.SaveSyncRecord(&rec)
		}
	}

	return nil
}

func (s *Service) Delete(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	backup, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	if backup.UserID != userID {
		return errors.New("unauthorized backup deletion")
	}

	if err := s.repo.Delete(id); err != nil {
		return err
	}

	_ = s.storage.Delete(ctx, backup.StoragePath)
	return nil
}

// Tick performs automatic daily/periodic backups for all users
func (s *Service) Tick(ctx context.Context) {
	users, err := s.repo.ListAllUsers()
	if err == nil {
		for _, uID := range users {
			// Check if already backed up in last 24 hours
			backups, total, err := s.repo.ListForUser(uID, 1, 1)
			if err == nil && total > 0 && len(backups) > 0 {
				if time.Since(backups[0].CreatedAt) < 24*time.Hour {
					continue
				}
			}
			_, _ = s.Create(ctx, uID)
		}
	}
}

func toBackupDTO(b *models.Backup) *BackupDTO {
	return &BackupDTO{
		ID:          b.ID.String(),
		UserID:      b.UserID.String(),
		StoragePath: b.StoragePath,
		SizeBytes:   b.SizeBytes,
		Checksum:    b.Checksum,
		CreatedAt:   b.CreatedAt,
	}
}
