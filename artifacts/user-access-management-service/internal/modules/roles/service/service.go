package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/roles/domain/entities"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/roles/dto"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/roles/repository"
)

var (
	ErrUnauthorized      = errors.New("unauthorized role management")
	ErrRoleNotFound      = errors.New("role assignment not found")
	ErrOneOwnerOnly      = errors.New("microcontroller must have exactly one owner")
	ErrCannotRemoveOwner = errors.New("cannot remove microcontroller owner without transfer")
)

type PermissionManager interface {
	GrantRolePermissions(ctx context.Context, userID, controllerID uuid.UUID, role string, grantedBy uuid.UUID) error
	RevokeRolePermissions(ctx context.Context, userID, controllerID uuid.UUID) error
}

type KeyManager interface {
	GenerateKeysForUser(ctx context.Context, userID uuid.UUID, controllerID uuid.UUID) error
	RevokeKeysForUser(ctx context.Context, userID uuid.UUID, controllerID uuid.UUID) error
}

type SyncManager interface {
	CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error
}

type AuditManager interface {
	Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error
}

type Service struct {
	repo       *repository.Repository
	permMgr    PermissionManager
	keyMgr     KeyManager
	syncMgr    SyncManager
	auditMgr   AuditManager
}

func NewService(repo *repository.Repository, permMgr PermissionManager, keyMgr KeyManager, syncMgr SyncManager, auditMgr AuditManager) *Service {
	return &Service{
		repo:       repo,
		permMgr:    permMgr,
		keyMgr:     keyMgr,
		syncMgr:    syncMgr,
		auditMgr:   auditMgr,
	}
}

func (s *Service) GetUserRoleOnController(ctx context.Context, userID, controllerID uuid.UUID) (string, error) {
	assign, err := s.repo.FindByUserAndController(ctx, userID, controllerID)
	if err != nil {
		return "", err
	}
	if assign == nil {
		return "", nil
	}
	return assign.Role, nil
}

func (s *Service) FindOwner(ctx context.Context, controllerID uuid.UUID) (uuid.UUID, error) {
	assign, err := s.repo.FindOwner(ctx, controllerID)
	if err != nil {
		return uuid.Nil, err
	}
	if assign == nil {
		return uuid.Nil, nil
	}
	return assign.UserID, nil
}

func (s *Service) AssignRole(ctx context.Context, actorID uuid.UUID, req dto.AssignRoleRequest, ip string) (*dto.RoleDTO, error) {
	controllerID, err := uuid.Parse(req.MicrocontrollerID)
	if err != nil {
		return nil, errors.New("invalid microcontroller id")
	}
	targetUserID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, errors.New("invalid target user id")
	}

	// Verify requester is authorized (only Owner can assign roles, except Owner assignment during registration)
	if actorID != uuid.Nil {
		ownerAss, err := s.repo.FindOwner(ctx, controllerID)
		if err != nil {
			return nil, err
		}
		if ownerAss == nil || ownerAss.UserID != actorID {
			return nil, ErrUnauthorized
		}
	}

	// Enforce One Owner constraint
	if req.Role == "owner" {
		existingOwner, err := s.repo.FindOwner(ctx, controllerID)
		if err != nil {
			return nil, err
		}
		if existingOwner != nil {
			return nil, ErrOneOwnerOnly
		}
	}

	// Remove any existing role for this user and microcontroller
	existing, err := s.repo.FindByUserAndController(ctx, targetUserID, controllerID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		_ = s.repo.Delete(ctx, existing.ID)
		_ = s.permMgr.RevokeRolePermissions(ctx, targetUserID, controllerID)
		_ = s.keyMgr.RevokeKeysForUser(ctx, targetUserID, controllerID)
	}

	assign := &entities.RoleAssignment{
		ID:                uuid.New(),
		UserID:            targetUserID,
		MicrocontrollerID: controllerID,
		Role:              req.Role,
		AssignedBy:        actorID,
		Status:            "active",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Save(ctx, assign); err != nil {
		return nil, err
	}

	// Automatically generate permissions and keys
	_ = s.permMgr.GrantRolePermissions(ctx, targetUserID, controllerID, req.Role, actorID)
	_ = s.keyMgr.GenerateKeysForUser(ctx, targetUserID, controllerID)

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, targetUserID, "role", assign.ID.String(), assign, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, actorID, "role.assigned", "role", assign.ID.String(), map[string]any{
		"targetUserId": targetUserID.String(),
		"role":         req.Role,
	}, ip)

	return s.toDTO(assign), nil
}

