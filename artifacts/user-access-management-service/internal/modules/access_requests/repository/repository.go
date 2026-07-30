package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		coll: db.Collection("access_requests"),
	}
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*entities.AccessRequest, error) {
	var req entities.AccessRequest
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&req)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &req, nil
}

func (r *Repository) Save(ctx context.Context, req *entities.AccessRequest) error {
	req.UpdatedAt = time.Now()
	_, err := r.coll.ReplaceOne(
		ctx,
		bson.M{"_id": req.ID},
		req,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *Repository) List(ctx context.Context, requesterID, ownerID *uuid.UUID, status *string) ([]entities.AccessRequest, error) {
	filter := bson.M{}
	if requesterID != nil {
		filter["requester_id"] = *requesterID
	}
	if ownerID != nil {
		filter["owner_id"] = *ownerID
	}
	if status != nil {
		filter["status"] = *status
	}

	cursor, err := r.coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.AccessRequest
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []entities.AccessRequest{}
	}
	return list, nil
}
