// Package mqttadapter is the ONLY place in this backend allowed to know
// which MQTT broker is deployed. Every engine that needs to reach a device
// (MQTT Broker Adapter Engine's own HTTP surface, and later Scene/Schedule,
// Notification, etc.) depends on the Adapter interface below, never on
// eclipse/paho.mqtt.golang or a broker hostname directly. Swapping
// mqtt.luma.local for a managed broker (EMQX, HiveMQ Cloud, AWS IoT Core,
// ...) later means writing a new implementation of this interface and
// changing one line of dependency-injection wiring in cmd/api/main.go — no
// engine code changes.
package mqttadapter

import (
	"context"
	"errors"
	"time"
)

var ErrNotConnected = errors.New("mqttadapter: not connected to broker")

// Message is a broker-agnostic representation of an inbound/outbound MQTT
// message, so callers never touch paho's types.
type Message struct {
	Topic   string
	Payload []byte
	QoS     byte
	Retain  bool
}

// Handler processes an inbound message on a subscribed topic.
type Handler func(msg Message)

// Adapter is the seam between this backend and whatever MQTT broker is
// currently deployed.
type Adapter interface {
	// Connect establishes the broker connection. Safe to call once at
	// startup; Publish/Subscribe return ErrNotConnected if called before a
	// successful Connect or after the connection is lost and not yet
	// re-established.
	Connect(ctx context.Context) error
	Disconnect(timeout time.Duration)
	IsConnected() bool

	Publish(ctx context.Context, topic string, qos byte, retain bool, payload []byte) error
	Subscribe(ctx context.Context, topic string, qos byte, handler Handler) error
	Unsubscribe(ctx context.Context, topic string) error

	// Health reports broker connectivity for operator-facing status
	// endpoints (GET /cloud/engines/mqtt/health).
	Health() HealthStatus
}

type HealthStatus struct {
	Connected  bool      `json:"connected"`
	BrokerURL  string    `json:"brokerUrl"`
	CheckedAt  time.Time `json:"checkedAt"`
	LastError  string    `json:"lastError,omitempty"`
}
