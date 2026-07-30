package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permission_keys/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		coll: db.Collection("permission_keys"),
	}
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*entities.PermissionKey, error) {
	var pk entities.PermissionKey
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&pk)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &pk, nil
}

func (r *Repository) FindByHash(ctx context.Context, hash string) (*entities.PermissionKey, error) {
	var pk entities.PermissionKey
	err := r.coll.FindOne(ctx, bson.M{"key_hash": hash}).Decode(&pk)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &pk, nil
}

func (r *Repository) Save(ctx context.Context, pk *entities.PermissionKey) error {
	_, err := r.coll.ReplaceOne(
		ctx,
		bson.M{"_id": pk.ID},
		pk,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *Repository) RevokeUserKeysOnController(ctx context.Context, userID uuid.UUID, resourceID string) error {
	now := time.Now()
	_, err := r.coll.UpdateMany(ctx, bson.M{
		"user_id":     userID,
		"resource_id": resourceID,
		"status":      "active",
	}, bson.M{
		"$set": bson.M{
			"status":     "revoked",
			"revoked_at": now,
		},
	})
	return err
}

func (r *Repository) FindExpired(ctx context.Context) ([]entities.PermissionKey, error) {
	now := time.Now()
	cursor, err := r.coll.Find(ctx, bson.M{
		"status":     "active",
		"expires_at": bson.M{"$lte": now},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.PermissionKey
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}
