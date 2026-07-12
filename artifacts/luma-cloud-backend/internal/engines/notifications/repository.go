package notifications

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(n *models.Notification) error {
	return r.db.Create(n).Error
}

func (r *Repository) FindByID(id uuid.UUID) (*models.Notification, error) {
	var n models.Notification
	err := r.db.Where("id = ?", id).First(&n).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("notification not found")
		}
		return nil, err
	}
	return &n, nil
}

func (r *Repository) ListForUser(userID uuid.UUID, page, perPage int) ([]models.Notification, int64, error) {
	var total int64
	if err := r.db.Model(&models.Notification{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var list []models.Notification
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *Repository) MarkRead(userID uuid.UUID, ids []uuid.UUID) error {
	return r.db.Model(&models.Notification{}).
		Where("user_id = ? AND id IN ?", userID, ids).
		Update("read_at", time.Now()).Error
}

func (r *Repository) Enqueue(item *models.NotificationQueueItem) error {
	return r.db.Create(item).Error
}

func (r *Repository) FindPendingQueueItems() ([]models.NotificationQueueItem, error) {
	var list []models.NotificationQueueItem
	err := r.db.Where("status = ? AND next_attempt_at <= ?", "pending", time.Now()).Find(&list).Error
	return list, err
}

func (r *Repository) SaveQueueItem(item *models.NotificationQueueItem) error {
	item.UpdatedAt = time.Now()
	return r.db.Save(item).Error
}
