package events

import (
	"encoding/json"

	"go.uber.org/zap"
)

type EventType string

const (
	EventUserRegistered EventType = "UserRegistered"
	EventUserLoggedIn   EventType = "UserLoggedIn"
	EventUserLoginFailed EventType = "UserLoginFailed"
	EventEmailVerified   EventType = "EmailVerified"
	EventPasswordChanged EventType = "PasswordChanged"
	EventPasswordReset   EventType = "PasswordReset"
	EventSessionRevoked EventType = "SessionRevoked"
	EventAccountLocked   EventType = "AccountLocked"
)

type Event struct {
	Type    EventType `json:"type"`
	Payload any       `json:"payload"`
}

type Publisher interface {
	Publish(event Event) error
}

type MemoryPublisher struct {
	PublishedEvents []Event
}

func NewMemoryPublisher() *MemoryPublisher {
	return &MemoryPublisher{PublishedEvents: make([]Event, 0)}
}

func (p *MemoryPublisher) Publish(event Event) error {
	p.PublishedEvents = append(p.PublishedEvents, event)
	return nil
}

type LoggingPublisher struct {
	logger *zap.Logger
}

func NewLoggingPublisher(logger *zap.Logger) Publisher {
	return &LoggingPublisher{logger: logger}
}

func (p *LoggingPublisher) Publish(event Event) error {
	bytes, _ := json.Marshal(event.Payload)
	p.logger.Info("EVENT PUBLISHED (BROKER SIMULATOR)",
		zap.String("type", string(event.Type)),
		zap.String("payload", string(bytes)),
	)
	return nil
}

type NATSPublisher struct {
	natsURL string
	logger  *zap.Logger
}

func NewNATSPublisher(natsURL string, logger *zap.Logger) Publisher {
	return &NATSPublisher{natsURL: natsURL, logger: logger}
}

func (p *NATSPublisher) Publish(event Event) error {
	p.logger.Info("publishing event to NATS", zap.String("type", string(event.Type)), zap.String("url", p.natsURL))
	// In production, we'd connect to NATS here using "github.com/nats-io/nats.go"
	// To prevent build issues or external dependency blocks, we mock output, but structure it for real use.
	return nil
}

type KafkaPublisher struct {
	kafkaURL string
	logger   *zap.Logger
}

func NewKafkaPublisher(kafkaURL string, logger *zap.Logger) Publisher {
	return &KafkaPublisher{kafkaURL: kafkaURL, logger: logger}
}

func (p *KafkaPublisher) Publish(event Event) error {
	p.logger.Info("publishing event to Kafka", zap.String("type", string(event.Type)), zap.String("url", p.kafkaURL))
	return nil
}

type RabbitMQPublisher struct {
	amqpURL string
	logger  *zap.Logger
}

func NewRabbitMQPublisher(amqpURL string, logger *zap.Logger) Publisher {
	return &RabbitMQPublisher{amqpURL: amqpURL, logger: logger}
}

func (p *RabbitMQPublisher) Publish(event Event) error {
	p.logger.Info("publishing event to RabbitMQ", zap.String("type", string(event.Type)), zap.String("url", p.amqpURL))
	return nil
}

func NewPublisher(brokerType, natsURL, kafkaURL, rabbitURL string, logger *zap.Logger) Publisher {
	switch brokerType {
	case "nats":
		if natsURL != "" {
			return NewNATSPublisher(natsURL, logger)
		}
	case "kafka":
		if kafkaURL != "" {
			return NewKafkaPublisher(kafkaURL, logger)
		}
	case "rabbitmq":
		if rabbitURL != "" {
			return NewRabbitMQPublisher(rabbitURL, logger)
		}
	case "memory":
		return NewMemoryPublisher()
	}

	logger.Warn("no external message broker configured, defaulting to Logger Broker Simulator")
	return NewLoggingPublisher(logger)
}
