package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/domain/entities"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	coll *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		coll: db.Collection("invitations"),
	}
}

func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*entities.Invitation, error) {
	var inv entities.Invitation
	err := r.coll.FindOne(ctx, bson.M{"_id": id}).Decode(&inv)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &inv, nil
}

func (r *Repository) Save(ctx context.Context, inv *entities.Invitation) error {
	inv.UpdatedAt = time.Now()
	_, err := r.coll.ReplaceOne(
		ctx,
		bson.M{"_id": inv.ID},
		inv,
		options.Replace().SetUpsert(true),
	)
	return err
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.coll.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *Repository) List(ctx context.Context, senderID *uuid.UUID, recipientEmail *string, status *string) ([]entities.Invitation, error) {
	filter := bson.M{}
	if senderID != nil {
		filter["sender_id"] = *senderID
	}
	if recipientEmail != nil {
		filter["recipient_email"] = *recipientEmail
	}
	if status != nil {
		filter["status"] = *status
	}

	cursor, err := r.coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.Invitation
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []entities.Invitation{}
	}
	return list, nil
}

func (r *Repository) FindExpired(ctx context.Context) ([]entities.Invitation, error) {
	now := time.Now()
	cursor, err := r.coll.Find(ctx, bson.M{
		"status":     "pending",
		"expires_at": bson.M{"$lte": now},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []entities.Invitation
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	return list, nil
}
