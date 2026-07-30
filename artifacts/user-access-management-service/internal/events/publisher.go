package events

import (
	"encoding/json"
	"log"
	"time"
)

type Event struct {
	EventName string    `json:"eventName"`
	Payload   any       `json:"payload"`
	Timestamp time.Time `json:"timestamp"`
}

type Publisher struct{}

func NewPublisher() *Publisher {
	return &Publisher{}
}

func (p *Publisher) Publish(eventName string, payload any) {
	evt := Event{
		EventName: eventName,
		Payload:   payload,
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(evt)
	if err != nil {
		log.Printf("[events] failed to marshal event %s: %v", eventName, err)
		return
	}

	log.Printf("[events] PUBLISH: %s", string(data))
}
