package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/roles/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		coll: db.Collection("role_assignments"),
	}
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*entities.RoleAssignment, error) {
	var assign entities.RoleAssignment
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&assign)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &assign, nil
}

func (r *Repository) FindByUserAndController(ctx context.Context, userID, controllerID uuid.UUID) (*entities.RoleAssignment, error) {
	var assign entities.RoleAssignment
	err := r.coll.FindOne(ctx, bson.M{
		"user_id":            userID,
		"microcontroller_id": controllerID,
	}).Decode(&assign)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &assign, nil
}

func (r *Repository) FindOwner(ctx context.Context, controllerID uuid.UUID) (*entities.RoleAssignment, error) {
	var assign entities.RoleAssignment
	err := r.coll.FindOne(ctx, bson.M{
		"microcontroller_id": controllerID,
		"role":               "owner",
	}).Decode(&assign)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &assign, nil
}

func (r *Repository) Save(ctx context.Context, assign *entities.RoleAssignment) error {
	assign.UpdatedAt = time.Now()
	_, err := r.coll.ReplaceOne(
		ctx,
		bson.M{"_id": assign.ID},
		assign,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *Repository) List(ctx context.Context, userID, controllerID *uuid.UUID) ([]entities.RoleAssignment, error) {
	filter := bson.M{}
	if userID != nil {
		filter["user_id"] = *userID
	}
	if controllerID != nil {
		filter["microcontroller_id"] = *controllerID
	}

	cursor, err := r.coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.RoleAssignment
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []entities.RoleAssignment{}
	}
	return list, nil
}
