package admin

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"github.com/luma-smart-home/cloud-backend/internal/httputil"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrCannotTargetSelf   = errors.New("cannot modify your own account via admin endpoint")
	ErrCannotDowngradeOwner = errors.New("cannot change the role of another owner; transfer ownership through the devices engine instead")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListUsers(ctx context.Context, role, status string, page, perPage int) ([]UserSummaryDTO, int64, error) {
	page, perPage = httputil.Paginate(page, perPage)
	users, total, err := s.repo.ListUsers(ctx, role, status, page, perPage)
	if err != nil {
		return nil, 0, fmt.Errorf("admin: list users: %w", err)
	}
	dtos := make([]UserSummaryDTO, 0, len(users))
	for _, u := range users {
		dto := toUserSummaryDTO(&u)
		// Best-effort last-seen lookup; ignore errors to keep listing fast.
		if lastSeen, err := s.repo.LastSeenAt(ctx, u.ID); err == nil {
			dto.LastSeenAt = lastSeen
		}
		dtos = append(dtos, dto)
	}
	return dtos, total, nil
}

func (s *Service) GetUser(ctx context.Context, targetID uuid.UUID) (*UserSummaryDTO, error) {
	u, err := s.repo.FindUserByID(ctx, targetID)
	if err != nil {
		return nil, err
	}
	dto := toUserSummaryDTO(u)
	if lastSeen, err := s.repo.LastSeenAt(ctx, u.ID); err == nil {
		dto.LastSeenAt = lastSeen
	}
	return &dto, nil
}

// UpdateRole changes a target user's role. The acting user's ID and role are
// used to prevent self-modification and to record the audit trail.
func (s *Service) UpdateRole(ctx context.Context, actorID uuid.UUID, actorRole, ipAddress string, targetID uuid.UUID, newRole models.UserRole) error {
	if actorID == targetID {
		return ErrCannotTargetSelf
	}
	target, err := s.repo.FindUserByID(ctx, targetID)
	if err != nil {
		return err
	}
	if target.Role == models.RoleOwner && newRole != models.RoleOwner {
		return ErrCannotDowngradeOwner
	}

	prevRole := string(target.Role)
	if err := s.repo.UpdateRole(ctx, targetID, newRole); err != nil {
		return fmt.Errorf("admin: update role: %w", err)
	}

	_ = s.audit(ctx, actorID, actorRole, ipAddress, &targetID, nil,
		models.AuditActionRoleChanged,
		map[string]any{"from_role": prevRole, "to_role": string(newRole)},
	)
	return nil
}

// UpdateStatus suspends or re-activates a user account.
func (s *Service) UpdateStatus(ctx context.Context, actorID uuid.UUID, actorRole, ipAddress string, targetID uuid.UUID, newStatus models.UserStatus) error {
	if actorID == targetID {
		return ErrCannotTargetSelf
	}
	if _, err := s.repo.FindUserByID(ctx, targetID); err != nil {
		return err
	}
	if err := s.repo.UpdateStatus(ctx, targetID, newStatus); err != nil {
		return fmt.Errorf("admin: update status: %w", err)
	}

	action := models.AuditActionUserActivated
	if newStatus == models.UserStatusSuspended {
		action = models.AuditActionUserSuspended
	}
	_ = s.audit(ctx, actorID, actorRole, ipAddress, &targetID, nil, action, nil)
	return nil
}

// ForceDelete permanently removes a user and all their session/phone records.
func (s *Service) ForceDelete(ctx context.Context, actorID uuid.UUID, actorRole, ipAddress string, targetID uuid.UUID) error {
	if actorID == targetID {
		return ErrCannotTargetSelf
	}
	if _, err := s.repo.FindUserByID(ctx, targetID); err != nil {
		return err
	}
	if err := s.repo.ForceDeleteUser(ctx, targetID); err != nil {
		return fmt.Errorf("admin: force delete: %w", err)
	}
	_ = s.audit(ctx, actorID, actorRole, ipAddress, &targetID, nil, models.AuditActionUserDeletedAdmin, nil)
	return nil
}

// ListAuditLogs returns paginated audit entries with optional filters.
func (s *Service) ListAuditLogs(ctx context.Context, actorFilter, targetFilter, action string, page, perPage int) ([]AuditLogEntryDTO, int64, error) {
	page, perPage = httputil.Paginate(page, perPage)

	var actorID, targetID *uuid.UUID
	if actorFilter != "" {
		id, err := uuid.Parse(actorFilter)
		if err != nil {
			return nil, 0, errors.New("invalid actor_id filter")
		}
		actorID = &id
	}
	if targetFilter != "" {
		id, err := uuid.Parse(targetFilter)
		if err != nil {
			return nil, 0, errors.New("invalid target_id filter")
		}
		targetID = &id
	}

	entries, total, err := s.repo.ListAuditLogs(ctx, actorID, targetID, action, page, perPage)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]AuditLogEntryDTO, 0, len(entries))
	for _, e := range entries {
		dtos = append(dtos, toAuditLogDTO(&e))
	}
	return dtos, total, nil
}

// RecordAudit is the public entry point for other engines that want to log
// audit events (e.g. devices engine for ownership transfers).
func (s *Service) RecordAudit(ctx context.Context, actorID uuid.UUID, actorRole, ipAddress string, targetUserID, targetDeviceID *uuid.UUID, action models.AuditAction, details map[string]any) {
	_ = s.audit(ctx, actorID, actorRole, ipAddress, targetUserID, targetDeviceID, action, details)
}

func (s *Service) audit(ctx context.Context, actorID uuid.UUID, actorRole, ipAddress string, targetUserID, targetDeviceID *uuid.UUID, action models.AuditAction, details map[string]any) error {
	entry := &models.AuditLog{
		ID:          uuid.New(),
		ActorRole:   actorRole,
		Action:      action,
		CreatedAt:   time.Now(),
	}
	entry.ActorUserID = &actorID
	if targetUserID != nil {
		entry.TargetUserID = targetUserID
	}
	if targetDeviceID != nil {
		entry.TargetDeviceID = targetDeviceID
	}
	if details != nil {
		entry.Details = models.JSONMap(details)
	}
	if ipAddress != "" {
		entry.IPAddress = &ipAddress
	}
	return s.repo.InsertAuditLog(ctx, entry)
}

// --- DTO helpers ---

func toUserSummaryDTO(u *models.User) UserSummaryDTO {
	username := ""
	if u.Username != nil {
		username = *u.Username
	}
	return UserSummaryDTO{
		ID:               u.ID.String(),
		Email:            u.Email,
		Username:         username,
		FullName:         u.FullName,
		Role:             string(u.Role),
		Status:           string(u.Status),
		SubscriptionTier: u.SubscriptionTier,
		EmailVerified:    u.EmailVerifiedAt != nil,
		CreatedAt:        u.CreatedAt,
	}
}

func toAuditLogDTO(e *models.AuditLog) AuditLogEntryDTO {
	dto := AuditLogEntryDTO{
		ID:        e.ID.String(),
		ActorRole: e.ActorRole,
		Action:    string(e.Action),
		Details:   map[string]any(e.Details),
		IPAddress: e.IPAddress,
		CreatedAt: e.CreatedAt,
	}
	if e.ActorUserID != nil {
		s := e.ActorUserID.String()
		dto.ActorUserID = &s
	}
	if e.TargetUserID != nil {
		s := e.TargetUserID.String()
		dto.TargetUserID = &s
	}
	if e.TargetDeviceID != nil {
		s := e.TargetDeviceID.String()
		dto.TargetDeviceID = &s
	}
	return dto
}
