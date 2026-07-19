package mqtt

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Repository struct {
	db *mongo.Database
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{db: db}
}

func (r *Repository) col() *mongo.Collection { return r.db.Collection("mqtt_device_identities") }

func (r *Repository) Upsert(identity *models.MQTTDeviceIdentity) error {
	ctx := context.Background()
	// Revoke any prior active identity before issuing a new one so rotated
	// credentials can't both be valid at once.
	_, err := r.col().UpdateMany(ctx,
		bson.M{"device_id": identity.DeviceID, "revoked_at": nil},
		bson.M{"$set": bson.M{"revoked_at": time.Now()}},
	)
	if err != nil {
		return err
	}
	_, err = r.col().InsertOne(ctx, identity)
	return err
}

func (r *Repository) FindActiveByDevice(deviceID uuid.UUID) (*models.MQTTDeviceIdentity, error) {
	var identity models.MQTTDeviceIdentity
	err := r.col().FindOne(context.Background(),
		bson.M{"device_id": deviceID, "revoked_at": nil},
	).Decode(&identity)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &identity, err
}

func (r *Repository) Revoke(deviceID uuid.UUID) error {
	_, err := r.col().UpdateMany(context.Background(),
		bson.M{"device_id": deviceID, "revoked_at": nil},
		bson.M{"$set": bson.M{"revoked_at": time.Now()}},
	)
	return err
}
