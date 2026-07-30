package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/domain/entities"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/dto"
)

var (
	ErrUnauthorized       = errors.New("unauthorized permission management")
	ErrPermissionNotFound = errors.New("permission not found")
)

type PermissionsRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*entities.Permission, error)
	FindExact(ctx context.Context, userID, controllerID uuid.UUID, resourceID string, resourceType string) (*entities.Permission, error)
	Save(ctx context.Context, perm *entities.Permission) error
	Delete(ctx context.Context, id uuid.UUID) error
	DeleteUserPermissions(ctx context.Context, userID, controllerID uuid.UUID) error
	List(ctx context.Context, userID, controllerID *uuid.UUID, resourceID, resourceType, status *string) ([]entities.Permission, error)
	FindActiveForUserAndController(ctx context.Context, userID, controllerID uuid.UUID) ([]entities.Permission, error)
	FindExpired(ctx context.Context) ([]entities.Permission, error)
}

type RoleReader interface {
	GetUserRoleOnController(ctx context.Context, userID, controllerID uuid.UUID) (string, error)
}

type SyncManager interface {
	CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error
}

type AuditManager interface {
	Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error
}

type Service struct {
	repo     PermissionsRepository
	roleRead RoleReader
	syncMgr  SyncManager
	auditMgr AuditManager
}

func NewService(repo PermissionsRepository, roleRead RoleReader, syncMgr SyncManager, auditMgr AuditManager) *Service {
	return &Service{
		repo:     repo,
		roleRead: roleRead,
		syncMgr:  syncMgr,
		auditMgr: auditMgr,
	}
}

// GrantRolePermissions is called automatically when a role is assigned or updated
func (s *Service) GrantRolePermissions(ctx context.Context, userID, controllerID uuid.UUID, role string, grantedBy uuid.UUID) error {
	var actions []string
	switch role {
	case "owner":
		actions = []string{"view", "control", "configure", "schedule", "share", "manage", "firmware"}
	case "administrator":
		actions = []string{"view", "control", "configure", "schedule", "share", "manage"}
	case "operator":
		actions = []string{"view", "control"}
	case "viewer":
		actions = []string{"view"}
	default:
		return errors.New("invalid role for automatic permissions")
	}

	perm := &entities.Permission{
		ID:                uuid.New(),
		UserID:            userID,
		MicrocontrollerID: controllerID,
		ResourceID:        controllerID.String(),
		ResourceType:      "microcontroller",
		AllowedActions:    actions,
		GrantedBy:         grantedBy,
		RoleSource:        role,
		Status:            "active",
		Temporary:         false,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Save(ctx, perm); err != nil {
		return err
	}

	_ = s.syncMgr.CreateSyncRecord(ctx, userID, "permission", perm.ID.String(), perm, false)
	return nil
}

func (s *Service) RevokeRolePermissions(ctx context.Context, userID, controllerID uuid.UUID) error {
	perms, err := s.repo.FindActiveForUserAndController(ctx, userID, controllerID)
	if err == nil {
		for _, p := range perms {
			_ = s.syncMgr.CreateSyncRecord(ctx, userID, "permission", p.ID.String(), p, true)
		}
	}
	return s.repo.DeleteUserPermissions(ctx, userID, controllerID)
}

func (s *Service) GrantPermission(ctx context.Context, actorID uuid.UUID, req dto.GrantPermissionRequest, ip string) (*dto.PermissionDTO, error) {
	controllerID, err := uuid.Parse(req.MicrocontrollerID)
	if err != nil {
		return nil, errors.New("invalid microcontroller id")
	}
	targetUserID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, errors.New("invalid target user id")
	}

	// Verify requester is Owner/Admin
	if actorID != uuid.Nil {
		role, err := s.roleRead.GetUserRoleOnController(ctx, actorID, controllerID)
		if err != nil {
			return nil, err
		}
		if role != "owner" && role != "administrator" {
			return nil, ErrUnauthorized
		}
	}

	var startTime, endTime *time.Time
	if req.Temporary {
		if req.StartTime != nil && *req.StartTime != "" {
			t, err := time.Parse(time.RFC3339, *req.StartTime)
			if err != nil {
				return nil, errors.New("invalid start_time format")
			}
			startTime = &t
		}
		if req.EndTime != nil && *req.EndTime != "" {
			t, err := time.Parse(time.RFC3339, *req.EndTime)
			if err != nil {
				return nil, errors.New("invalid end_time format")
			}
			endTime = &t
		} else {
			return nil, errors.New("end_time is required for temporary permissions")
		}
	}

	// Clean/replace existing permission for exact same user/resource/type
	existing, err := s.repo.FindExact(ctx, targetUserID, controllerID, req.ResourceID, req.ResourceType)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		_ = s.repo.Delete(ctx, existing.ID)
	}

	perm := &entities.Permission{
		ID:                uuid.New(),
		UserID:            targetUserID,
		MicrocontrollerID: controllerID,
		ResourceID:        req.ResourceID,
		ResourceType:      req.ResourceType,
		AllowedActions:    req.AllowedActions,
		GrantedBy:         actorID,
		RoleSource:        "custom",
		Status:            "active",
		Temporary:         req.Temporary,
		StartTime:         startTime,
		EndTime:           endTime,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Save(ctx, perm); err != nil {
		return nil, err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, targetUserID, "permission", perm.ID.String(), perm, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, actorID, "permission.granted", "permission", perm.ID.String(), map[string]any{
		"targetUserId":   targetUserID.String(),
		"resourceId":     req.ResourceID,
		"resourceType":   req.ResourceType,
		"allowedActions": req.AllowedActions,
	}, ip)

	return s.toDTO(perm), nil
}

