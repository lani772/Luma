package tests

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	rolesdto "github.com/luma-smart-home/user-access-management-service/internal/modules/roles/dto"
	permsdto "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/dto"
	permentities "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/domain/entities"
	permsvc "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/service"
	keysvc "github.com/luma-smart-home/user-access-management-service/internal/modules/permission_keys/service"
	invsdto "github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/dto"
	inventities "github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/domain/entities"
	invssvc "github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/service"
	reqsdto "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/dto"
	reqentities "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/domain/entities"
	reqssvc "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/service"
	ownsdto "github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/dto"
	ownentities "github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/domain/entities"
	ownssvc "github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/service"
	visvc "github.com/luma-smart-home/user-access-management-service/internal/modules/resource_visibility/service"
)

// Mock Managers to satisfy interfaces
type MockSyncManager struct{}

func (m *MockSyncManager) CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error {
	return nil
}

type MockAuditManager struct{}

func (m *MockAuditManager) Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error {
	return nil
}

type MockRoleReader struct {
	Role string
}

func (m *MockRoleReader) GetUserRoleOnController(ctx context.Context, userID, controllerID uuid.UUID) (string, error) {
	return m.Role, nil
}

func (m *MockRoleReader) FindOwner(ctx context.Context, controllerID uuid.UUID) (uuid.UUID, error) {
	return uuid.New(), nil
}

type MockRoleAssigner struct{}

func (m *MockRoleAssigner) AssignRole(ctx context.Context, actorID uuid.UUID, req rolesdto.AssignRoleRequest, ip string) (*rolesdto.RoleDTO, error) {
	return &rolesdto.RoleDTO{
		ID:                uuid.New().String(),
		UserID:            req.UserID,
		MicrocontrollerID: req.MicrocontrollerID,
		Role:              req.Role,
		AssignedBy:        actorID.String(),
		Status:            "active",
		CreatedAt:         time.Now().Format(time.RFC3339),
		UpdatedAt:         time.Now().Format(time.RFC3339),
	}, nil
}

type MockRoleManager struct{}

func (m *MockRoleManager) AssignRole(ctx context.Context, actorID uuid.UUID, req rolesdto.AssignRoleRequest, ip string) (*rolesdto.RoleDTO, error) {
	return &rolesdto.RoleDTO{ID: uuid.New().String()}, nil
}

func (m *MockRoleManager) RemoveRole(ctx context.Context, actorID uuid.UUID, id uuid.UUID, ip string) error {
	return nil
}

func (m *MockRoleManager) ListRoles(ctx context.Context, userID, controllerID *uuid.UUID) ([]rolesdto.RoleDTO, error) {
	return []rolesdto.RoleDTO{}, nil
}

type MockUserProfileReader struct{}

func (m *MockUserProfileReader) GetProfile(ctx context.Context, userID uuid.UUID) (*reqsdto.RequesterProfileDTO, error) {
	return &reqsdto.RequesterProfileDTO{
		ID:            userID.String(),
		FullName:      "Requester",
		Email:         "test@example.com",
		EmailVerified: true,
	}, nil
}

type MockUserLookup struct{}

func (m *MockUserLookup) FindUserIDByEmail(ctx context.Context, email string) (uuid.UUID, error) {
	return uuid.New(), nil
}

type MockPermissionManager struct{}

func (m *MockPermissionManager) RevokeRolePermissions(ctx context.Context, userID, controllerID uuid.UUID) error {
	return nil
}

type MockKeyManager struct{}

func (m *MockKeyManager) RevokeKeysForUser(ctx context.Context, userID, controllerID uuid.UUID) error {
	return nil
}

type MockInvitationRepository struct{}

func (m *MockInvitationRepository) FindByID(ctx context.Context, id uuid.UUID) (*inventities.Invitation, error) {
	return &inventities.Invitation{
		ID:              id,
		SenderID:        uuid.New(),
		RecipientEmail:  "friend@example.com",
		ResourceID:      uuid.New().String(),
		ResourceType:    "microcontroller",
		PermissionLevel: "operator",
		Status:          "pending",
		ExpiresAt:       time.Now().Add(24 * time.Hour),
	}, nil
}

func (m *MockInvitationRepository) Save(ctx context.Context, inv *inventities.Invitation) error {
	return nil
}

