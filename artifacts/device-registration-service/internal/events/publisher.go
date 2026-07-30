package events

import (
	"context"
	"encoding/json"
	"log"
)

// Publisher defines the port for publishing domain events
type Publisher interface {
	Publish(ctx context.Context, eventType string, payload interface{}) error
}

type logPublisher struct{}

func NewLogPublisher() Publisher {
	return &logPublisher{}
}

func (p *logPublisher) Publish(ctx context.Context, eventType string, payload interface{}) error {
	bytes, _ := json.Marshal(payload)
	log.Printf("[EVENT SYSTEM] Publishing Event: %s, Payload: %s", eventType, string(bytes))
	return nil
}
