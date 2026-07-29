package webhooks

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// WebhookEvent represents a webhook event
type WebhookEvent struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

// Webhook represents a registered webhook
type Webhook struct {
	ID          string    `json:"id"`
	HomeID      string    `json:"homeId"`
	URL         string    `json:"url"`
	Events      []string  `json:"events"` // e.g. ["device.toggled", "energy.updated"]
	Secret      string    `json:"secret"`
	Active      bool      `json:"active"`
	MaxRetries  int       `json:"maxRetries"`
	Timeout     int       `json:"timeout"` // seconds
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	LastTriggeredAt *time.Time `json:"lastTriggeredAt,omitempty"`
}

// WebhookDelivery tracks a webhook delivery attempt
type WebhookDelivery struct {
	ID           string    `json:"id"`
	WebhookID    string    `json:"webhookId"`
	EventID      string    `json:"eventId"`
	StatusCode   int       `json:"statusCode"`
	Response     string    `json:"response"`
	Error        string    `json:"error,omitempty"`
	AttemptCount int       `json:"attemptCount"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// WebhookManager manages webhooks and deliveries
type WebhookManager struct {
	webhooks      map[string]*Webhook
	deliveries    map[string]*WebhookDelivery
	eventQueue    chan *WebhookEvent
	mu            sync.RWMutex
	deliveryMu    sync.RWMutex
	httpClient    *http.Client
	done          chan bool
}

// NewWebhookManager creates a new webhook manager
func NewWebhookManager() *WebhookManager {
	return &WebhookManager{
		webhooks:   make(map[string]*Webhook),
		deliveries: make(map[string]*WebhookDelivery),
		eventQueue: make(chan *WebhookEvent, 1000),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		done: make(chan bool),
	}
}

// RegisterWebhook registers a new webhook
func (wm *WebhookManager) RegisterWebhook(homeID, url string, events []string, secret string) (*Webhook, error) {
	if url == "" {
		return nil, fmt.Errorf("webhook URL is required")
	}

	webhook := &Webhook{
		ID:         uuid.New().String(),
		HomeID:     homeID,
		URL:        url,
		Events:     events,
		Secret:     secret,
		Active:     true,
		MaxRetries: 3,
		Timeout:    10,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	wm.mu.Lock()
	defer wm.mu.Unlock()

	wm.webhooks[webhook.ID] = webhook
	log.Printf("Webhook registered: %s for home %s", webhook.ID, homeID)

	return webhook, nil
}

// UnregisterWebhook removes a webhook
func (wm *WebhookManager) UnregisterWebhook(webhookID string) error {
	wm.mu.Lock()
	defer wm.mu.Unlock()

	if _, exists := wm.webhooks[webhookID]; !exists {
		return fmt.Errorf("webhook not found")
	}

	delete(wm.webhooks, webhookID)
	log.Printf("Webhook unregistered: %s", webhookID)

	return nil
}

// UpdateWebhook updates a webhook
func (wm *WebhookManager) UpdateWebhook(webhookID string, updates map[string]interface{}) (*Webhook, error) {
	wm.mu.Lock()
	webhook, exists := wm.webhooks[webhookID]
	wm.mu.Unlock()

	if !exists {
		return nil, fmt.Errorf("webhook not found")
	}

	if url, ok := updates["url"].(string); ok {
		webhook.URL = url
	}
	if events, ok := updates["events"].([]string); ok {
		webhook.Events = events
	}
	if active, ok := updates["active"].(bool); ok {
		webhook.Active = active
	}
	if maxRetries, ok := updates["maxRetries"].(float64); ok {
		webhook.MaxRetries = int(maxRetries)
	}

	webhook.UpdatedAt = time.Now()

	wm.mu.Lock()
	wm.webhooks[webhookID] = webhook
	wm.mu.Unlock()

	return webhook, nil
}

// TriggerEvent queues a webhook event for delivery
func (wm *WebhookManager) TriggerEvent(eventType string, data map[string]interface{}) {
	event := &WebhookEvent{
		ID:        uuid.New().String(),
		Type:      eventType,
		Timestamp: time.Now(),
		Data:      data,
	}

	select {
	case wm.eventQueue <- event:
	default:
		log.Printf("Webhook event queue full, dropping event: %s", eventType)
	}
}

// Start starts the webhook delivery worker
func (wm *WebhookManager) Start() {
	go func() {
		for {
			select {
			case event := <-wm.eventQueue:
				wm.deliverEvent(event)
			case <-wm.done:
				return
			}
		}
	}()

	log.Println("Webhook manager started")
}

// deliverEvent delivers an event to all matching webhooks
func (wm *WebhookManager) deliverEvent(event *WebhookEvent) {
	wm.mu.RLock()
	webhooks := make([]*Webhook, 0)
	for _, webhook := range wm.webhooks {
		if !webhook.Active {
			continue
		}

		// Check if webhook is subscribed to this event
		for _, eventType := range webhook.Events {
			if eventType == event.Type || eventType == "*" {
				webhooks = append(webhooks, webhook)
				break
			}
		}
	}
	wm.mu.RUnlock()

	for _, webhook := range webhooks {
		wm.deliverToWebhook(webhook, event)
	}
}

// deliverToWebhook delivers an event to a specific webhook
func (wm *WebhookManager) deliverToWebhook(webhook *Webhook, event *WebhookEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		log.Printf("Failed to marshal webhook event: %v", err)
		return
	}

	// Calculate HMAC signature
	signature := wm.calculateSignature(payload, webhook.Secret)

	var lastErr error
	for attempt := 1; attempt <= webhook.MaxRetries; attempt++ {
		delivery := &WebhookDelivery{
			ID:           uuid.New().String(),
			WebhookID:    webhook.ID,
			EventID:      event.ID,
			AttemptCount: attempt,
			CreatedAt:    time.Now(),
		}

		req, _ := http.NewRequest("POST", webhook.URL, bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Luma-Webhook-ID", webhook.ID)
		req.Header.Set("X-Luma-Event-ID", event.ID)
		req.Header.Set("X-Luma-Event-Type", event.Type)
		req.Header.Set("X-Luma-Timestamp", event.Timestamp.Format(time.RFC3339))
		req.Header.Set("X-Luma-Signature", signature)

		resp, err := wm.httpClient.Do(req)
		if err != nil {
			lastErr = err
			delivery.Error = err.Error()

			if attempt < webhook.MaxRetries {
				// Exponential backoff before retry
				time.Sleep(time.Duration(attempt*attempt) * time.Second)
				continue
			}
		} else {
			delivery.StatusCode = resp.StatusCode

			// Read response body
			buf := new(bytes.Buffer)
			buf.ReadFrom(resp.Body)
			delivery.Response = buf.String()
			resp.Body.Close()

			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				// Success
				wm.storeDelivery(delivery)
				now := time.Now()
				webhook.LastTriggeredAt = &now
				return
			} else if resp.StatusCode >= 400 && resp.StatusCode < 500 {
				// Client error - don't retry
				wm.storeDelivery(delivery)
				return
			}

			if attempt < webhook.MaxRetries {
				time.Sleep(time.Duration(attempt*attempt) * time.Second)
			}
		}
	}

	// All retries failed
	if lastErr != nil {
		log.Printf("Webhook delivery failed after %d attempts: %s to %s", webhook.MaxRetries, event.Type, webhook.URL)
	}
}

// calculateSignature calculates HMAC-SHA256 signature
func (wm *WebhookManager) calculateSignature(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return "sha256=" + hex.EncodeToString(h.Sum(nil))
}

// storeDelivery stores a delivery record
func (wm *WebhookManager) storeDelivery(delivery *WebhookDelivery) {
	delivery.UpdatedAt = time.Now()

	wm.deliveryMu.Lock()
	defer wm.deliveryMu.Unlock()

	wm.deliveries[delivery.ID] = delivery

	// Keep only last 1000 deliveries
	if len(wm.deliveries) > 10000 {
		// Delete oldest entries
		for id := range wm.deliveries {
			delete(wm.deliveries, id)
			break
		}
	}
}

// GetWebhooks returns all webhooks for a home
func (wm *WebhookManager) GetWebhooks(homeID string) []*Webhook {
	wm.mu.RLock()
	defer wm.mu.RUnlock()

	var webhooks []*Webhook
	for _, webhook := range wm.webhooks {
		if webhook.HomeID == homeID {
			webhooks = append(webhooks, webhook)
		}
	}

	return webhooks
}

// GetDeliveries returns delivery records for a webhook
func (wm *WebhookManager) GetDeliveries(webhookID string, limit int) []*WebhookDelivery {
	wm.deliveryMu.RLock()
	defer wm.deliveryMu.RUnlock()

	var deliveries []*WebhookDelivery
	for _, delivery := range wm.deliveries {
		if delivery.WebhookID == webhookID {
			deliveries = append(deliveries, delivery)
			if len(deliveries) >= limit {
				break
			}
		}
	}

	return deliveries
}

// Stop stops the webhook manager
func (wm *WebhookManager) Stop() {
	close(wm.done)
	log.Println("Webhook manager stopped")
}