func (m *MockInvitationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *MockInvitationRepository) List(ctx context.Context, senderID *uuid.UUID, recipientEmail *string, status *string) ([]inventities.Invitation, error) {
	return []inventities.Invitation{}, nil
}

func (m *MockInvitationRepository) FindExpired(ctx context.Context) ([]inventities.Invitation, error) {
	return []inventities.Invitation{}, nil
}

type MockAccessRequestRepository struct{}

func (m *MockAccessRequestRepository) FindByID(ctx context.Context, id uuid.UUID) (*reqentities.AccessRequest, error) {
	return &reqentities.AccessRequest{
		ID:            id,
		RequesterID:   uuid.New(),
		OwnerID:       uuid.New(),
		ResourceID:    uuid.New().String(),
		ResourceType:  "microcontroller",
		RequestedRole: "operator",
		Status:        "pending",
	}, nil
}

func (m *MockAccessRequestRepository) Save(ctx context.Context, req *reqentities.AccessRequest) error {
	return nil
}

func (m *MockAccessRequestRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *MockAccessRequestRepository) List(ctx context.Context, requesterID, ownerID *uuid.UUID, status *string) ([]reqentities.AccessRequest, error) {
	return []reqentities.AccessRequest{}, nil
}

type MockOwnershipRepository struct{}

func (m *MockOwnershipRepository) FindByID(ctx context.Context, id uuid.UUID) (*ownentities.OwnershipTransfer, error) {
	return &ownentities.OwnershipTransfer{
		ID:                id,
		MicrocontrollerID: uuid.New(),
		CurrentOwnerID:    uuid.New(),
		NewOwnerEmail:     "newowner@example.com",
		Status:            "pending",
	}, nil
}

func (m *MockOwnershipRepository) Save(ctx context.Context, ot *ownentities.OwnershipTransfer) error {
	return nil
}

func (m *MockOwnershipRepository) FindPendingByController(ctx context.Context, controllerID uuid.UUID) (*ownentities.OwnershipTransfer, error) {
	return nil, nil
}

func (m *MockOwnershipRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *MockOwnershipRepository) List(ctx context.Context, controllerID *uuid.UUID, email *string, status *string) ([]ownentities.OwnershipTransfer, error) {
	return []ownentities.OwnershipTransfer{}, nil
}

type MockPermissionsRepository struct {
	Permissions []permentities.Permission
}

func (m *MockPermissionsRepository) FindByID(ctx context.Context, id uuid.UUID) (*permentities.Permission, error) {
	for _, p := range m.Permissions {
		if p.ID == id {
			return &p, nil
		}
	}
	return nil, nil
}

func (m *MockPermissionsRepository) Save(ctx context.Context, perm *permentities.Permission) error {
	m.Permissions = append(m.Permissions, *perm)
	return nil
}

func (m *MockPermissionsRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *MockPermissionsRepository) DeleteUserPermissions(ctx context.Context, userID, controllerID uuid.UUID) error {
	return nil
}

func (m *MockPermissionsRepository) FindExact(ctx context.Context, userID, controllerID uuid.UUID, resourceID string, resourceType string) (*permentities.Permission, error) {
	return nil, nil
}

func (m *MockPermissionsRepository) List(ctx context.Context, userID, controllerID *uuid.UUID, resourceID, resourceType, status *string) ([]permentities.Permission, error) {
	return m.Permissions, nil
}

func (m *MockPermissionsRepository) FindActiveForUserAndController(ctx context.Context, userID, controllerID uuid.UUID) ([]permentities.Permission, error) {
	return m.Permissions, nil
}

func (m *MockPermissionsRepository) FindExpired(ctx context.Context) ([]permentities.Permission, error) {
	return []permentities.Permission{}, nil
}

