package sync

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Push(ctx context.Context, userID uuid.UUID, req PushSyncRequest) (*PushSyncResponse, error) {
	phoneID, err := uuid.Parse(req.PhoneID)
	if err != nil {
		return nil, errors.New("invalid phone id")
	}

	var conflicts []SyncResourceDTO
	success := true

	for _, clientRes := range req.Resources {
		existing, err := s.repo.FindRecord(userID, clientRes.ResourceType, clientRes.ResourceID)
		if err != nil {
			return nil, err
		}

		action := "create"
		if existing != nil {
			action = "update"
			if clientRes.Deleted {
				action = "delete"
			}
		}

		// Conflict Detection and LWW logic
		writeAllowed := false
		conflictResolved := false

		if existing == nil {
			writeAllowed = true
		} else {
			if clientRes.Version >= existing.Version {
				writeAllowed = true
			} else {
				// Last-Write-Wins (LWW) based on UpdatedAt
				if clientRes.UpdatedAt.After(existing.UpdatedAt) {
					writeAllowed = true
					conflictResolved = true
				}
			}
		}

		if writeAllowed {
			nextVersion := 1
			if existing != nil {
				nextVersion = existing.Version + 1
				if clientRes.Version > existing.Version {
					nextVersion = clientRes.Version + 1
				}
			}

			var rec models.CloudSyncRecord
			if existing != nil {
				rec = *existing
			} else {
				rec.ID = uuid.New()
				rec.UserID = userID
				rec.ResourceType = clientRes.ResourceType
				rec.ResourceID = clientRes.ResourceID
				rec.CreatedAt = time.Now()
			}

			rec.Data = models.JSONMap(clientRes.Data)
			rec.Version = nextVersion
			rec.Deleted = clientRes.Deleted
			rec.UpdatedAt = clientRes.UpdatedAt

			if err := s.repo.SaveRecord(&rec); err != nil {
				return nil, err
			}

			// Record history
			histAction := action
			if conflictResolved {
				histAction = "conflict_resolved"
			}
			_ = s.repo.RecordHistory(&models.SyncHistory{
				ID:               uuid.New(),
				UserID:           userID,
				ResourceType:     clientRes.ResourceType,
				ResourceID:       clientRes.ResourceID,
				Version:          nextVersion,
				Action:           histAction,
				ConflictResolved: conflictResolved,
				CreatedAt:        time.Now(),
			})

			// Update phone sync state
			state, _ := s.repo.GetSyncState(userID, phoneID, clientRes.ResourceType)
			if state == nil {
				state = &models.SyncState{
					ID:           uuid.New(),
					UserID:       userID,
					PhoneID:      phoneID,
					ResourceType: clientRes.ResourceType,
				}
			}
			state.LastSyncedVersion = nextVersion
			_ = s.repo.SaveSyncState(state)

		} else {
			// Client fails conflict check; return current server state
			success = false
			conflicts = append(conflicts, SyncResourceDTO{
				ResourceID:   existing.ResourceID,
				ResourceType: existing.ResourceType,
				Data:         map[string]any(existing.Data),
				Version:      existing.Version,
				UpdatedAt:    existing.UpdatedAt,
				Deleted:      existing.Deleted,
			})
		}
	}

	return &PushSyncResponse{
		Conflicts: conflicts,
		Success:   success,
	}, nil
}

func (s *Service) Pull(ctx context.Context, userID uuid.UUID, req PullSyncRequest) (*PullSyncResponse, error) {
	phoneID, err := uuid.Parse(req.PhoneID)
	if err != nil {
		return nil, errors.New("invalid phone id")
	}

	records, err := s.repo.FindChangesSince(userID, req.ResourceType, req.LastVersion)
	if err != nil {
		return nil, err
	}

	resDTOs := make([]SyncResourceDTO, 0, len(records))
	maxVersion := req.LastVersion

	for _, rec := range records {
		resDTOs = append(resDTOs, SyncResourceDTO{
			ResourceID:   rec.ResourceID,
			ResourceType: rec.ResourceType,
			Data:         map[string]any(rec.Data),
			Version:      rec.Version,
			UpdatedAt:    rec.UpdatedAt,
			Deleted:      rec.Deleted,
		})
		if rec.Version > maxVersion {
			maxVersion = rec.Version
		}
	}

	// Update phone sync state
	state, _ := s.repo.GetSyncState(userID, phoneID, req.ResourceType)
	if state == nil {
		state = &models.SyncState{
			ID:           uuid.New(),
			UserID:       userID,
			PhoneID:      phoneID,
			ResourceType: req.ResourceType,
		}
	}
	state.LastSyncedVersion = maxVersion
	_ = s.repo.SaveSyncState(state)

	return &PullSyncResponse{
		Resources:      resDTOs,
		CurrentVersion: maxVersion,
	}, nil
}
