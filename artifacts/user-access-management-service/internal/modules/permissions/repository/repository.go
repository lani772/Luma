package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		coll: db.Collection("permissions"),
	}
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*entities.Permission, error) {
	var perm entities.Permission
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&perm)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &perm, nil
}

func (r *Repository) FindExact(ctx context.Context, userID, controllerID uuid.UUID, resourceID string, resourceType string) (*entities.Permission, error) {
	var perm entities.Permission
	err := r.coll.FindOne(ctx, bson.M{
		"user_id":            userID,
		"microcontroller_id": controllerID,
		"resource_id":        resourceID,
		"resource_type":      resourceType,
	}).Decode(&perm)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &perm, nil
}

func (r *Repository) Save(ctx context.Context, perm *entities.Permission) error {
	perm.UpdatedAt = time.Now()
	_, err := r.coll.ReplaceOne(
		ctx,
		bson.M{"_id": perm.ID},
		perm,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *Repository) DeleteUserPermissions(ctx context.Context, userID, controllerID uuid.UUID) error {
	_, err := r.coll.DeleteMany(ctx, bson.M{
		"user_id":            userID,
		"microcontroller_id": controllerID,
	})
	return err
}

func (r *Repository) List(ctx context.Context, userID, controllerID *uuid.UUID, resourceID, resourceType, status *string) ([]entities.Permission, error) {
	filter := bson.M{}
	if userID != nil {
		filter["user_id"] = *userID
	}
	if controllerID != nil {
		filter["microcontroller_id"] = *controllerID
	}
	if resourceID != nil {
		filter["resource_id"] = *resourceID
	}
	if resourceType != nil {
		filter["resource_type"] = *resourceType
	}
	if status != nil {
		filter["status"] = *status
	}

	cursor, err := r.coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.Permission
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []entities.Permission{}
	}
	return list, nil
}

func (r *Repository) FindActiveForUserAndController(ctx context.Context, userID, controllerID uuid.UUID) ([]entities.Permission, error) {
	cursor, err := r.coll.Find(ctx, bson.M{
		"user_id":            userID,
		"microcontroller_id": controllerID,
		"status":             "active",
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.Permission
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *Repository) FindExpired(ctx context.Context) ([]entities.Permission, error) {
	now := time.Now()
	cursor, err := r.coll.Find(ctx, bson.M{
		"temporary": true,
		"status":    "active",
		"end_time":  bson.M{"$lte": now},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.Permission
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}