func TestMockWorkflows(t *testing.T) {
	ctx := context.Background()

	// 1. Test Key Generation and Validation
	keySvc := keysvc.NewService(nil, &MockSyncManager{}, &MockAuditManager{})
	rawKey, hashKey, err := keySvc.GenerateRawKey()
	if err != nil {
		t.Fatalf("failed to generate raw key: %v", err)
	}
	if len(rawKey) != 128 {
		t.Errorf("expected 128-char hex string, got %d", len(rawKey))
	}
	if len(hashKey) != 64 {
		t.Errorf("expected 64-char hex SHA-256 hash, got %d", len(hashKey))
	}

	// 2. Test CheckPermission Workflow
	permsService := permsvc.NewService(&MockPermissionsRepository{}, &MockRoleReader{Role: "owner"}, &MockSyncManager{}, &MockAuditManager{})
	checkResp, err := permsService.CheckPermission(ctx, permsdto.CheckPermissionRequest{
		UserID:            uuid.New().String(),
		MicrocontrollerID: uuid.New().String(),
		ResourceID:        uuid.New().String(),
		ResourceType:      "device",
		Action:            "control",
	})
	if err != nil {
		t.Fatalf("failed to check permission: %v", err)
	}
	if !checkResp.Allowed {
		t.Error("expected owner to be allowed by default")
	}

	// 3. Test Invitation Flow Setup
	invSvc := invssvc.NewService(&MockInvitationRepository{}, &MockRoleReader{Role: "owner"}, &MockRoleAssigner{}, &MockSyncManager{}, &MockAuditManager{})
	invDto, err := invSvc.CreateInvitation(ctx, uuid.New(), invsdto.CreateInvitationRequest{
		RecipientEmail:  "friend@example.com",
		ResourceID:      uuid.New().String(),
		ResourceType:    "microcontroller",
		PermissionLevel: "operator",
		PersonalMessage: "Welcome!",
	}, "127.0.0.1")
	if err != nil {
		t.Fatalf("failed to create invitation: %v", err)
	}
	if invDto.Status != "pending" {
		t.Errorf("expected status 'pending', got %s", invDto.Status)
	}

	// 4. Test Access Request Flow Setup
	reqSvc := reqssvc.NewService(&MockAccessRequestRepository{}, &MockRoleReader{Role: "owner"}, &MockRoleAssigner{}, &MockUserProfileReader{}, &MockSyncManager{}, &MockAuditManager{}, nil)
	if reqSvc == nil {
		t.Error("expected access request service to be instantiated")
	}

	// 5. Test Ownership Transfer Request
	ownsSvc := ownssvc.NewService(&MockOwnershipRepository{}, &MockRoleReader{Role: "owner"}, &MockRoleManager{}, &MockUserLookup{}, &MockPermissionManager{}, &MockKeyManager{}, &MockSyncManager{}, &MockAuditManager{})
	ownsDto, err := ownsSvc.RequestTransfer(ctx, uuid.New(), ownsdto.RequestTransferRequest{
		MicrocontrollerID: uuid.New().String(),
		NewOwnerEmail:     "newowner@example.com",
		Reason:            "Moving away",
	}, "127.0.0.1")
	if err != nil {
		t.Fatalf("failed to request transfer: %v", err)
	}
	if ownsDto.Status != "pending" {
		t.Errorf("expected pending status, got %s", ownsDto.Status)
	}

	// 6. Test Resource Visibility Security Filtering
	visSvc := visvc.NewService(&MockRoleReader{Role: "owner"})
	fullRes := visvc.FullResource{
		DeviceID:     "ESP32-01",
		MAC:          "AA:BB:CC:DD:EE:FF",
		FriendlyName: "Living Room Fan",
		DeviceType:   "fan",
		Room:         "Living Room",
		Status:       "online",
	}

	res, err := visSvc.SanitizeResource(ctx, uuid.New(), uuid.New(), fullRes)
	if err != nil {
		t.Fatalf("failed to sanitize: %v", err)
	}

	// Owner should see full details
	ownerRes, ok := res.(visvc.FullResource)
	if !ok {
		t.Errorf("expected FullResource for owner, got %T", res)
	}
	if ownerRes.MAC != "AA:BB:CC:DD:EE:FF" {
		t.Error("owner MAC should be visible")
	}

	// Non-owner should have details filtered
	visNonSvc := visvc.NewService(&MockRoleReader{Role: "viewer"})
	resNon, err := visNonSvc.SanitizeResource(ctx, uuid.New(), uuid.New(), fullRes)
	if err != nil {
		t.Fatalf("failed to sanitize for viewer: %v", err)
	}
	nonRes, ok := resNon.(visvc.SanitizedResource)
	if !ok {
		t.Errorf("expected SanitizedResource for viewer, got %T", resNon)
	}
	if nonRes.FriendlyName != "Living Room Fan" {
		t.Error("friendly name should be preserved")
	}
}
