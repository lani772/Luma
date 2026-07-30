package workers

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	permrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/repository"
	keyrepo "github.com/luma-smart-home/user-access-management-service/internal/modules/permission_keys/repository"
)

type SyncManager interface {
	CreateSyncRecord(ctx context.Context, userID uuid.UUID, resType, resID string, data any, deleted bool) error
}

type AuditManager interface {
	Record(ctx context.Context, actorID uuid.UUID, action, resType, resID string, metadata any, ip string) error
}

type PermissionExpirationWorker struct {
	permRepo permrepo.Repository
	keyRepo  keyrepo.Repository
	syncMgr  SyncManager
	auditMgr AuditManager
}

func NewPermissionExpirationWorker(permRepo *permrepo.Repository, keyRepo *keyrepo.Repository, syncMgr SyncManager, auditMgr AuditManager) *PermissionExpirationWorker {
	return &PermissionExpirationWorker{
		permRepo: *permRepo,
		keyRepo:  *keyRepo,
		syncMgr:  syncMgr,
		auditMgr: auditMgr,
	}
}

func (w *PermissionExpirationWorker) Start(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				w.Run(ctx)
			}
		}
	}()
}

func (w *PermissionExpirationWorker) Run(ctx context.Context) {
	expiredPerms, err := w.permRepo.FindExpired(ctx)
	if err != nil {
		log.Printf("[worker] failed to query expired permissions: %v", err)
		return
	}

	for _, p := range expiredPerms {
		p.Status = "expired"
		if err := w.permRepo.Save(ctx, &p); err != nil {
			log.Printf("[worker] failed to update expired permission %s: %v", p.ID, err)
			continue
		}

		// Revoke keys
		_ = w.keyRepo.RevokeUserKeysOnController(ctx, p.UserID, p.MicrocontrollerID.String())

		// Create sync records
		_ = w.syncMgr.CreateSyncRecord(ctx, p.UserID, "permission", p.ID.String(), p, true)

		// Record audit log
		_ = w.auditMgr.Record(ctx, uuid.Nil, "permission.expired", "permission", p.ID.String(), map[string]any{
			"userId":     p.UserID.String(),
			"resourceId": p.ResourceID,
		}, "127.0.0.1")

		log.Printf("[worker] successfully expired permission %s for user %s", p.ID, p.UserID)
	}
}
