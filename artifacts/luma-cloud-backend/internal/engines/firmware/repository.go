package firmware

import (
	"context"
	"errors"

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

func (r *Repository) Create(f *models.FirmwareRelease) error {
	_, err := r.col("firmware_releases").InsertOne(context.Background(), f)
	return err
}

func (r *Repository) FindByID(id uuid.UUID) (*models.FirmwareRelease, error) {
	var f models.FirmwareRelease
	err := r.col("firmware_releases").FindOne(context.Background(), bson.M{"_id": id}).Decode(&f)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, errors.New("firmware release not found")
	}
	return &f, err
}

func (r *Repository) FindByVersion(deviceType, version string) (*models.FirmwareRelease, error) {
	var f models.FirmwareRelease
	err := r.col("firmware_releases").FindOne(context.Background(),
		bson.M{"device_type": deviceType, "version": version},
	).Decode(&f)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &f, err
}

func (r *Repository) FindLatest(deviceType, channel string) (*models.FirmwareRelease, error) {
	var f models.FirmwareRelease
	opts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	err := r.col("firmware_releases").FindOne(context.Background(),
		bson.M{"device_type": deviceType, "channel": channel},
		opts,
	).Decode(&f)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &f, err
}

func (r *Repository) List(deviceType, channel string, page, perPage int) ([]models.FirmwareRelease, int64, error) {
	ctx := context.Background()
	filter := bson.M{}
	if deviceType != "" {
		filter["device_type"] = deviceType
	}
	if channel != "" {
		filter["channel"] = channel
	}

	total, err := r.col("firmware_releases").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * perPage)).
		SetLimit(int64(perPage))

	cursor, err := r.col("firmware_releases").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	var list []models.FirmwareRelease
	return list, total, cursor.All(ctx, &list)
}

func (r *Repository) Update(id uuid.UUID, updates map[string]any) error {
	_, err := r.col("firmware_releases").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": updates},
	)
	return err
}

func (r *Repository) Delete(id uuid.UUID) error {
	_, err := r.col("firmware_releases").DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

func (r *Repository) RecordDownload(d *models.FirmwareDownload) error {
	_, err := r.col("firmware_downloads").InsertOne(context.Background(), d)
	return err
}

func (r *Repository) ListDownloads(firmwareID uuid.UUID, page, perPage int) ([]models.FirmwareDownload, int64, error) {
	ctx := context.Background()
	filter := bson.M{"firmware_id": firmwareID}

	total, err := r.col("firmware_downloads").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "downloaded_at", Value: -1}}).
		SetSkip(int64((page - 1) * perPage)).
		SetLimit(int64(perPage))

	cursor, err := r.col("firmware_downloads").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	var list []models.FirmwareDownload
	return list, total, cursor.All(ctx, &list)
}
