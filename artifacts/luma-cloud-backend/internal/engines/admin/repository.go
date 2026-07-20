package admin

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	mongoopts "go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	db *mongo.Database
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{db: db}
}

func (r *Repository) col(name string) *mongo.Collection {
	return r.db.Collection(name)
}

// ListUsers returns a paginated slice of users, optionally filtered by role
// and/or status. A zero-value filter string means "no filter on that field".
func (r *Repository) ListUsers(ctx context.Context, role, status string, page, perPage int) ([]models.User, int64, error) {
	filter := bson.M{}
	if role != "" {
		filter["role"] = role
	}
	if status != "" {
		filter["status"] = status
	} else {
		// By default hide soft-deleted accounts from admin listings.
		filter["status"] = bson.M{"$ne": string(models.UserStatusDeleted)}
	}

	total, err := r.col("users").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("admin: count users: %w", err)
	}

	skip := int64((page - 1) * perPage)
	opts := mongoopts.Find().
		SetSkip(skip).
		SetLimit(int64(perPage)).
		SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := r.col("users").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("admin: list users: %w", err)
	}
	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, 0, fmt.Errorf("admin: decode users: %w", err)
	}
	return users, total, nil
}

func (r *Repository) FindUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.col("users").FindOne(ctx, bson.M{"_id": id}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrUserNotFound
	}
	return &u, err
}

func (r *Repository) UpdateRole(ctx context.Context, userID uuid.UUID, role models.UserRole) error {
	_, err := r.col("users").UpdateOne(ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"role": role, "updated_at": time.Now()}},
	)
	return err
}

func (r *Repository) UpdateStatus(ctx context.Context, userID uuid.UUID, status models.UserStatus) error {
	_, err := r.col("users").UpdateOne(ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"status": status, "updated_at": time.Now()}},
	)
	return err
}

// ForceDeleteUser hard-deletes the user document and cascades to all
// dependent collections: sessions, phones, and device_admins entries.
// Devices owned by the user are NOT deleted — ownership must be transferred
// first, or the caller accepts orphaned devices.
func (r *Repository) ForceDeleteUser(ctx context.Context, userID uuid.UUID) error {
	if _, err := r.col("sessions").DeleteMany(ctx, bson.M{"user_id": userID}); err != nil {
		return fmt.Errorf("admin: delete sessions: %w", err)
	}
	if _, err := r.col("user_phones").DeleteMany(ctx, bson.M{"user_id": userID}); err != nil {
		return fmt.Errorf("admin: delete phones: %w", err)
	}
	if _, err := r.col("device_admins").DeleteMany(ctx, bson.M{"user_id": userID}); err != nil {
		return fmt.Errorf("admin: delete device_admins: %w", err)
	}
	if _, err := r.col("users").DeleteOne(ctx, bson.M{"_id": userID}); err != nil {
		return fmt.Errorf("admin: delete user: %w", err)
	}
	return nil
}

// LastSeenAt returns the most recent session creation time for a user —
// used as a proxy for "last active" in the admin user listing.
func (r *Repository) LastSeenAt(ctx context.Context, userID uuid.UUID) (*time.Time, error) {
	var session models.Session
	opts := mongoopts.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	err := r.col("sessions").FindOne(ctx, bson.M{"user_id": userID}, opts).Decode(&session)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &session.CreatedAt, nil
}

// --- audit log ---

func (r *Repository) InsertAuditLog(ctx context.Context, entry *models.AuditLog) error {
	_, err := r.col("audit_logs").InsertOne(ctx, entry)
	return err
}

func (r *Repository) ListAuditLogs(ctx context.Context, actorID, targetID *uuid.UUID, action string, page, perPage int) ([]models.AuditLog, int64, error) {
	filter := bson.M{}
	if actorID != nil {
		filter["actor_user_id"] = *actorID
	}
	if targetID != nil {
		filter["target_user_id"] = *targetID
	}
	if action != "" {
		filter["action"] = action
	}

	total, err := r.col("audit_logs").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("admin: count audit_logs: %w", err)
	}

	skip := int64((page - 1) * perPage)
	opts := mongoopts.Find().
		SetSkip(skip).
		SetLimit(int64(perPage)).
		SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := r.col("audit_logs").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("admin: list audit_logs: %w", err)
	}
	var logs []models.AuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		return nil, 0, fmt.Errorf("admin: decode audit_logs: %w", err)
	}
	return logs, total, nil
}
