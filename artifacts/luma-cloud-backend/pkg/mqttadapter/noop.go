package mqttadapter

import (
	"context"
	"time"
)

// NoopAdapter is used when no broker is reachable in the current
// environment (e.g. local dev without mqtt.luma.local access). It never
// pretends to be connected — every call fails loudly with ErrNotConnected
// instead of silently no-oping, matching the project's convention that
// simulated/degraded subsystems must say so.
type NoopAdapter struct{}

func NewNoopAdapter() *NoopAdapter { return &NoopAdapter{} }

func (NoopAdapter) Connect(ctx context.Context) error { return nil }
func (NoopAdapter) Disconnect(time.Duration)          {}
func (NoopAdapter) IsConnected() bool                 { return false }

func (NoopAdapter) Publish(ctx context.Context, topic string, qos byte, retain bool, payload []byte) error {
	return ErrNotConnected
}
func (NoopAdapter) Subscribe(ctx context.Context, topic string, qos byte, handler Handler) error {
	return ErrNotConnected
}
func (NoopAdapter) Unsubscribe(ctx context.Context, topic string) error { return ErrNotConnected }

func (NoopAdapter) Health() HealthStatus {
	return HealthStatus{Connected: false, BrokerURL: "(none - noop adapter active)", CheckedAt: time.Now(), LastError: "no MQTT broker configured for this environment"}
}
