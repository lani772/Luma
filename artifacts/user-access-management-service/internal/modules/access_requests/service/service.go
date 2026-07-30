package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/domain/entities"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/dto"
	rolesdto "github.com/luma-smart-home/user-access-management-service/internal/modules/roles/dto"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
	ErrUnauthorized            = errors.New("unauthorized access request management")
	ErrRequestNotFound         = errors.New("access request not found")
	ErrRequestNotPending       = errors.New("access request is not pending")
	ErrOwnerAlreadyHasAccess   = errors.New("owner already has full access")
	ErrDuplicateRequest        = errors.New("a pending access request already exists for this resource")
	ErrRequesterBlocked        = errors.New("you have been blocked from requesting access by the resource owner")
)

type AccessRequestRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*entities.AccessRequest, error)
	Save(ctx context.Context, req *entities.AccessRequest) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, requesterID, ownerID *uuid.UUID, status *string) ([]entities.AccessRequest, error)
}

type OwnerFinder interface {
	FindOwner(ctx context.Context, controllerID uuid.UUID) (uuid.UUID, error)
}

type RoleAssigner interface {
	AssignRole(ctx context.Context, actorID uuid.UUID, req rolesdto.AssignRoleRequest, ip string) (*rolesdto.RoleDTO, error)
}

type UserProfileReader interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*dto.RequesterProfileDTO, error)
}

type SyncManager interface {
	CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error
}

type AuditManager interface {
	Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error
}

type Service struct {
	repo         AccessRequestRepository
	ownerFinder  OwnerFinder
	roleAssigner RoleAssigner
	userProfile  UserProfileReader
	syncMgr      SyncManager
	auditMgr     AuditManager
	db           *mongo.Database // used for blocked users check
}

func NewService(repo AccessRequestRepository, ownerFinder OwnerFinder, roleAssigner RoleAssigner, userProfile UserProfileReader, syncMgr SyncManager, auditMgr AuditManager, db *mongo.Database) *Service {
	return &Service{
		repo:         repo,
		ownerFinder:  ownerFinder,
		roleAssigner: roleAssigner,
		userProfile:  userProfile,
		syncMgr:      syncMgr,
		auditMgr:     auditMgr,
		db:           db,
	}
}

func (s *Service) BlockUser(ctx context.Context, ownerID uuid.UUID, targetUserID uuid.UUID) error {
	if s.db == nil {
		return nil
	}
	coll := s.db.Collection("blocked_users")
	_, err := coll.UpdateOne(ctx, bson.M{
		"owner_id":        ownerID,
		"blocked_user_id": targetUserID,
	}, bson.M{
		"$set": bson.M{
			"owner_id":        ownerID,
			"blocked_user_id": targetUserID,
			"created_at":      time.Now(),
		},
	}, options.UpdateOne().SetUpsert(true))
	return err
}

