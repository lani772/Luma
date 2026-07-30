package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/dto"
)

func (s *Service) BulkGrantPermissions(ctx context.Context, actorID uuid.UUID, reqs []dto.GrantPermissionRequest, ip string) ([]dto.PermissionDTO, error) {
	var results []dto.PermissionDTO
	for _, req := range reqs {
		res, err := s.GrantPermission(ctx, actorID, req, ip)
		if err != nil {
			return nil, err
		}
		results = append(results, *res)
	}
	return results, nil
}

func (s *Service) EmergencyRevoke(ctx context.Context, actorID uuid.UUID, targetUserIDStr, controllerIDStr string, ip string) error {
	controllerID, err := uuid.Parse(controllerIDStr)
	if err != nil {
		return errors.New("invalid microcontroller id")
	}

	// Verify actor is Owner
	role, err := s.roleRead.GetUserRoleOnController(ctx, actorID, controllerID)
	if err != nil || role != "owner" {
		return ErrUnauthorized
	}

	// Fetch matched permissions to sync revocation
	list, err := s.repo.List(ctx, nil, &controllerID, nil, nil, nil)
	if err == nil {
		for _, p := range list {
			if targetUserIDStr == "" || p.UserID.String() == targetUserIDStr {
				_ = s.syncMgr.CreateSyncRecord(ctx, p.UserID, "permission", p.ID.String(), p, true)
			}
		}
	}

	// Delete permissions
	if targetUserIDStr != "" {
		targetUserID, err := uuid.Parse(targetUserIDStr)
		if err != nil {
			return errors.New("invalid target user id")
		}
		err = s.repo.DeleteUserPermissions(ctx, targetUserID, controllerID)
	} else {
		err = s.repo.DeleteUserPermissions(ctx, uuid.Nil, controllerID) // passing Nil deletes all matching microcontroller_id
	}
	if err != nil {
		return err
	}

	// Audit log
	_ = s.auditMgr.Record(ctx, actorID, "permission.emergency_revocation", "microcontroller", controllerID.String(), map[string]any{
		"targetUserId": targetUserIDStr,
	}, ip)

	return nil
}
