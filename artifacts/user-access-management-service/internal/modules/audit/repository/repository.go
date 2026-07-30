package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Repository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		coll: db.Collection("audit_logs"),
	}
}

func (r *Repository) Save(ctx context.Context, log *entities.AuditLog) error {
	_, err := r.coll.InsertOne(ctx, log)
	return err
}

func (r *Repository) List(ctx context.Context, actorID *uuid.UUID, action *string) ([]entities.AuditLog, error) {
	filter := bson.M{}
	if actorID != nil {
		filter["actor_user_id"] = *actorID
	}
	if action != nil {
		filter["action"] = *action
	}

	cursor, err := r.coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.AuditLog
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []entities.AuditLog{}
	}
	return list, nil
}
