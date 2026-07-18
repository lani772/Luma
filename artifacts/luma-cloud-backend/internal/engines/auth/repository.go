package auth

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

func (r *Repository) col(name string) *mongo.Collection {
	return r.db.Collection(name)
}

func (r *Repository) CreateUser(u *models.User) error {
	_, err := r.col("users").InsertOne(context.Background(), u)
	return err
}

func (r *Repository) FindUserByEmail(email string) (*models.User, error) {
	var u models.User
	err := r.col("users").FindOne(context.Background(), bson.M{"email": email}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &u, err
}

func (r *Repository) FindUserByUsername(username string) (*models.User, error) {
	var u models.User
	err := r.col("users").FindOne(context.Background(), bson.M{"username": username}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &u, err
}

func (r *Repository) UsernameExists(username string) (bool, error) {
	count, err := r.col("users").CountDocuments(context.Background(), bson.M{"username": username})
	return count > 0, err
}

func (r *Repository) FindUserByID(id string) (*models.User, error) {
	parsed, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	var u models.User
	err = r.col("users").FindOne(context.Background(), bson.M{"_id": parsed}).Decode(&u)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &u, err
}

func (r *Repository) UpdateUserPassword(userID uuid.UUID, passwordHash string) error {
	_, err := r.col("users").UpdateOne(context.Background(),
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"password_hash": passwordHash, "updated_at": time.Now()}},
	)
	return err
}

func (r *Repository) MarkEmailVerified(userID uuid.UUID) error {
	now := time.Now()
	_, err := r.col("users").UpdateOne(context.Background(),
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{"email_verified_at": now, "updated_at": now}},
	)
	return err
}

func (r *Repository) CreatePhone(p *models.UserPhone) error {
	_, err := r.col("user_phones").InsertOne(context.Background(), p)
	return err
}

// FindOrCreatePhone reuses an existing (unrevoked) phone row for the same
// user+device+platform so repeated logins from the same physical phone don't
// pile up duplicate phone rows.
func (r *Repository) FindOrCreatePhone(userID uuid.UUID, deviceName, platform, pushToken string) (*models.UserPhone, error) {
	ctx := context.Background()
	var phone models.UserPhone
	err := r.col("user_phones").FindOne(ctx, bson.M{
		"user_id":     userID,
		"device_name": deviceName,
		"platform":    platform,
		"revoked_at":  nil,
	}).Decode(&phone)

	if err == nil {
		updates := bson.M{"last_seen_at": time.Now()}
		if pushToken != "" {
			updates["push_token"] = pushToken
		}
		if _, err2 := r.col("user_phones").UpdateOne(ctx, bson.M{"_id": phone.ID}, bson.M{"$set": updates}); err2 != nil {
			return nil, err2
		}
		return &phone, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}

	now := time.Now()
	phone = models.UserPhone{
		ID:         uuid.New(),
		UserID:     userID,
		DeviceName: deviceName,
		Platform:   models.Platform(platform),
		LastSeenAt: &now,
		CreatedAt:  now,
	}
	if pushToken != "" {
		phone.PushToken = &pushToken
	}
	if _, err2 := r.col("user_phones").InsertOne(ctx, &phone); err2 != nil {
		return nil, err2
	}
	return &phone, nil
}

func (r *Repository) ListPhonesForUser(userID uuid.UUID) ([]models.UserPhone, error) {
	ctx := context.Background()
	opts := options.Find().SetSort(bson.D{{Key: "last_seen_at", Value: -1}})
	cursor, err := r.col("user_phones").Find(ctx, bson.M{"user_id": userID, "revoked_at": nil}, opts)
	if err != nil {
		return nil, err
	}
	var phones []models.UserPhone
	return phones, cursor.All(ctx, &phones)
}

func (r *Repository) CreateSession(s *models.Session) error {
	_, err := r.col("sessions").InsertOne(context.Background(), s)
	return err
}

func (r *Repository) FindSessionByRefreshHash(hash string) (*models.Session, error) {
	var s models.Session
	err := r.col("sessions").FindOne(context.Background(), bson.M{"refresh_token_hash": hash}).Decode(&s)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &s, err
}

func (r *Repository) RevokeSession(id uuid.UUID) error {
	_, err := r.col("sessions").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"revoked_at": time.Now()}},
	)
	return err
}

func (r *Repository) RevokeAllSessionsForUser(userID uuid.UUID) error {
	_, err := r.col("sessions").UpdateMany(context.Background(),
		bson.M{"user_id": userID, "revoked_at": nil},
		bson.M{"$set": bson.M{"revoked_at": time.Now()}},
	)
	return err
}

func (r *Repository) ListActiveSessionsForUser(userID uuid.UUID) ([]models.Session, error) {
	ctx := context.Background()
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.col("sessions").Find(ctx, bson.M{
		"user_id":    userID,
		"revoked_at": nil,
		"expires_at": bson.M{"$gt": time.Now()},
	}, opts)
	if err != nil {
		return nil, err
	}
	var sessions []models.Session
	return sessions, cursor.All(ctx, &sessions)
}

func (r *Repository) CreatePasswordResetToken(t *models.PasswordResetToken) error {
	_, err := r.col("password_reset_tokens").InsertOne(context.Background(), t)
	return err
}

func (r *Repository) FindPasswordResetToken(hash string) (*models.PasswordResetToken, error) {
	var t models.PasswordResetToken
	err := r.col("password_reset_tokens").FindOne(context.Background(), bson.M{"token_hash": hash}).Decode(&t)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &t, err
}

func (r *Repository) MarkPasswordResetTokenUsed(id uuid.UUID) error {
	_, err := r.col("password_reset_tokens").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"used_at": time.Now()}},
	)
	return err
}

func (r *Repository) CreateEmailVerificationToken(t *models.EmailVerificationToken) error {
	_, err := r.col("email_verification_tokens").InsertOne(context.Background(), t)
	return err
}

func (r *Repository) FindEmailVerificationToken(hash string) (*models.EmailVerificationToken, error) {
	var t models.EmailVerificationToken
	err := r.col("email_verification_tokens").FindOne(context.Background(), bson.M{"token_hash": hash}).Decode(&t)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}
	return &t, err
}

func (r *Repository) MarkEmailVerificationTokenUsed(id uuid.UUID) error {
	_, err := r.col("email_verification_tokens").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"used_at": time.Now()}},
	)
	return err
}
