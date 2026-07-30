package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		coll: db.Collection("ownership_transfers"),
	}
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*entities.OwnershipTransfer, error) {
	var ot entities.OwnershipTransfer
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&ot)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &ot, nil
}

func (r *Repository) FindPendingByController(ctx context.Context, controllerID uuid.UUID) (*entities.OwnershipTransfer, error) {
	var ot entities.OwnershipTransfer
	err := r.coll.FindOne(ctx, bson.M{
		"microcontroller_id": controllerID,
		"status":             "pending",
	}).Decode(&ot)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &ot, nil
}

func (r *Repository) Save(ctx context.Context, ot *entities.OwnershipTransfer) error {
	ot.UpdatedAt = time.Now()
	_, err := r.coll.ReplaceOne(
		ctx,
		bson.M{"_id": ot.ID},
		ot,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *Repository) List(ctx context.Context, controllerID *uuid.UUID, email *string, status *string) ([]entities.OwnershipTransfer, error) {
	filter := bson.M{}
	if controllerID != nil {
		filter["microcontroller_id"] = *controllerID
	}
	if email != nil {
		filter["new_owner_email"] = *email
	}
	if status != nil {
		filter["status"] = *status
	}

	cursor, err := r.coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.OwnershipTransfer
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []entities.OwnershipTransfer{}
	}
	return list, nil
}
