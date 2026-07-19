package backup

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

func (r *Repository) Create(b *models.Backup) error {
	_, err := r.col("backups").InsertOne(context.Background(), b)
	return err
}

func (r *Repository) FindByID(id uuid.UUID) (*models.Backup, error) {
	var b models.Backup
	err := r.col("backups").FindOne(context.Background(), bson.M{"_id": id}).Decode(&b)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, errors.New("backup not found")
	}
	return &b, err
}

func (r *Repository) ListForUser(userID uuid.UUID, page, perPage int) ([]models.Backup, int64, error) {
	ctx := context.Background()
	filter := bson.M{"user_id": userID}

	total, err := r.col("backups").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * perPage)).
		SetLimit(int64(perPage))

	cursor, err := r.col("backups").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	var list []models.Backup
	return list, total, cursor.All(ctx, &list)
}

func (r *Repository) Delete(id uuid.UUID) error {
	_, err := r.col("backups").DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

func (r *Repository) GetUserSyncRecords(userID uuid.UUID) ([]models.CloudSyncRecord, error) {
	ctx := context.Background()
	cursor, err := r.col("cloud_sync_records").Find(ctx, bson.M{"user_id": userID, "deleted": false})
	if err != nil {
		return nil, err
	}
	var list []models.CloudSyncRecord
	return list, cursor.All(ctx, &list)
}

func (r *Repository) SaveSyncRecord(rec *models.CloudSyncRecord) error {
	rec.UpdatedAt = time.Now()
	if rec.ID == (uuid.UUID{}) {
		rec.ID = uuid.New()
	}
	opts := options.Replace().SetUpsert(true)
	_, err := r.col("cloud_sync_records").ReplaceOne(context.Background(),
		bson.M{"user_id": rec.UserID, "resource_type": rec.ResourceType, "resource_id": rec.ResourceID},
		rec,
		opts,
	)
	return err
}

func (r *Repository) ListAllUsers() ([]uuid.UUID, error) {
	ctx := context.Background()
	cursor, err := r.col("users").Find(ctx, bson.M{}, options.Find().SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return nil, err
	}
	var docs []struct {
		ID uuid.UUID `bson:"_id"`
	}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, 0, len(docs))
	for _, d := range docs {
		ids = append(ids, d.ID)
	}
	return ids, nil
}
