package workers

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	reqentities "github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/domain/entities"
	inventities "github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/domain/entities"
	ownentities "github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/domain/entities"
	permentities "github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type UAMSWorkers struct {
	db       *mongo.Database
	syncMgr  SyncManager
	auditMgr AuditManager
}

func NewUAMSWorkers(db *mongo.Database, syncMgr SyncManager, auditMgr AuditManager) *UAMSWorkers {
	return &UAMSWorkers{
		db:       db,
		syncMgr:  syncMgr,
		auditMgr: auditMgr,
	}
}

func (w *UAMSWorkers) Start(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				w.RunExpirations(ctx)
			}
		}
	}()
}

func (w *UAMSWorkers) RunExpirations(ctx context.Context) {
	now := time.Now()

	// 1. Permission Expiration
	permColl := w.db.Collection("permissions")
	keyColl := w.db.Collection("permission_keys")

	permCursor, err := permColl.Find(ctx, bson.M{
		"temporary": true,
		"status":    "active",
		"end_time":  bson.M{"$lte": now},
	})
	if err == nil {
		var expiredPerms []permentities.Permission
		if err := permCursor.All(ctx, &expiredPerms); err == nil {
			for _, p := range expiredPerms {
				_, _ = permColl.UpdateOne(ctx, bson.M{"_id": p.ID}, bson.M{"$set": bson.M{"status": "expired", "updated_at": now}})

				// Revoke keys
				_, _ = keyColl.UpdateMany(ctx, bson.M{"permission_id": p.ID, "status": "active"}, bson.M{"$set": bson.M{"status": "expired", "revoked_at": now}})

				// Sync & Audit
				_ = w.syncMgr.CreateSyncRecord(ctx, p.UserID, "permission", p.ID.String(), p, true)
				_ = w.auditMgr.Record(ctx, uuid.Nil, "permission.expired", "permission", p.ID.String(), map[string]any{"userId": p.UserID.String()}, "127.0.0.1")
				log.Printf("[workers] expired permission %s for user %s", p.ID, p.UserID)
			}
		}
	}

	// 2. Invitation Expiration
	invColl := w.db.Collection("invitations")
	invCursor, err := invColl.Find(ctx, bson.M{
		"status":     "pending",
		"expires_at": bson.M{"$lte": now},
	})
	if err == nil {
		var expiredInvs []inventities.Invitation
		if err := invCursor.All(ctx, &expiredInvs); err == nil {
			for _, inv := range expiredInvs {
				_, _ = invColl.UpdateOne(ctx, bson.M{"_id": inv.ID}, bson.M{"$set": bson.M{"status": "expired", "updated_at": now}})

				// Sync & Audit
				_ = w.syncMgr.CreateSyncRecord(ctx, inv.SenderID, "invitation", inv.ID.String(), inv, false)
				_ = w.auditMgr.Record(ctx, uuid.Nil, "invitation.expired", "invitation", inv.ID.String(), map[string]any{"recipientEmail": inv.RecipientEmail}, "127.0.0.1")
				log.Printf("[workers] expired invitation %s to %s", inv.ID, inv.RecipientEmail)
			}
		}
	}

	// 3. Access Request Expiration (Auto-reject pending requests older than 7 days)
	reqColl := w.db.Collection("access_requests")
	staleThreshold := now.Add(-7 * 24 * time.Hour)
	reqCursor, err := reqColl.Find(ctx, bson.M{
		"status":     "pending",
		"created_at": bson.M{"$lte": staleThreshold},
	})
	if err == nil {
		var staleRequests []reqentities.AccessRequest
		if err := reqCursor.All(ctx, &staleRequests); err == nil {
			for _, req := range staleRequests {
				_, _ = reqColl.UpdateOne(ctx, bson.M{"_id": req.ID}, bson.M{"$set": bson.M{"status": "expired", "updated_at": now}})

				// Sync & Audit
				_ = w.syncMgr.CreateSyncRecord(ctx, req.RequesterID, "access_request", req.ID.String(), req, false)
				_ = w.auditMgr.Record(ctx, uuid.Nil, "access_request.expired", "access_request", req.ID.String(), map[string]any{"requesterId": req.RequesterID.String()}, "127.0.0.1")
				log.Printf("[workers] expired access request %s from %s", req.ID, req.RequesterID)
			}
		}
	}

	// 4. Ownership Transfer Expiration (Auto-cancel pending transfer requests older than 3 days)
	ownsColl := w.db.Collection("ownership_transfers")
	staleTransferThreshold := now.Add(-3 * 24 * time.Hour)
	ownsCursor, err := ownsColl.Find(ctx, bson.M{
		"status":     "pending",
		"created_at": bson.M{"$lte": staleTransferThreshold},
	})
	if err == nil {
		var staleTransfers []ownentities.OwnershipTransfer
		if err := ownsCursor.All(ctx, &staleTransfers); err == nil {
			for _, ot := range staleTransfers {
				_, _ = ownsColl.UpdateOne(ctx, bson.M{"_id": ot.ID}, bson.M{"$set": bson.M{"status": "cancelled", "updated_at": now}})

				// Sync & Audit
				_ = w.syncMgr.CreateSyncRecord(ctx, ot.CurrentOwnerID, "ownership_transfer", ot.ID.String(), ot, false)
				_ = w.auditMgr.Record(ctx, uuid.Nil, "ownership.transfer_expired", "ownership_transfer", ot.ID.String(), map[string]any{"newOwnerEmail": ot.NewOwnerEmail}, "127.0.0.1")
				log.Printf("[workers] expired ownership transfer request %s", ot.ID)
			}
		}
	}
}
