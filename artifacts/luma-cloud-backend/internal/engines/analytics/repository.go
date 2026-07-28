package analytics

import (
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

func (r *Repository) InsertEvent(ev *models.AnalyticsEvent) error {
	return r.db.Create(ev).Error
}

func (r *Repository) SaveRollup(rollup *models.AnalyticsDailyRollup) error {
	return r.db.Save(rollup).Error
}

func (r *Repository) QueryRollups(deviceID uuid.UUID, start, end time.Time) ([]models.AnalyticsDailyRollup, error) {
	var list []models.AnalyticsDailyRollup
	err := r.db.Where("device_id = ? AND date >= ? AND date <= ?", deviceID, start, end).Order("date ASC").Find(&list).Error
	return list, err
}

func (r *Repository) CountRawEvents(start, end time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&models.AnalyticsEvent{}).Where("created_at >= ? AND created_at <= ?", start, end).Count(&count).Error
	return count, err
}

func (r *Repository) AggregateRawMetrics(start, end time.Time) ([]struct {
	DeviceID uuid.UUID
	Metric   string
	Value    float64
}, error) {
	var results []struct {
		DeviceID uuid.UUID
		Metric   string
		Value    float64
	}
	err := r.db.Model(&models.AnalyticsEvent{}).
		Select("device_id, event_type as metric, COUNT(*) as value").
		Where("created_at >= ? AND created_at <= ? AND device_id IS NOT NULL", start, end).
		Group("device_id, event_type").
		Scan(&results).Error
	return results, err
}
