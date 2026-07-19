package users

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

func (r *Repository) FindByID(id uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.col("users").FindOne(context.Background(), bson.M{"_id": id}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &u, err
}

func (r *Repository) UpdateProfile(id uuid.UUID, fullName *string) error {
	updates := bson.M{"updated_at": time.Now()}
	if fullName != nil {
		updates["full_name"] = *fullName
	}
	_, err := r.col("users").UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": updates})
	return err
}

func (r *Repository) UpdateUsername(id uuid.UUID, username string) error {
	_, err := r.col("users").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"username": username, "updated_at": time.Now()}},
	)
	return err
}

func (r *Repository) UsernameExists(username string, excludeUserID uuid.UUID) (bool, error) {
	filter := bson.M{"username": username}
	if excludeUserID != uuid.Nil {
		filter["_id"] = bson.M{"$ne": excludeUserID}
	}
	count, err := r.col("users").CountDocuments(context.Background(), filter)
	return count > 0, err
}

func (r *Repository) UpdatePreferences(id uuid.UUID, prefs models.JSONMap) error {
	_, err := r.col("users").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"preferences": prefs, "updated_at": time.Now()}},
	)
	return err
}

func (r *Repository) ListPhones(userID uuid.UUID) ([]models.UserPhone, error) {
	ctx := context.Background()
	opts := options.Find().SetSort(bson.D{{Key: "last_seen_at", Value: -1}})
	cursor, err := r.col("user_phones").Find(ctx, bson.M{"user_id": userID, "revoked_at": nil}, opts)
	if err != nil {
		return nil, err
	}
	var phones []models.UserPhone
	return phones, cursor.All(ctx, &phones)
}

func (r *Repository) FindPhone(userID, phoneID uuid.UUID) (*models.UserPhone, error) {
	var phone models.UserPhone
	err := r.col("user_phones").FindOne(context.Background(),
		bson.M{"_id": phoneID, "user_id": userID},
	).Decode(&phone)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &phone, err
}

func (r *Repository) RevokePhone(phoneID uuid.UUID) error {
	_, err := r.col("user_phones").UpdateOne(context.Background(),
		bson.M{"_id": phoneID},
		bson.M{"$set": bson.M{"revoked_at": time.Now()}},
	)
	return err
}

func (r *Repository) RevokeSessionsForPhone(phoneID uuid.UUID) error {
	_, err := r.col("sessions").UpdateMany(context.Background(),
		bson.M{"phone_id": phoneID, "revoked_at": nil},
		bson.M{"$set": bson.M{"revoked_at": time.Now()}},
	)
	return err
}

func (r *Repository) RevokeAllSessions(userID uuid.UUID) error {
	_, err := r.col("sessions").UpdateMany(context.Background(),
		bson.M{"user_id": userID, "revoked_at": nil},
		bson.M{"$set": bson.M{"revoked_at": time.Now()}},
	)
	return err
}

func (r *Repository) MarkDeleted(id uuid.UUID) error {
	_, err := r.col("users").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"status": models.UserStatusDeleted, "updated_at": time.Now()}},
	)
	return err
}