func (s *Service) CreateRequest(ctx context.Context, requesterID uuid.UUID, req dto.CreateAccessRequest, ip string) (*dto.AccessRequestDTO, error) {
	controllerID, err := uuid.Parse(req.ResourceID)
	if err != nil {
		return nil, errors.New("invalid resource microcontroller id")
	}

	ownerID, err := s.ownerFinder.FindOwner(ctx, controllerID)
	if err != nil {
		return nil, err
	}
	if ownerID == uuid.Nil {
		return nil, errors.New("microcontroller has no registered owner")
	}

	if requesterID == ownerID {
		return nil, ErrOwnerAlreadyHasAccess
	}

	// 1. Blocked User Check
	if s.db != nil {
		coll := s.db.Collection("blocked_users")
		count, err := coll.CountDocuments(ctx, bson.M{
			"owner_id":        ownerID,
			"blocked_user_id": requesterID,
		})
		if err == nil && count > 0 {
			return nil, ErrRequesterBlocked
		}
	}

	// 2. Duplicate Request Prevention
	pendingStr := "pending"
	existing, err := s.repo.List(ctx, &requesterID, &ownerID, &pendingStr)
	if err == nil {
		for _, r := range existing {
			if r.ResourceID == req.ResourceID {
				return nil, ErrDuplicateRequest
			}
		}
	}

	accessReq := &entities.AccessRequest{
		ID:                uuid.New(),
		RequesterID:       requesterID,
		OwnerID:           ownerID,
		ResourceID:        req.ResourceID,
		ResourceType:      req.ResourceType,
		RequestedRole:     req.RequestedRole,
		RequestedDuration: req.RequestedDuration,
		Message:           req.Message,
		Status:            "pending",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Save(ctx, accessReq); err != nil {
		return nil, err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, requesterID, "access_request", accessReq.ID.String(), accessReq, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, requesterID, "access_request.created", "access_request", accessReq.ID.String(), map[string]any{
		"ownerId":       ownerID.String(),
		"resourceId":    req.ResourceID,
		"requestedRole": req.RequestedRole,
	}, ip)

	return s.toDTO(ctx, accessReq)
}

func (s *Service) ApproveRequest(ctx context.Context, ownerID uuid.UUID, id uuid.UUID, ip string) error {
	accessReq, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if accessReq == nil {
		return ErrRequestNotFound
	}

	if accessReq.OwnerID != ownerID {
		return ErrUnauthorized
	}

	if accessReq.Status != "pending" {
		return ErrRequestNotPending
	}

	accessReq.Status = "approved"
	if err := s.repo.Save(ctx, accessReq); err != nil {
		return err
	}

	// Trigger automatic Role Assignment, Permissions, Keys, Sync, Auditing
	_, err = s.roleAssigner.AssignRole(ctx, ownerID, rolesdto.AssignRoleRequest{
		UserID:            accessReq.RequesterID.String(),
		MicrocontrollerID: accessReq.ResourceID,
		Role:              accessReq.RequestedRole,
	}, ip)
	if err != nil {
		return err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, accessReq.RequesterID, "access_request", accessReq.ID.String(), accessReq, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, ownerID, "access_request.approved", "access_request", accessReq.ID.String(), map[string]any{
		"requesterId": accessReq.RequesterID.String(),
		"resourceId":  accessReq.ResourceID,
	}, ip)

	return nil
}

func (s *Service) RejectRequest(ctx context.Context, ownerID uuid.UUID, id uuid.UUID, ip string) error {
	accessReq, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if accessReq == nil {
		return ErrRequestNotFound
	}

	if accessReq.OwnerID != ownerID {
		return ErrUnauthorized
	}

	if accessReq.Status != "pending" {
		return ErrRequestNotPending
	}

	accessReq.Status = "rejected"
	if err := s.repo.Save(ctx, accessReq); err != nil {
		return err
	}

	// Create sync record
	_ = s.syncMgr.CreateSyncRecord(ctx, accessReq.RequesterID, "access_request", accessReq.ID.String(), accessReq, false)

	// Audit log
	_ = s.auditMgr.Record(ctx, ownerID, "access_request.rejected", "access_request", accessReq.ID.String(), map[string]any{
		"requesterId": accessReq.RequesterID.String(),
		"resourceId":  accessReq.ResourceID,
	}, ip)

	return nil
}

func (s *Service) ListRequests(ctx context.Context, requesterID, ownerID *uuid.UUID, status *string) ([]dto.AccessRequestDTO, error) {
	list, err := s.repo.List(ctx, requesterID, ownerID, status)
	if err != nil {
		return nil, err
	}
	out := make([]dto.AccessRequestDTO, len(list))
	for i, accessReq := range list {
		d, _ := s.toDTO(ctx, &accessReq)
		out[i] = *d
	}
	return out, nil
}

func (s *Service) toDTO(ctx context.Context, accessReq *entities.AccessRequest) (*dto.AccessRequestDTO, error) {
	var profile *dto.RequesterProfileDTO
	if s.userProfile != nil {
		profile, _ = s.userProfile.GetProfile(ctx, accessReq.RequesterID)
	}

	return &dto.AccessRequestDTO{
		ID:                accessReq.ID.String(),
		RequesterID:       accessReq.RequesterID.String(),
		OwnerID:           accessReq.OwnerID.String(),
		ResourceID:        accessReq.ResourceID,
		ResourceType:      accessReq.ResourceType,
		RequestedRole:     accessReq.RequestedRole,
		RequestedDuration: accessReq.RequestedDuration,
		Message:           accessReq.Message,
		Status:            accessReq.Status,
		RequesterProfile:  profile,
		CreatedAt:         accessReq.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         accessReq.UpdatedAt.Format(time.RFC3339),
	}, nil
}
