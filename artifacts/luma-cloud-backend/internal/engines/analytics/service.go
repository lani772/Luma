package analytics

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Ingest(ctx context.Context, userID *uuid.UUID, req IngestEventRequest) (*models.AnalyticsEvent, error) {
	var devID *uuid.UUID
	if req.DeviceID != nil && *req.DeviceID != "" {
		if parsed, err := uuid.Parse(*req.DeviceID); err == nil {
			devID = &parsed
		}
	}

	event := &models.AnalyticsEvent{
		ID:        uuid.New(),
		DeviceID:  devID,
		UserID:    userID,
		EventType: req.EventType,
		Payload:   models.JSONMap(req.Payload),
		CreatedAt: time.Now(),
	}

	if err := s.repo.InsertEvent(event); err != nil {
		return nil, err
	}

	return event, nil
}

func (s *Service) QueryDashboard(ctx context.Context, deviceID uuid.UUID, period string) (*DashboardSummaryDTO, error) {
	end := time.Now()
	var start time.Time

	switch period {
	case "daily":
		start = end.AddDate(0, 0, -1)
	case "weekly":
		start = end.AddDate(0, 0, -7)
	case "monthly":
		start = end.AddDate(0, -1, 0)
	case "yearly":
		start = end.AddDate(-1, 0, 0)
	default:
		start = end.AddDate(0, 0, -7)
	}

	rollups, err := s.repo.QueryRollups(deviceID, start, end)
	if err != nil {
		return nil, err
	}

	totalEvents, _ := s.repo.CountRawEvents(start, end)

	dtoRollups := make([]RollupDTO, 0, len(rollups))
	metrics := make(map[string]float64)

	for _, r := range rollups {
		dtoRollups = append(dtoRollups, RollupDTO{
			DeviceID: r.DeviceID.String(),
			Date:     r.Date,
			Metric:   r.Metric,
			Value:    r.Value,
		})
		metrics[r.Metric] += r.Value
	}

	return &DashboardSummaryDTO{
		TotalEvents: int(totalEvents),
		Metrics:     metrics,
		Rollups:     dtoRollups,
	}, nil
}

func (s *Service) Tick(ctx context.Context) {
	end := time.Now()
	start := end.AddDate(0, 0, -1)

	aggregates, err := s.repo.AggregateRawMetrics(start, end)
	if err == nil {
		for _, agg := range aggregates {
			_ = s.repo.SaveRollup(&models.AnalyticsDailyRollup{
				ID:        uuid.New(),
				DeviceID:  agg.DeviceID,
				Date:      start,
				Metric:    agg.Metric,
				Value:     agg.Value,
				CreatedAt: time.Now(),
			})
		}
	}
}
