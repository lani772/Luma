package sync

import "time"

type SyncResourceDTO struct {
	ResourceID   string         `json:"resourceId" binding:"required"`
	ResourceType string         `json:"resourceType" binding:"required"`
	Data         map[string]any `json:"data"`
	Version      int            `json:"version" binding:"required"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	Deleted      bool           `json:"deleted"`
}

type PushSyncRequest struct {
	PhoneID   string            `json:"phoneId" binding:"required,uuid"`
	Resources []SyncResourceDTO `json:"resources" binding:"required,dive"`
}

type PushSyncResponse struct {
	Conflicts []SyncResourceDTO `json:"conflicts"`
	Success   bool              `json:"success"`
}

type PullSyncRequest struct {
	PhoneID      string `json:"phoneId" binding:"required,uuid"`
	ResourceType string `json:"resourceType" binding:"required"`
	LastVersion  int    `json:"lastVersion"`
}

type PullSyncResponse struct {
	Resources      []SyncResourceDTO `json:"resources"`
	CurrentVersion int               `json:"currentVersion"`
}
