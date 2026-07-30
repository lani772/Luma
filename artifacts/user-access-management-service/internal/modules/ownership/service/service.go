package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/domain/entities"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/dto"
	rolesdto "github.com/luma-smart-home/user-access-management-service/internal/modules/roles/dto"
)

var (
	ErrUnauthorized             = errors.New("unauthorized ownership management")
	ErrTransferNotFound         = errors.New("ownership transfer request not found")
	ErrTransferNotPending       = errors.New("ownership transfer request is not pending")
	ErrDuplicatePendingTransfer = errors.New("a pending ownership transfer already exists for this microcontroller")
	ErrUserNotFound             = errors.New("new owner user not found")
)

type OwnershipRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*entities.OwnershipTransfer, error)
	FindPendingByController(ctx context.Context, controllerID uuid.UUID) (*entities.OwnershipTransfer, error)
	Save(ctx context.Context, ot *entities.OwnershipTransfer) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, controllerID *uuid.UUID, email *string, status *string) ([]entities.OwnershipTransfer, error)
}

type RoleReader interface {
	GetUserRoleOnController(ctx context.Context, userID, controllerID uuid.UUID) (string, error)
}

type RoleManager interface {
	AssignRole(ctx context.Context, actorID uuid.UUID, req rolesdto.AssignRoleRequest, ip string) (*rolesdto.RoleDTO, error)
	RemoveRole(ctx context.Context, actorID uuid.UUID, id uuid.UUID, ip string) error
	ListRoles(ctx context.Context, userID, controllerID *uuid.UUID) ([]rolesdto.RoleDTO, error)
}

type UserLookup interface {
	FindUserIDByEmail(ctx context.Context, email string) (uuid.UUID, error)
}

type PermissionManager interface {
	RevokeRolePermissions(ctx context.Context, userID, controllerID uuid.UUID) error
}

type KeyManager interface {
	RevokeKeysForUser(ctx context.Context, userID, controllerID uuid.UUID) error
}

type SyncManager interface {
	CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error
}

type AuditManager interface {
	Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error
}

type Service struct {
	repo         OwnershipRepository
	roleRead     RoleReader
	roleMgr      RoleManager
	userLookup   UserLookup
	permMgr      PermissionManager
	keyMgr       KeyManager
	syncMgr      SyncManager
	auditMgr     AuditManager
}

func NewService(repo OwnershipRepository, roleRead RoleReader, roleMgr RoleManager, userLookup UserLookup, permMgr PermissionManager, keyMgr KeyManager, syncMgr SyncManager, auditMgr AuditManager) *Service {
	return &Service{
		repo:         repo,
		roleRead:     roleRead,
		roleMgr:      roleMgr,
		userLookup:   userLookup,
		permMgr:      permMgr,
		keyMgr:       keyMgr,
		syncMgr:      syncMgr,
		auditMgr:     auditMgr,
	}
}

func (s *Service) RequestTransfer(ctx context.Context, actorID uuid.UUID, req dto.RequestTransferRequest, ip string) (*dto.OwnershipTransferDTO, error) {
	controllerID, err := uuid.Parse(req.MicrocontrollerID)
	if err != nil {
		return nil, errors.New("invalid microcontroller id")
	}

	// Verify actor is the current Owner of the microcontroller
	role, err := s.roleRead.GetUserRoleOnController(ctx, actorID, controllerID)
	if err != nil {
		return nil, err
	}
	if role != "owner" {
		return nil, ErrUnauthorized
	}

	// Verify no pending transfer already exists
	existing, err := s.repo.FindPendingByController(ctx, controllerID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrDuplicatePendingTransfer
	}

	// Validate that the new owner exists
	_, err = s.userLookup.FindUserIDByEmail(ctx, req.NewOwnerEmail)
	if err != nil {
		return nil, ErrUserNotFound
	}

	ot := &entities.OwnershipTransfer{
		ID:                uuid.New(),
		MicrocontrollerID: controllerID,
		CurrentOwnerID:    actorID,
		NewOwnerEmail:     req.NewOwnerEmail,
		Status:            "pending",
		Reason:            req.Reason,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Save(ctx, ot); err != nil {
		return nil, err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, actorID, "ownership_transfer", ot.ID.String(), ot, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, actorID, "ownership.transfer_requested", "ownership_transfer", ot.ID.String(), map[string]any{
		"newOwnerEmail": req.NewOwnerEmail,
		"resourceId":    req.MicrocontrollerID,
	}, ip)

	return s.toDTO(ot), nil
}

func (s *Service) AcceptTransfer(ctx context.Context, recipientID uuid.UUID, recipientEmail string, transferID uuid.UUID, ip string) error {
	ot, err := s.repo.FindByID(ctx, transferID)
	if err != nil {
		return err
	}
	if ot == nil {
		return ErrTransferNotFound
	}

	if ot.Status != "pending" {
		return ErrTransferNotPending
	}

	if ot.NewOwnerEmail != recipientEmail {
		return ErrUnauthorized
	}

	ot.Status = "accepted"
	if err := s.repo.Save(ctx, ot); err != nil {
		return err
	}

	// 1. Revoke old owner keys and permissions
	_ = s.permMgr.RevokeRolePermissions(ctx, ot.CurrentOwnerID, ot.MicrocontrollerID)
	_ = s.keyMgr.RevokeKeysForUser(ctx, ot.CurrentOwnerID, ot.MicrocontrollerID)

	// Remove old owner role
	existingRoles, err := s.roleMgr.ListRoles(ctx, &ot.CurrentOwnerID, &ot.MicrocontrollerID)
	if err == nil {
		for _, r := range existingRoles {
			rID, err := uuid.Parse(r.ID)
			if err == nil {
				_ = s.roleMgr.RemoveRole(ctx, uuid.Nil, rID, ip)
			}
		}
	}

	// 2. Assign the new Owner role assignment (this automatically generates their owner permissions and keys!)
	_, err = s.roleMgr.AssignRole(ctx, uuid.Nil, rolesdto.AssignRoleRequest{
		UserID:            recipientID.String(),
		MicrocontrollerID: ot.MicrocontrollerID.String(),
		Role:              "owner",
	}, ip)
	if err != nil {
		return err
	}

	// 3. Downgrade previous owner to Administrator so they don't lose access outright
	_, _ = s.roleMgr.AssignRole(ctx, recipientID, rolesdto.AssignRoleRequest{
		UserID:            ot.CurrentOwnerID.String(),
		MicrocontrollerID: ot.MicrocontrollerID.String(),
		Role:              "administrator",
	}, ip)

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, recipientID, "ownership_transfer", ot.ID.String(), ot, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, recipientID, "ownership.transfer_accepted", "ownership_transfer", ot.ID.String(), map[string]any{
		"previousOwnerId": ot.CurrentOwnerID.String(),
		"newOwnerId":      recipientID.String(),
		"resourceId":      ot.MicrocontrollerID.String(),
	}, ip)

	return nil
}

