package services

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// PushNotification represents a push notification
type PushNotification struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"userId"`
	Title     string                 `json:"title"`
	Body      string                 `json:"body"`
	Icon      string                 `json:"icon,omitempty"`
	Badge     string                 `json:"badge,omitempty"`
	Tag       string                 `json:"tag,omitempty"`
	Priority  string                 `json:"priority"` // high, normal
	TTL       int                    `json:"ttl"`       // Time to live in seconds
	Data      map[string]interface{} `json:"data,omitempty"`
	CreatedAt time.Time              `json:"createdAt"`
	SentAt    *time.Time             `json:"sentAt,omitempty"`
	Failed    bool                   `json:"failed"`
}

// DeviceToken represents a device's push token
type DeviceToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	DeviceID  string    `json:"deviceId"`
	Token     string    `json:"token"`
	Platform  string    `json:"platform"` // ios, android, web
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// PushNotificationService handles push notifications
type PushNotificationService struct {
	tokens map[string][]*DeviceToken
	mu     sync.RWMutex
	queue  chan *PushNotification
	done   chan bool
}

// NewPushNotificationService creates a new push notification service
func NewPushNotificationService() *PushNotificationService {
	return &PushNotificationService{
		tokens: make(map[string][]*DeviceToken),
		queue:  make(chan *PushNotification, 1000),
		done:   make(chan bool),
	}
}

// RegisterDeviceToken registers a device token for push notifications
func (p *PushNotificationService) RegisterDeviceToken(userID, deviceID, token, platform string) (*DeviceToken, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	deviceToken := &DeviceToken{
		ID:        uuid.New().String(),
		UserID:    userID,
		DeviceID:  deviceID,
		Token:     token,
		Platform:  platform,
		Active:    true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	p.tokens[userID] = append(p.tokens[userID], deviceToken)
	log.Printf("Device token registered: %s for user %s", deviceID, userID)

	return deviceToken, nil
}

// UnregisterDeviceToken unregisters a device token
func (p *PushNotificationService) UnregisterDeviceToken(userID, token string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if tokens, exists := p.tokens[userID]; exists {
		for i, dt := range tokens {
			if dt.Token == token {
				p.tokens[userID] = append(tokens[:i], tokens[i+1:]...)
				log.Printf("Device token unregistered: %s", token)
				return nil
			}
		}
	}

	return fmt.Errorf("device token not found")
}

// SendNotification sends a push notification to a user
func (p *PushNotificationService) SendNotification(userID, title, body string, data map[string]interface{}) error {
	notification := &PushNotification{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     title,
		Body:      body,
		Data:      data,
		Priority:  "normal",
		TTL:       86400, // 24 hours
		CreatedAt: time.Now(),
	}

	select {
	case p.queue <- notification:
		return nil
	default:
		return fmt.Errorf("notification queue full")
	}
}

// SendNotificationWithPriority sends a priority push notification
func (p *PushNotificationService) SendNotificationWithPriority(userID, title, body, priority string, data map[string]interface{}) error {
	notification := &PushNotification{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     title,
		Body:      body,
		Data:      data,
		Priority:  priority,
		TTL:       86400,
		CreatedAt: time.Now(),
	}

	select {
	case p.queue <- notification:
		return nil
	default:
		return fmt.Errorf("notification queue full")
	}
}

// BroadcastNotification sends a notification to all users of a home
func (p *PushNotificationService) BroadcastNotification(userIDs []string, title, body string, data map[string]interface{}) error {
	for _, userID := range userIDs {
		if err := p.SendNotification(userID, title, body, data); err != nil {
			log.Printf("Failed to send notification to user %s: %v", userID, err)
		}
	}
	return nil
}

// Start starts the push notification worker
func (p *PushNotificationService) Start() {
	go func() {
		for {
			select {
			case notification := <-p.queue:
				p.processNotification(notification)
			case <-p.done:
				return
			}
		}
	}()
	log.Println("Push notification service started")
}

// processNotification processes and sends a notification
func (p *PushNotificationService) processNotification(notification *PushNotification) {
	p.mu.RLock()
	tokens, exists := p.tokens[notification.UserID]
	p.mu.RUnlock()

	if !exists || len(tokens) == 0 {
		log.Printf("No device tokens for user %s", notification.UserID)
		return
	}

	// Simulate sending to different platforms
	for _, deviceToken := range tokens {
		if !deviceToken.Active {
			continue
		}

		switch deviceToken.Platform {
		case "ios":
			p.sendIOSNotification(notification, deviceToken)
		case "android":
			p.sendAndroidNotification(notification, deviceToken)
		case "web":
			p.sendWebNotification(notification, deviceToken)
		}
	}

	now := time.Now()
	notification.SentAt = &now
	log.Printf("Notification sent: %s to user %s", notification.ID, notification.UserID)
}

// sendIOSNotification sends to iOS via APNs
func (p *PushNotificationService) sendIOSNotification(notification *PushNotification, deviceToken *DeviceToken) {
	// Implementation would use APNs (Apple Push Notification service)
	log.Printf("Sending iOS notification: %s to device %s", notification.Title, deviceToken.DeviceID)
	// TODO: Implement APNs integration
}

// sendAndroidNotification sends to Android via FCM
func (p *PushNotificationService) sendAndroidNotification(notification *PushNotification, deviceToken *DeviceToken) {
	// Implementation would use FCM (Firebase Cloud Messaging)
	log.Printf("Sending Android notification: %s to device %s", notification.Title, deviceToken.DeviceID)
	// TODO: Implement FCM integration
}

// sendWebNotification sends to Web via Web Push API
func (p *PushNotificationService) sendWebNotification(notification *PushNotification, deviceToken *DeviceToken) {
	// Implementation would use Web Push Protocol
	log.Printf("Sending Web notification: %s to device %s", notification.Title, deviceToken.DeviceID)
	// TODO: Implement Web Push API integration
}

// Stop stops the push notification service
func (p *PushNotificationService) Stop() {
	close(p.done)
	log.Println("Push notification service stopped")
}

// GetDeviceTokens returns device tokens for a user
func (p *PushNotificationService) GetDeviceTokens(userID string) []*DeviceToken {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if tokens, exists := p.tokens[userID]; exists {
		return tokens
	}
	return []*DeviceToken{}
}
