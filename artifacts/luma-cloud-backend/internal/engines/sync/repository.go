package sync

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	db *mongo.Database
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{db: db}
}

func (r *Repository) col(name string) *mongo.Collection { return r.db.Collection(name) }

func (r *Repository) FindRecord(userID uuid.UUID, resourceType, resourceID string) (*models.CloudSyncRecord, error) {
	var rec models.CloudSyncRecord
	err := r.col("cloud_sync_records").FindOne(context.Background(), bson.M{
		"user_id":       userID,
		"resource_type": resourceType,
		"resource_id":   resourceID,
	}).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &rec, err
}

func (r *Repository) SaveRecord(rec *models.CloudSyncRecord) error {
	rec.UpdatedAt = time.Now()
	if rec.ID == (uuid.UUID{}) {
		rec.ID = uuid.New()
	}
	opts := options.Replace().SetUpsert(true)
	_, err := r.col("cloud_sync_records").ReplaceOne(context.Background(),
		bson.M{"user_id": rec.UserID, "resource_type": rec.ResourceType, "resource_id": rec.ResourceID},
		rec,
		opts,
	)
	return err
}

func (r *Repository) FindChangesSince(userID uuid.UUID, resourceType string, version int) ([]models.CloudSyncRecord, error) {
	ctx := context.Background()
	opts := options.Find().SetSort(bson.D{{Key: "version", Value: 1}})
	cursor, err := r.col("cloud_sync_records").Find(ctx, bson.M{
		"user_id":       userID,
		"resource_type": resourceType,
		"version":       bson.M{"$gt": version},
	}, opts)
	if err != nil {
		return nil, err
	}
	var list []models.CloudSyncRecord
	return list, cursor.All(ctx, &list)
}

func (r *Repository) GetLatestVersion(userID uuid.UUID, resourceType string) (int, error) {
	// Find the record with the highest version.
	opts := options.FindOne().
		SetSort(bson.D{{Key: "version", Value: -1}}).
		SetProjection(bson.M{"version": 1})

	var rec models.CloudSyncRecord
	err := r.col("cloud_sync_records").FindOne(context.Background(), bson.M{
		"user_id":       userID,
		"resource_type": resourceType,
	}, opts).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return 0, nil
	}
	return rec.Version, err
}

func (r *Repository) GetSyncState(userID, phoneID uuid.UUID, resourceType string) (*models.SyncState, error) {
	var state models.SyncState
	err := r.col("sync_states").FindOne(context.Background(), bson.M{
		"user_id":       userID,
		"phone_id":      phoneID,
		"resource_type": resourceType,
	}).Decode(&state)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &state, err
}

func (r *Repository) SaveSyncState(state *models.SyncState) error {
	state.LastSyncedAt = time.Now()
	if state.ID == (uuid.UUID{}) {
		state.ID = uuid.New()
	}
	opts := options.Replace().SetUpsert(true)
	_, err := r.col("sync_states").ReplaceOne(context.Background(),
		bson.M{"user_id": state.UserID, "phone_id": state.PhoneID, "resource_type": state.ResourceType},
		state,
		opts,
	)
	return err
}

func (r *Repository) RecordHistory(h *models.SyncHistory) error {
	_, err := r.col("sync_history").InsertOne(context.Background(), h)
	return err
}