func (s *Service) RejectTransfer(ctx context.Context, recipientEmail string, transferID uuid.UUID, ip string) error {
	ot, err := s.repo.FindByID(ctx, transferID)
	if err != nil {
		return err
	}
	if ot == nil {
		return ErrTransferNotFound
	}

	if ot.Status != "pending" {
		return ErrTransferNotPending
	}

	if ot.NewOwnerEmail != recipientEmail {
		return ErrUnauthorized
	}

	ot.Status = "rejected"
	if err := s.repo.Save(ctx, ot); err != nil {
		return err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, ot.CurrentOwnerID, "ownership_transfer", ot.ID.String(), ot, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, ot.CurrentOwnerID, "ownership.transfer_rejected", "ownership_transfer", ot.ID.String(), map[string]any{
		"newOwnerEmail": recipientEmail,
		"resourceId":    ot.MicrocontrollerID.String(),
	}, ip)

	return nil
}

func (s *Service) EmergencyRecovery(ctx context.Context, targetControllerID uuid.UUID, newOwnerEmail string, verificationDetails string, ip string) error {
	// Identity verification and manual admin override to force assign a new owner to a microcontroller
	newOwnerID, err := s.userLookup.FindUserIDByEmail(ctx, newOwnerEmail)
	if err != nil {
		return ErrUserNotFound
	}

	// Fetch current owner
	oldOwnerID, err := s.roleRead.GetUserRoleOnController(ctx, uuid.Nil, targetControllerID) // Nil user role fetch on microcontroller finds current owner
	var oldOwnerUUID uuid.UUID
	if err == nil && oldOwnerID != "" {
		// Old owner exists, let's revoke their access
		oldOwnerUUID, _ = uuid.Parse(oldOwnerID)
		_ = s.permMgr.RevokeRolePermissions(ctx, oldOwnerUUID, targetControllerID)
		_ = s.keyMgr.RevokeKeysForUser(ctx, oldOwnerUUID, targetControllerID)
	}

	// Remove all old role assignments for this microcontroller
	existingRoles, err := s.roleMgr.ListRoles(ctx, nil, &targetControllerID)
	if err == nil {
		for _, r := range existingRoles {
			rID, _ := uuid.Parse(r.ID)
			_ = s.roleMgr.RemoveRole(ctx, uuid.Nil, rID, ip)
		}
	}

	// Assign the new owner role
	_, err = s.roleMgr.AssignRole(ctx, uuid.Nil, rolesdto.AssignRoleRequest{
		UserID:            newOwnerID.String(),
		MicrocontrollerID: targetControllerID.String(),
		Role:              "owner",
	}, ip)
	if err != nil {
		return err
	}

	// Audit log
	_ = s.auditMgr.Record(ctx, uuid.Nil, "ownership.emergency_recovery", "microcontroller", targetControllerID.String(), map[string]any{
		"newOwnerId":          newOwnerID.String(),
		"previousOwnerId":     oldOwnerUUID.String(),
		"verificationDetails": verificationDetails,
	}, ip)

	return nil
}

func (s *Service) ListTransfers(ctx context.Context, controllerID *uuid.UUID, email *string, status *string) ([]dto.OwnershipTransferDTO, error) {
	list, err := s.repo.List(ctx, controllerID, email, status)
	if err != nil {
		return nil, err
	}
	out := make([]dto.OwnershipTransferDTO, len(list))
	for i, ot := range list {
		out[i] = *s.toDTO(&ot)
	}
	return out, nil
}

func (s *Service) toDTO(ot *entities.OwnershipTransfer) *dto.OwnershipTransferDTO {
	return &dto.OwnershipTransferDTO{
		ID:                ot.ID.String(),
		MicrocontrollerID: ot.MicrocontrollerID.String(),
		CurrentOwnerID:    ot.CurrentOwnerID.String(),
		NewOwnerEmail:     ot.NewOwnerEmail,
		Status:            ot.Status,
		Reason:            ot.Reason,
		CreatedAt:         ot.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         ot.UpdatedAt.Format(time.RFC3339),
	}
}