func (s *Service) UpdateRole(ctx context.Context, actorID uuid.UUID, id uuid.UUID, req dto.UpdateRoleRequest, ip string) (*dto.RoleDTO, error) {
	assign, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if assign == nil {
		return nil, ErrRoleNotFound
	}

	// Verify requester is authorized (only Owner can update roles)
	ownerAss, err := s.repo.FindOwner(ctx, assign.MicrocontrollerID)
	if err != nil {
		return nil, err
	}
	if ownerAss == nil || ownerAss.UserID != actorID {
		return nil, ErrUnauthorized
	}

	// Cannot downgrade the current owner this way
	if assign.Role == "owner" && req.Role != "owner" {
		return nil, ErrCannotRemoveOwner
	}

	// If changing to owner, prevent double owners
	if req.Role == "owner" && assign.Role != "owner" {
		return nil, ErrOneOwnerOnly
	}

	assign.Role = req.Role
	assign.UpdatedAt = time.Now()

	if err := s.repo.Save(ctx, assign); err != nil {
		return nil, err
	}

	// Re-recalculate permissions and rotate keys
	_ = s.permMgr.RevokeRolePermissions(ctx, assign.UserID, assign.MicrocontrollerID)
	_ = s.permMgr.GrantRolePermissions(ctx, assign.UserID, assign.MicrocontrollerID, req.Role, actorID)

	_ = s.keyMgr.RevokeKeysForUser(ctx, assign.UserID, assign.MicrocontrollerID)
	_ = s.keyMgr.GenerateKeysForUser(ctx, assign.UserID, assign.MicrocontrollerID)

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, assign.UserID, "role", assign.ID.String(), assign, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, actorID, "role.updated", "role", assign.ID.String(), map[string]any{
		"targetUserId": assign.UserID.String(),
		"role":         req.Role,
	}, ip)

	return s.toDTO(assign), nil
}

func (s *Service) RemoveRole(ctx context.Context, actorID uuid.UUID, id uuid.UUID, ip string) error {
	assign, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if assign == nil {
		return ErrRoleNotFound
	}

	// Cannot remove owner
	if assign.Role == "owner" {
		return ErrCannotRemoveOwner
	}

	// Verify requester is authorized (only Owner can remove roles)
	ownerAss, err := s.repo.FindOwner(ctx, assign.MicrocontrollerID)
	if err != nil {
		return err
	}
	if ownerAss == nil || ownerAss.UserID != actorID {
		return ErrUnauthorized
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}

	// Remove associated permissions and keys
	_ = s.permMgr.RevokeRolePermissions(ctx, assign.UserID, assign.MicrocontrollerID)
	_ = s.keyMgr.RevokeKeysForUser(ctx, assign.UserID, assign.MicrocontrollerID)

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, assign.UserID, "role", assign.ID.String(), assign, true)

	// Audit log
	_ = s.auditMgr.Record(ctx, actorID, "role.removed", "role", assign.ID.String(), map[string]any{
		"targetUserId": assign.UserID.String(),
	}, ip)

	return nil
}

func (s *Service) ListRoles(ctx context.Context, userID, controllerID *uuid.UUID) ([]dto.RoleDTO, error) {
	list, err := s.repo.List(ctx, userID, controllerID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.RoleDTO, len(list))
	for i, r := range list {
		out[i] = *s.toDTO(&r)
	}
	return out, nil
}

func (s *Service) toDTO(a *entities.RoleAssignment) *dto.RoleDTO {
	return &dto.RoleDTO{
		ID:                a.ID.String(),
		UserID:            a.UserID.String(),
		MicrocontrollerID: a.MicrocontrollerID.String(),
		Role:              a.Role,
		AssignedBy:        a.AssignedBy.String(),
		Status:            a.Status,
		CreatedAt:         a.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         a.UpdatedAt.Format(time.RFC3339),
	}
}
