package deployment

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

func (r *Repository) Create(d *models.FirmwareDeployment) error {
	_, err := r.col("firmware_deployments").InsertOne(context.Background(), d)
	return err
}

func (r *Repository) FindByID(id uuid.UUID) (*models.FirmwareDeployment, error) {
	var d models.FirmwareDeployment
	err := r.col("firmware_deployments").FindOne(context.Background(), bson.M{"_id": id}).Decode(&d)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, errors.New("deployment not found")
	}
	return &d, err
}

func (r *Repository) List(page, perPage int) ([]models.FirmwareDeployment, int64, error) {
	ctx := context.Background()

	total, err := r.col("firmware_deployments").CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * perPage)).
		SetLimit(int64(perPage))

	cursor, err := r.col("firmware_deployments").Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, 0, err
	}
	var list []models.FirmwareDeployment
	return list, total, cursor.All(ctx, &list)
}

func (r *Repository) UpdateStatus(id uuid.UUID, status string) error {
	_, err := r.col("firmware_deployments").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"status": status, "updated_at": time.Now()}},
	)
	return err
}

func (r *Repository) SaveDeviceDeployment(d *models.DeviceDeployment) error {
	d.UpdatedAt = time.Now()
	if d.ID == (uuid.UUID{}) {
		d.ID = uuid.New()
	}
	opts := options.Replace().SetUpsert(true)
	_, err := r.col("device_deployments").ReplaceOne(context.Background(),
		bson.M{"deployment_id": d.DeploymentID, "device_id": d.DeviceID},
		d,
		opts,
	)
	return err
}

func (r *Repository) ListDevicesByDeployment(deploymentID uuid.UUID) ([]models.DeviceDeployment, error) {
	ctx := context.Background()
	cursor, err := r.col("device_deployments").Find(ctx, bson.M{"deployment_id": deploymentID})
	if err != nil {
		return nil, err
	}
	var list []models.DeviceDeployment
	return list, cursor.All(ctx, &list)
}

func (r *Repository) FindDeviceDeployment(deploymentID, deviceID uuid.UUID) (*models.DeviceDeployment, error) {
	var d models.DeviceDeployment
	err := r.col("device_deployments").FindOne(context.Background(),
		bson.M{"deployment_id": deploymentID, "device_id": deviceID},
	).Decode(&d)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	return &d, err
}

func (r *Repository) FindEligibleDevices(deviceType string) ([]models.Device, error) {
	ctx := context.Background()
	cursor, err := r.col("devices").Find(ctx, bson.M{
		"device_type": deviceType,
		"status":      bson.M{"$ne": string(models.DeviceStatusDecommissioned)},
	})
	if err != nil {
		return nil, err
	}
	var list []models.Device
	return list, cursor.All(ctx, &list)
}

func (r *Repository) FindScheduledDeployments() ([]models.FirmwareDeployment, error) {
	ctx := context.Background()
	filter := bson.M{
		"status": "scheduled",
		"$or": bson.A{
			bson.M{"scheduled_at": nil},
			bson.M{"scheduled_at": bson.M{"$lte": time.Now()}},
		},
	}
	cursor, err := r.col("firmware_deployments").Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	var list []models.FirmwareDeployment
	return list, cursor.All(ctx, &list)
}

func (r *Repository) FindRunningDeployments() ([]models.FirmwareDeployment, error) {
	ctx := context.Background()
	cursor, err := r.col("firmware_deployments").Find(ctx, bson.M{"status": "running"})
	if err != nil {
		return nil, err
	}
	var list []models.FirmwareDeployment
	return list, cursor.All(ctx, &list)
}
