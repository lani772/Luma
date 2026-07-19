package notifications

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

func (r *Repository) Create(n *models.Notification) error {
	_, err := r.col("notifications").InsertOne(context.Background(), n)
	return err
}

func (r *Repository) FindByID(id uuid.UUID) (*models.Notification, error) {
	var n models.Notification
	err := r.col("notifications").FindOne(context.Background(), bson.M{"_id": id}).Decode(&n)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, errors.New("notification not found")
	}
	return &n, err
}

func (r *Repository) ListForUser(userID uuid.UUID, page, perPage int) ([]models.Notification, int64, error) {
	ctx := context.Background()
	filter := bson.M{"user_id": userID}

	total, err := r.col("notifications").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * perPage)).
		SetLimit(int64(perPage))

	cursor, err := r.col("notifications").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	var list []models.Notification
	return list, total, cursor.All(ctx, &list)
}

func (r *Repository) MarkRead(userID uuid.UUID, ids []uuid.UUID) error {
	_, err := r.col("notifications").UpdateMany(context.Background(),
		bson.M{"user_id": userID, "_id": bson.M{"$in": ids}},
		bson.M{"$set": bson.M{"read_at": time.Now()}},
	)
	return err
}

func (r *Repository) Enqueue(item *models.NotificationQueueItem) error {
	_, err := r.col("notification_queue").InsertOne(context.Background(), item)
	return err
}

func (r *Repository) FindPendingQueueItems() ([]models.NotificationQueueItem, error) {
	ctx := context.Background()
	cursor, err := r.col("notification_queue").Find(ctx, bson.M{
		"status":          "pending",
		"next_attempt_at": bson.M{"$lte": time.Now()},
	})
	if err != nil {
		return nil, err
	}
	var list []models.NotificationQueueItem
	return list, cursor.All(ctx, &list)
}

func (r *Repository) SaveQueueItem(item *models.NotificationQueueItem) error {
	item.UpdatedAt = time.Now()
	opts := options.Replace().SetUpsert(true)
	_, err := r.col("notification_queue").ReplaceOne(context.Background(),
		bson.M{"_id": item.ID},
		item,
		opts,
	)
	return err
}
