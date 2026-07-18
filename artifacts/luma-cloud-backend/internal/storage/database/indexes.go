package database

import (
	"context"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// EnsureIndexes creates all uniqueness constraints and query-performance
// indexes on the MongoDB Atlas cluster. It is idempotent — safe to call on
// every startup, replacing the SQL migration step from the old Postgres stack.
func EnsureIndexes(db *mongo.Database) error {
	ctx := context.Background()

	specs := []struct {
		coll    string
		indexes []mongo.IndexModel
	}{
		{"users", []mongo.IndexModel{
			{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
		}},
		{"sessions", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}}},
			{Keys: bson.D{{Key: "refresh_token_hash", Value: 1}}},
			{Keys: bson.D{{Key: "expires_at", Value: 1}}},
		}},
		{"user_phones", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}}},
		}},
		{"devices", []mongo.IndexModel{
			{Keys: bson.D{{Key: "owner_id", Value: 1}}},
			{Keys: bson.D{{Key: "mac_address", Value: 1}}, Options: options.Index().SetUnique(true)},
		}},
		{"device_admins", []mongo.IndexModel{
			{Keys: bson.D{{Key: "device_id", Value: 1}, {Key: "user_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		}},
		{"device_history", []mongo.IndexModel{
			{Keys: bson.D{{Key: "device_id", Value: 1}, {Key: "created_at", Value: -1}}},
		}},
		{"firmware_releases", []mongo.IndexModel{
			{Keys: bson.D{{Key: "device_type", Value: 1}, {Key: "version", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "device_type", Value: 1}, {Key: "channel", Value: 1}, {Key: "created_at", Value: -1}}},
		}},
		{"firmware_downloads", []mongo.IndexModel{
			{Keys: bson.D{{Key: "firmware_id", Value: 1}}},
		}},
		{"firmware_deployments", []mongo.IndexModel{
			{Keys: bson.D{{Key: "status", Value: 1}}},
		}},
		{"device_deployments", []mongo.IndexModel{
			{Keys: bson.D{{Key: "deployment_id", Value: 1}}},
			{Keys: bson.D{{Key: "deployment_id", Value: 1}, {Key: "device_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		}},
		{"notifications", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}}},
		}},
		{"notification_queue", []mongo.IndexModel{
			{Keys: bson.D{{Key: "status", Value: 1}, {Key: "next_attempt_at", Value: 1}}},
		}},
		{"cloud_sync_records", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "resource_type", Value: 1}, {Key: "resource_id", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "resource_type", Value: 1}, {Key: "version", Value: 1}}},
		}},
		{"sync_states", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "phone_id", Value: 1}, {Key: "resource_type", Value: 1}}, Options: options.Index().SetUnique(true)},
		}},
		{"backups", []mongo.IndexModel{
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}}},
		}},
		{"mqtt_device_identities", []mongo.IndexModel{
			{Keys: bson.D{{Key: "device_id", Value: 1}}},
		}},
		{"password_reset_tokens", []mongo.IndexModel{
			{Keys: bson.D{{Key: "token_hash", Value: 1}}},
		}},
		{"email_verification_tokens", []mongo.IndexModel{
			{Keys: bson.D{{Key: "token_hash", Value: 1}}},
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