func (s *Service) CheckPermission(ctx context.Context, req dto.CheckPermissionRequest) (*dto.CheckPermissionResponse, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}
	controllerID, err := uuid.Parse(req.MicrocontrollerID)
	if err != nil {
		return nil, errors.New("invalid microcontroller id")
	}

	// 1. Owner always has access
	role, err := s.roleRead.GetUserRoleOnController(ctx, userID, controllerID)
	if err == nil && role == "owner" {
		return &dto.CheckPermissionResponse{Allowed: true}, nil
	}

	// 2. Fetch active permissions for user on controller
	perms, err := s.repo.FindActiveForUserAndController(ctx, userID, controllerID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	for _, p := range perms {
		// Verify temporary bounds
		if p.Temporary {
			if p.StartTime != nil && now.Before(*p.StartTime) {
				continue
			}
			if p.EndTime != nil && now.After(*p.EndTime) {
				// Expired, but clean up worker will officially mark it as expired. For check, we treat as expired.
				continue
			}
		}

		// Check if action is allowed
		actionAllowed := false
		for _, act := range p.AllowedActions {
			if act == req.Action {
				actionAllowed = true
				break
			}
		}
		if !actionAllowed {
			continue
		}

		// Check if direct resource matches, or microcontroller-level wildcard matches
		if p.ResourceID == req.ResourceID || p.ResourceType == "microcontroller" {
			return &dto.CheckPermissionResponse{Allowed: true}, nil
		}
	}

	return &dto.CheckPermissionResponse{Allowed: false, Reason: "ACCESS_DENIED"}, nil
}

func (s *Service) RevokePermission(ctx context.Context, actorID uuid.UUID, id uuid.UUID, ip string) error {
	perm, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if perm == nil {
		return ErrPermissionNotFound
	}

	// Verify actor is Owner/Admin on the controller
	if actorID != uuid.Nil {
		role, err := s.roleRead.GetUserRoleOnController(ctx, actorID, perm.MicrocontrollerID)
		if err != nil {
			return err
		}
		if role != "owner" && role != "administrator" {
			return ErrUnauthorized
		}
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	// Sync revocation
	_ = s.syncMgr.CreateSyncRecord(ctx, perm.UserID, "permission", perm.ID.String(), perm, true)

	// Audit log
	_ = s.auditMgr.Record(ctx, actorID, "permission.revoked", "permission", perm.ID.String(), map[string]any{
		"targetUserId": perm.UserID.String(),
		"resourceId":   perm.ResourceID,
	}, ip)

	return nil
}

func (s *Service) ListPermissions(ctx context.Context, userID, controllerID *uuid.UUID, resourceID, resourceType, status *string) ([]dto.PermissionDTO, error) {
	list, err := s.repo.List(ctx, userID, controllerID, resourceID, resourceType, status)
	if err != nil {
		return nil, err
	}
	out := make([]dto.PermissionDTO, len(list))
	for i, p := range list {
		out[i] = *s.toDTO(&p)
	}
	return out, nil
}

func (s *Service) toDTO(p *entities.Permission) *dto.PermissionDTO {
	var start, end *string
	if p.StartTime != nil {
		s := p.StartTime.Format(time.RFC3339)
		start = &s
	}
	if p.EndTime != nil {
		s := p.EndTime.Format(time.RFC3339)
		end = &s
	}

	return &dto.PermissionDTO{
		ID:                p.ID.String(),
		UserID:            p.UserID.String(),
		MicrocontrollerID: p.MicrocontrollerID.String(),
		ResourceID:        p.ResourceID,
		ResourceType:      p.ResourceType,
		AllowedActions:    p.AllowedActions,
		GrantedBy:         p.GrantedBy.String(),
		RoleSource:        p.RoleSource,
		Status:            p.Status,
		Temporary:         p.Temporary,
		StartTime:         start,
		EndTime:           end,
		CreatedAt:         p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         p.UpdatedAt.Format(time.RFC3339),
	}
}
