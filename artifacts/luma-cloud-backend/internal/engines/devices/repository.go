package devices

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository struct {
	db *mongo.Database
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{db: db}
}

func (r *Repository) col(name string) *mongo.Collection { return r.db.Collection(name) }

func (r *Repository) Create(d *models.Device) error {
	_, err := r.col("devices").InsertOne(context.Background(), d)
	return err
}

func (r *Repository) FindByMAC(mac string) (*models.Device, error) {
	var d models.Device
	err := r.col("devices").FindOne(context.Background(), bson.M{"mac_address": mac}).Decode(&d)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &d, err
}

func (r *Repository) FindByID(id uuid.UUID) (*models.Device, error) {
	var d models.Device
	err := r.col("devices").FindOne(context.Background(), bson.M{"_id": id}).Decode(&d)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &d, err
}

func (r *Repository) Update(id uuid.UUID, updates map[string]any) error {
	updates["updated_at"] = time.Now()
	_, err := r.col("devices").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": updates},
	)
	return err
}

func (r *Repository) Delete(id uuid.UUID) error {
	_, err := r.col("devices").DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

// ListForUser returns every device the user owns or administers, paginated.
func (r *Repository) ListForUser(userID uuid.UUID, page, perPage int) ([]models.Device, int64, error) {
	ctx := context.Background()

	// Fetch admin device IDs first.
	adminCursor, err := r.col("device_admins").Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, 0, err
	}
	var adminRows []models.DeviceAdmin
	if err := adminCursor.All(ctx, &adminRows); err != nil {
		return nil, 0, err
	}
	adminIDs := make([]uuid.UUID, 0, len(adminRows))
	for _, a := range adminRows {
		adminIDs = append(adminIDs, a.DeviceID)
	}

	filter := bson.M{"$or": bson.A{
		bson.M{"owner_id": userID},
		bson.M{"_id": bson.M{"$in": adminIDs}},
	}}

	total, err := r.col("devices").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * perPage)).
		SetLimit(int64(perPage))

	cursor, err := r.col("devices").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	var deviceList []models.Device
	return deviceList, total, cursor.All(ctx, &deviceList)
}

func (r *Repository) ListAdminIDs(deviceID uuid.UUID) ([]uuid.UUID, error) {
	ctx := context.Background()
	cursor, err := r.col("device_admins").Find(ctx, bson.M{"device_id": deviceID})
	if err != nil {
		return nil, err
	}
	var admins []models.DeviceAdmin
	if err := cursor.All(ctx, &admins); err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(admins))
	for _, a := range admins {
		ids = append(ids, a.UserID)
	}
	return ids, nil
}

func (r *Repository) AddAdmin(a *models.DeviceAdmin) error {
	a.ID = uuid.New()
	_, err := r.col("device_admins").InsertOne(context.Background(), a)
	return err
}

func (r *Repository) RemoveAdmin(deviceID, userID uuid.UUID) error {
	_, err := r.col("device_admins").DeleteOne(context.Background(),
		bson.M{"device_id": deviceID, "user_id": userID},
	)
	return err
}

func (r *Repository) IsAdmin(deviceID, userID uuid.UUID) (bool, error) {
	count, err := r.col("device_admins").CountDocuments(context.Background(),
		bson.M{"device_id": deviceID, "user_id": userID},
	)
	return count > 0, err
}

func (r *Repository) AppendHistory(h *models.DeviceHistory) error {
	_, err := r.col("device_history").InsertOne(context.Background(), h)
	return err
}

func (r *Repository) ListHistory(deviceID uuid.UUID, page, perPage int) ([]models.DeviceHistory, int64, error) {
	ctx := context.Background()
	filter := bson.M{"device_id": deviceID}

	total, err := r.col("device_history").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * perPage)).
		SetLimit(int64(perPage))

	cursor, err := r.col("device_history").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	var entries []models.DeviceHistory
	return entries, total, cursor.All(ctx, &entries)
}

// ListOwnedAndAdminSummaries backs the User Engine's "my devices" view.
func (r *Repository) ListOwnedAndAdminSummaries(userID uuid.UUID) ([]models.Device, map[uuid.UUID]string, error) {
	ctx := context.Background()

	ownedCursor, err := r.col("devices").Find(ctx, bson.M{"owner_id": userID})
	if err != nil {
		return nil, nil, err
	}
	var owned []models.Device
	if err := ownedCursor.All(ctx, &owned); err != nil {
		return nil, nil, err
	}
	roleByDevice := make(map[uuid.UUID]string, len(owned))
	for _, d := range owned {
		roleByDevice[d.ID] = "owner"
	}

	adminCursor, err := r.col("device_admins").Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, nil, err
	}
	var adminRows []models.DeviceAdmin
	if err := adminCursor.All(ctx, &adminRows); err != nil {
		return nil, nil, err
	}

	adminDeviceIDs := make([]uuid.UUID, 0, len(adminRows))
	for _, a := range adminRows {
		adminDeviceIDs = append(adminDeviceIDs, a.DeviceID)
		roleByDevice[a.DeviceID] = "admin"
	}

	var adminDevices []models.Device
	if len(adminDeviceIDs) > 0 {
		devCursor, err := r.col("devices").Find(ctx, bson.M{"_id": bson.M{"$in": adminDeviceIDs}})
		if err != nil {
			return nil, nil, err
		}
		if err := devCursor.All(ctx, &adminDevices); err != nil {
			return nil, nil, err
		}
	}

	return append(owned, adminDevices...), roleByDevice, nil
}
