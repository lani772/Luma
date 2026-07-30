package database

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func EnsureIndexes(db *mongo.Database) error {
	ctx := context.Background()

	specs := []struct {
		coll    string
		indexes []mongo.IndexModel
	}{
		{"role_assignments", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "microcontroller_id", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "user_id", Value: 1}}},
			{Keys: bson.D{{Key: "microcontroller_id", Value: 1}}},
		}},
		{"permissions", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "microcontroller_id", Value: 1}, {Key: "resource_id", Value: 1}, {Key: "resource_type", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "user_id", Value: 1}}},
			{Keys: bson.D{{Key: "microcontroller_id", Value: 1}}},
		}},
		{"permission_keys", []mongo.IndexModel{
			{Keys: bson.D{{Key: "key_hash", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "user_id", Value: 1}}},
			{Keys: bson.D{{Key: "permission_id", Value: 1}}},
		}},
		{"invitations", []mongo.IndexModel{
			{Keys: bson.D{{Key: "recipient_email", Value: 1}}},
			{Keys: bson.D{{Key: "sender_id", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
		}},
		{"access_requests", []mongo.IndexModel{
			{Keys: bson.D{{Key: "requester_id", Value: 1}}},
			{Keys: bson.D{{Key: "owner_id", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
		}},
		{"ownership_transfers", []mongo.IndexModel{
			{Keys: bson.D{{Key: "microcontroller_id", Value: 1}}},
			{Keys: bson.D{{Key: "new_owner_email", Value: 1}}},
			{Keys: bson.D{{Key: "status", Value: 1}}},
		}},
		{"sync_records", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "resource_type", Value: 1}, {Key: "resource_id", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "resource_type", Value: 1}, {Key: "version", Value: 1}}},
		}},
		{"audit_logs", []mongo.IndexModel{
			{Keys: bson.D{{Key: "actor_user_id", Value: 1}, {Key: "created_at", Value: -1}}},
			{Keys: bson.D{{Key: "action", Value: 1}, {Key: "created_at", Value: -1}}},
		}},
	}

	for _, spec := range specs {
		coll := db.Collection(spec.coll)
		if _, err := coll.Indexes().CreateMany(ctx, spec.indexes); err != nil {
			return fmt.Errorf("indexes: %s: %w", spec.coll, err)
		}
	}
	return nil
}
