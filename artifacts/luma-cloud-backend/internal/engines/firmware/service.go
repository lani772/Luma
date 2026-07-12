package firmware

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"github.com/luma-smart-home/cloud-backend/internal/storage"
)

var (
	ErrDuplicateVersion = errors.New("firmware with this version already exists")
	ErrInvalidVersion   = errors.New("invalid semantic version format")
	ErrInvalidExtension = errors.New("invalid file extension, only .bin allowed")
	ErrTooLarge         = errors.New("file is larger than allowed limit")
)

// Semver pattern: e.g. 1.0.0, 2.1.3-beta.1
var semverRegexp = regexp.MustCompile(`^v?(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)(?:-(?P<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$`)

type Service struct {
	repo       *Repository
	storage    storage.StorageProvider
	maxSize    int64
	versionReg *regexp.Regexp
}

func NewService(repo *Repository, store storage.StorageProvider, maxSize int64) *Service {
	if maxSize <= 0 {
		maxSize = 20 * 1024 * 1024 // default 20MB
	}
	return &Service{
		repo:       repo,
		storage:    store,
		maxSize:    maxSize,
		versionReg: semverRegexp,
	}
}

func (s *Service) Upload(ctx context.Context, userID uuid.UUID, filename string, req UploadFirmwareRequest, fileReader io.Reader) (*FirmwareReleaseDTO, error) {
	// Validate version
	if !s.versionReg.MatchString(req.Version) {
		return nil, ErrInvalidVersion
	}

	// Validate extension
	if !strings.HasSuffix(strings.ToLower(filename), ".bin") {
		return nil, ErrInvalidExtension
	}

	// Check duplicates
	existing, err := s.repo.FindByVersion(req.DeviceType, req.Version)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrDuplicateVersion
	}

	// We need to read the file into a temporary buffer or memory to calculate size and hash, and limit its size
	limitedReader := io.LimitReader(fileReader, s.maxSize+1)
	tempBuf, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, err
	}

	fileSize := int64(len(tempBuf))
	if fileSize > s.maxSize {
		return nil, ErrTooLarge
	}

	// Compute checksum
	hash := sha256.New()
	hash.Write(tempBuf)
	checksum := hex.EncodeToString(hash.Sum(nil))

	// Save file via StorageProvider
	storagePath := fmt.Sprintf("firmware/%s/%s/%s", req.DeviceType, req.Version, filename)
	_, err = s.storage.Save(ctx, storagePath, bytes.NewReader(tempBuf))
	if err != nil {
		return nil, err
	}

	release := &models.FirmwareRelease{
		ID:               uuid.New(),
		DeviceType:       req.DeviceType,
		Version:          req.Version,
		Channel:          req.Channel,
		StoragePath:      storagePath,
		ChecksumSHA256:   checksum,
		Signature:        req.Signature,
		SizeBytes:        fileSize,
		ReleaseNotes:     req.ReleaseNotes,
		IsRollbackTarget: req.IsRollbackTarget,
		CreatedBy:        &userID,
		CreatedAt:        time.Now(),
	}

	if err := s.repo.Create(release); err != nil {
		// Clean up storage on DB failure
		_ = s.storage.Delete(ctx, storagePath)
		return nil, err
	}

	return toFirmwareDTO(release), nil
}

func (s *Service) Get(id uuid.UUID) (*FirmwareReleaseDTO, error) {
	f, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	return toFirmwareDTO(f), nil
}

func (s *Service) List(deviceType string, channel string, page, perPage int) ([]FirmwareReleaseDTO, int64, error) {
	releases, total, err := s.repo.List(deviceType, channel, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	dtoList := make([]FirmwareReleaseDTO, 0, len(releases))
	for _, f := range releases {
		dtoList = append(dtoList, *toFirmwareDTO(&f))
	}
	return dtoList, total, nil
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	f, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	if err := s.repo.Delete(id); err != nil {
		return err
	}

	// Best effort deletion from storage
	_ = s.storage.Delete(ctx, f.StoragePath)
	return nil
}

func (s *Service) Publish(id uuid.UUID, channel string) (*FirmwareReleaseDTO, error) {
	err := s.repo.Update(id, map[string]any{"channel": channel})
	if err != nil {
		return nil, err
	}
	return s.Get(id)
}

func (s *Service) Archive(id uuid.UUID, isRollbackTarget bool) (*FirmwareReleaseDTO, error) {
	err := s.repo.Update(id, map[string]any{"is_rollback_target": isRollbackTarget})
	if err != nil {
		return nil, err
	}
	return s.Get(id)
}

func (s *Service) Download(ctx context.Context, id uuid.UUID, deviceID *uuid.UUID, ipAddr *string) (io.ReadCloser, string, error) {
	f, err := s.repo.FindByID(id)
	if err != nil {
		return nil, "", err
	}

	reader, err := s.storage.Get(ctx, f.StoragePath)
	if err != nil {
		return nil, "", err
	}

	dl := &models.FirmwareDownload{
		ID:           uuid.New(),
		FirmwareID:   f.ID,
		DeviceID:     deviceID,
		IPAddress:    ipAddr,
		DownloadedAt: time.Now(),
	}

	if err := s.repo.RecordDownload(dl); err != nil {
		reader.Close()
		return nil, "", err
	}

	return reader, f.StoragePath, nil
}

func (s *Service) Compare(deviceType, currentVersion, channel string) (*VersionComparisonDTO, error) {
	latest, err := s.repo.FindLatest(deviceType, channel)
	if err != nil {
		return nil, err
	}

	if latest == nil {
		return &VersionComparisonDTO{
			CurrentVersion: currentVersion,
			LatestVersion:  currentVersion,
			NeedsUpdate:    false,
			Channel:        channel,
		}, nil
	}

	needsUpdate := isNewer(latest.Version, currentVersion)

	return &VersionComparisonDTO{
		CurrentVersion: currentVersion,
		LatestVersion:  latest.Version,
		NeedsUpdate:    needsUpdate,
		Channel:        channel,
	}, nil
}

// Simple semver comparison helper
func isNewer(latest, current string) bool {
	l := cleanVer(latest)
	c := cleanVer(current)
	return l > c // Basic string/lexicographical comparison for fallback if not fully parsed, but we assume semantic string rules
}

func cleanVer(v string) string {
	return strings.TrimPrefix(v, "v")
}

func toFirmwareDTO(f *models.FirmwareRelease) *FirmwareReleaseDTO {
	var createdBy string
	if f.CreatedBy != nil {
		createdBy = f.CreatedBy.String()
	}
	return &FirmwareReleaseDTO{
		ID:               f.ID.String(),
		DeviceType:       f.DeviceType,
		Version:          f.Version,
		Channel:          f.Channel,
		StoragePath:      f.StoragePath,
		ChecksumSHA256:   f.ChecksumSHA256,
		Signature:        f.Signature,
		SizeBytes:        f.SizeBytes,
		ReleaseNotes:     f.ReleaseNotes,
		IsRollbackTarget: f.IsRollbackTarget,
		CreatedBy:        &createdBy,
		CreatedAt:        f.CreatedAt,
	}
}

func (s *Service) GetDeviceTypeAndVersion(ctx context.Context, firmwareID uuid.UUID) (string, string, error) {
	fw, err := s.Get(firmwareID)
	if err != nil {
		return "", "", err
	}
	return fw.DeviceType, fw.Version, nil
}
