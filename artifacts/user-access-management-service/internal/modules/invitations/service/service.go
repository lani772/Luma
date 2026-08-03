package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/domain/entities"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/dto"
	rolesdto "github.com/luma-smart-home/user-access-management-service/internal/modules/roles/dto"
)

var (
	ErrUnauthorized        = errors.New("unauthorized invitation management")
	ErrInvitationNotFound  = errors.New("invitation not found")
	ErrInvitationNotPending = errors.New("invitation is not pending")
	ErrInvitationExpired   = errors.New("invitation has expired")
)

type InvitationRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*entities.Invitation, error)
	Save(ctx context.Context, inv *entities.Invitation) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, senderID *uuid.UUID, recipientEmail *string, status *string) ([]entities.Invitation, error)
	FindExpired(ctx context.Context) ([]entities.Invitation, error)
}

type RoleReader interface {
	GetUserRoleOnController(ctx context.Context, userID, controllerID uuid.UUID) (string, error)
}

type RoleAssigner interface {
	AssignRole(ctx context.Context, actorID uuid.UUID, req rolesdto.AssignRoleRequest, ip string) (*rolesdto.RoleDTO, error)
}

type SyncManager interface {
	CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error
}

type AuditManager interface {
	Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error
}

type Service struct {
	repo         InvitationRepository
	roleRead     RoleReader
	roleAssigner RoleAssigner
	syncMgr      SyncManager
	auditMgr     AuditManager
}

func NewService(repo InvitationRepository, roleRead RoleReader, roleAssigner RoleAssigner, syncMgr SyncManager, auditMgr AuditManager) *Service {
	return &Service{
		repo:         repo,
		roleRead:     roleRead,
		roleAssigner: roleAssigner,
		syncMgr:      syncMgr,
		auditMgr:     auditMgr,
	}
}

func (s *Service) CreateInvitation(ctx context.Context, actorID uuid.UUID, req dto.CreateInvitationRequest, ip string) (*dto.InvitationDTO, error) {
	controllerID, err := uuid.Parse(req.ResourceID)
	if err != nil {
		return nil, errors.New("invalid resource microcontroller id")
	}

	// Verify actor is Owner or Admin on controller
	role, err := s.roleRead.GetUserRoleOnController(ctx, actorID, controllerID)
	if err != nil {
		return nil, err
	}
	if role != "owner" && role != "administrator" {
		return nil, ErrUnauthorized
	}

	inv := &entities.Invitation{
		ID:              uuid.New(),
		SenderID:        actorID,
		RecipientEmail:  req.RecipientEmail,
		RecipientPhone:  req.RecipientPhone,
		ResourceID:      req.ResourceID,
		ResourceType:    req.ResourceType,
		PermissionLevel: req.PermissionLevel,
		PersonalMessage: req.PersonalMessage,
		Status:          "pending",
		ExpiresAt:       time.Now().Add(7 * 24 * time.Hour), // 7 days default TTL
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.repo.Save(ctx, inv); err != nil {
		return nil, err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, actorID, "invitation", inv.ID.String(), inv, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, actorID, "invitation.created", "invitation", inv.ID.String(), map[string]any{
		"recipientEmail":  req.RecipientEmail,
		"resourceId":      req.ResourceID,
		"permissionLevel": req.PermissionLevel,
	}, ip)

	return s.toDTO(inv), nil
}

func (s *Service) AcceptInvitation(ctx context.Context, recipientID uuid.UUID, id uuid.UUID, ip string) error {
	inv, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if inv == nil {
		return ErrInvitationNotFound
	}

	if inv.Status != "pending" {
		return ErrInvitationNotPending
	}

	if time.Now().After(inv.ExpiresAt) {
		inv.Status = "expired"
		_ = s.repo.Save(ctx, inv)
		return ErrInvitationExpired
	}

	inv.Status = "accepted"
	if err := s.repo.Save(ctx, inv); err != nil {
		return err
	}

	// Trigger automatic Role Assignment, Permissions, Keys, Sync, Auditing
	_, err = s.roleAssigner.AssignRole(ctx, inv.SenderID, rolesdto.AssignRoleRequest{
		UserID:            recipientID.String(),
		MicrocontrollerID: inv.ResourceID,
		Role:              inv.PermissionLevel,
	}, ip)
	if err != nil {
		return err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, recipientID, "invitation", inv.ID.String(), inv, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, recipientID, "invitation.accepted", "invitation", inv.ID.String(), map[string]any{
		"senderId":   inv.SenderID.String(),
		"resourceId": inv.ResourceID,
	}, ip)

	return nil
}

func (s *Service) RejectInvitation(ctx context.Context, recipientID uuid.UUID, id uuid.UUID, ip string) error {
	inv, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if inv == nil {
		return ErrInvitationNotFound
	}

	if inv.Status != "pending" {
		return ErrInvitationNotPending
	}

	inv.Status = "rejected"
	if err := s.repo.Save(ctx, inv); err != nil {
		return err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, recipientID, "invitation", inv.ID.String(), inv, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, recipientID, "invitation.rejected", "invitation", inv.ID.String(), map[string]any{
		"senderId":   inv.SenderID.String(),
		"resourceId": inv.ResourceID,
	}, ip)

	return nil
}

func (s *Service) ListInvitations(ctx context.Context, senderID *uuid.UUID, recipientEmail *string, status *string) ([]dto.InvitationDTO, error) {
	list, err := s.repo.List(ctx, senderID, recipientEmail, status)
	if err != nil {
		return nil, err
	}
	out := make([]dto.InvitationDTO, len(list))
	for i, inv := range list {
		out[i] = *s.toDTO(&inv)
	}
	return out, nil
}

func (s *Service) toDTO(inv *entities.Invitation) *dto.InvitationDTO {
	return &dto.InvitationDTO{
		ID:              inv.ID.String(),
		SenderID:        inv.SenderID.String(),
		RecipientEmail:  inv.RecipientEmail,
		RecipientPhone:  inv.RecipientPhone,
		ResourceID:      inv.ResourceID,
		ResourceType:    inv.ResourceType,
		PermissionLevel: inv.PermissionLevel,
		PersonalMessage: inv.PersonalMessage,
		Status:          inv.Status,
		ExpiresAt:       inv.ExpiresAt.Format(time.RFC3339),
		CreatedAt:       inv.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       inv.UpdatedAt.Format(time.RFC3339),
	}
}
