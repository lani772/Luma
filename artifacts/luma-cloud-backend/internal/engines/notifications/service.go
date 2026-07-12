package notifications

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
)

type UserPreferencesReader interface {
	GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (enabledTypes []string, pushToken *string, emailAddress *string, err error)
}

type PushProvider interface {
	Send(ctx context.Context, target string, title, body string, data map[string]any) error
}

type EmailProvider interface {
	SendEmail(ctx context.Context, email string, subject, body string) error
}

// Mock providers for FCM, APNs, and Email
type MockPushProvider struct {
	Name string
	Log  *slog.Logger
	Fail bool
}

func (m *MockPushProvider) Send(ctx context.Context, target string, title, body string, data map[string]any) error {
	m.Log.Info("mock_push_send", "provider", m.Name, "target", target, "title", title, "body", body)
	if m.Fail {
		return errors.New("simulated push delivery failure")
	}
	return nil
}

type MockEmailProvider struct {
	Log  *slog.Logger
	Fail bool
}

func (m *MockEmailProvider) SendEmail(ctx context.Context, email string, subject, body string) error {
	m.Log.Info("mock_email_send", "email", email, "subject", subject, "body", body)
	if m.Fail {
		return errors.New("simulated email delivery failure")
	}
	return nil
}

type Service struct {
	repo       *Repository
	userPrefs  UserPreferencesReader
	fcm        PushProvider
	apns       PushProvider
	email      EmailProvider
	log        *slog.Logger
}

func NewService(repo *Repository, userPrefs UserPreferencesReader, fcm, apns PushProvider, email EmailProvider, log *slog.Logger) *Service {
	return &Service{
		repo:      repo,
		userPrefs: userPrefs,
		fcm:       fcm,
		apns:      apns,
		email:     email,
		log:       log,
	}
}

func (s *Service) Create(ctx context.Context, req CreateNotificationRequest) (*NotificationDTO, error) {
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	// Fetch user preferences
	enabledTypes, pushToken, emailAddress, err := s.userPrefs.GetNotificationPreferences(ctx, userID)
	if err != nil {
		// Log but don't fail, fallback to sending system notifications at least
		s.log.Warn("failed_to_fetch_user_preferences", "error", err)
	}

	// Check if type is enabled
	isTypeEnabled := true
	if len(enabledTypes) > 0 {
		isTypeEnabled = false
		for _, t := range enabledTypes {
			if t == req.Type {
				isTypeEnabled = true
				break
			}
		}
	}

	if !isTypeEnabled {
		s.log.Info("notification_muted_by_user_preferences", "userId", userID, "type", req.Type)
		return nil, nil
	}

	notif := &models.Notification{
		ID:        uuid.New(),
		UserID:    userID,
		Type:      req.Type,
		Title:     req.Title,
		Body:      req.Body,
		Data:      models.JSONMap(req.Data),
		CreatedAt: time.Now(),
	}

	if err := s.repo.Create(notif); err != nil {
		return nil, err
	}

	// Enqueue deliveries if endpoints exist
	if pushToken != nil && *pushToken != "" {
		_ = s.repo.Enqueue(&models.NotificationQueueItem{
			ID:             uuid.New(),
			UserID:         userID,
			NotificationID: &notif.ID,
			Title:          notif.Title,
			Body:           notif.Body,
			Provider:       "fcm",
			Status:         "pending",
			NextAttemptAt:  time.Now(),
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		})
	}

	if emailAddress != nil && *emailAddress != "" {
		_ = s.repo.Enqueue(&models.NotificationQueueItem{
			ID:             uuid.New(),
			UserID:         userID,
			NotificationID: &notif.ID,
			Title:          notif.Title,
			Body:           notif.Body,
			Provider:       "email",
			Status:         "pending",
			NextAttemptAt:  time.Now(),
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		})
	}

	return toNotificationDTO(notif), nil
}

func (s *Service) List(userID uuid.UUID, page, perPage int) ([]NotificationDTO, int64, error) {
	list, total, err := s.repo.ListForUser(userID, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	dtoList := make([]NotificationDTO, 0, len(list))
	for _, n := range list {
		dtoList = append(dtoList, *toNotificationDTO(&n))
	}
	return dtoList, total, nil
}

func (s *Service) MarkRead(userID uuid.UUID, ids []uuid.UUID) error {
	return s.repo.MarkRead(userID, ids)
}

func (s *Service) SendDirect(ctx context.Context, item *models.NotificationQueueItem) error {
	var err error
	switch item.Provider {
	case "fcm":
		err = s.fcm.Send(ctx, "mock_push_token_for_user", item.Title, item.Body, nil)
	case "apns":
		err = s.apns.Send(ctx, "mock_apns_token_for_user", item.Title, item.Body, nil)
	case "email":
		err = s.email.SendEmail(ctx, "mock_email@example.com", item.Title, item.Body)
	default:
		return errors.New("unsupported provider")
	}
	return err
}

func (s *Service) Tick(ctx context.Context) {
	items, err := s.repo.FindPendingQueueItems()
	if err != nil {
		s.log.Error("failed_to_fetch_pending_queue_items", "error", err)
		return
	}

	for _, item := range items {
		err := s.SendDirect(ctx, &item)
		if err != nil {
			s.log.Warn("notification_delivery_failed", "id", item.ID, "error", err)
			item.RetryCount++
			if item.RetryCount >= 5 {
				item.Status = "failed"
			} else {
				// Exponential backoff
				backoff := time.Duration(math.Pow(2, float64(item.RetryCount))) * time.Minute
				item.NextAttemptAt = time.Now().Add(backoff)
			}
			errMsg := err.Error()
			item.ErrorMessage = &errMsg
		} else {
			s.log.Info("notification_delivered_successfully", "id", item.ID)
			item.Status = "sent"
		}
		_ = s.repo.SaveQueueItem(&item)
	}
}

func toNotificationDTO(n *models.Notification) *NotificationDTO {
	return &NotificationDTO{
		ID:        n.ID.String(),
		UserID:    n.UserID.String(),
		Type:      n.Type,
		Title:     n.Title,
		Body:      n.Body,
		Data:      map[string]any(n.Data),
		ReadAt:    n.ReadAt,
		CreatedAt: n.CreatedAt,
	}
}
