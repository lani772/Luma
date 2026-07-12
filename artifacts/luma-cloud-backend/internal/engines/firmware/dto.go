package firmware

import "time"

type UploadFirmwareRequest struct {
	DeviceType       string  `form:"deviceType" binding:"required"`
	Version          string  `form:"version" binding:"required"`
	Channel          string  `form:"channel" binding:"required,oneof=stable beta"`
	ReleaseNotes     *string `form:"releaseNotes"`
	Signature        *string `form:"signature"`
	IsRollbackTarget bool    `form:"isRollbackTarget"`
}

type PublishFirmwareRequest struct {
	Channel string `json:"channel" binding:"required,oneof=stable beta"`
}

type ArchiveFirmwareRequest struct {
	IsRollbackTarget bool `json:"isRollbackTarget"`
}

type FirmwareReleaseDTO struct {
	ID               string    `json:"id"`
	DeviceType       string    `json:"deviceType"`
	Version          string    `json:"version"`
	Channel          string    `json:"channel"`
	StoragePath      string    `json:"storagePath"`
	ChecksumSHA256   string    `json:"checksumSha256"`
	Signature        *string   `json:"signature,omitempty"`
	SizeBytes        int64     `json:"sizeBytes"`
	ReleaseNotes     *string   `json:"releaseNotes,omitempty"`
	IsRollbackTarget bool      `json:"isRollbackTarget"`
	CreatedBy        *string   `json:"createdBy,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
}

type FirmwareDownloadDTO struct {
	ID           string    `json:"id"`
	FirmwareID   string    `json:"firmwareId"`
	DeviceID     *string   `json:"deviceId,omitempty"`
	IPAddress    *string   `json:"ipAddress,omitempty"`
	DownloadedAt time.Time `json:"downloadedAt"`
}

type VersionComparisonDTO struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	NeedsUpdate    bool   `json:"needsUpdate"`
	Channel        string `json:"channel"`
}
