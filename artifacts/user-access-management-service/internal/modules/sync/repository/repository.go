package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/sync/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		coll: db.Collection("cloud_sync_records"),
	}
}

func (r *Repository) SaveRecord(ctx context.Context, rec *entities.CloudSyncRecord) error {
	rec.UpdatedAt = time.Now()
	_, err := r.coll.ReplaceOne(
		ctx,
		bson.M{
			"user_id":       rec.UserID,
			"resource_type": rec.ResourceType,
			"resource_id":   rec.ResourceID,
		},
		rec,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (r *Repository) GetLatestVersion(ctx context.Context, userID uuid.UUID, resourceType string) (int, error) {
	opts := options.FindOne().SetSort(bson.D{{Key: "version", Value: -1}})
	var rec entities.CloudSyncRecord
	err := r.coll.FindOne(ctx, bson.M{
		"user_id":       userID,
		"resource_type": resourceType,
	}, opts).Decode(&rec)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return 0, nil
		}
		return 0, err
	}
	return rec.Version, nil
}
