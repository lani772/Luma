package mqttadapter

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

// Config configures the Paho-backed adapter for whichever broker is
// currently deployed (mqtt.luma.local today, per the project brief).
type Config struct {
	BrokerURL      string
	ClientIDPrefix string
	Username       string
	Password       string
	TLSEnabled     bool
	ConnectTimeout time.Duration
}

// PahoAdapter implements Adapter on top of eclipse/paho.mqtt.golang. It is
// deliberately the only file in the codebase that imports that package.
type PahoAdapter struct {
	cfg    Config
	log    *slog.Logger
	client mqtt.Client

	mu        sync.RWMutex
	lastError error
}

func NewPahoAdapter(cfg Config, log *slog.Logger) *PahoAdapter {
	if cfg.ConnectTimeout == 0 {
		cfg.ConnectTimeout = 10 * time.Second
	}
	return &PahoAdapter{cfg: cfg, log: log}
}

func (a *PahoAdapter) Connect(ctx context.Context) error {
	opts := mqtt.NewClientOptions().
		AddBroker(a.cfg.BrokerURL).
		SetClientID(fmt.Sprintf("%s-%d", a.cfg.ClientIDPrefix, time.Now().UnixNano())).
		SetConnectTimeout(a.cfg.ConnectTimeout).
		SetAutoReconnect(true).
		SetMaxReconnectInterval(30 * time.Second).
		SetOnConnectHandler(func(mqtt.Client) {
			a.log.Info("mqtt_broker_connected", "broker", a.cfg.BrokerURL)
			a.setLastError(nil)
		}).
		SetConnectionLostHandler(func(_ mqtt.Client, err error) {
			a.log.Warn("mqtt_broker_connection_lost", "broker", a.cfg.BrokerURL, "error", err)
			a.setLastError(err)
		})

	if a.cfg.Username != "" {
		opts.SetUsername(a.cfg.Username)
		opts.SetPassword(a.cfg.Password)
	}

	a.client = mqtt.NewClient(opts)
	token := a.client.Connect()
	if !token.WaitTimeout(a.cfg.ConnectTimeout) {
		return fmt.Errorf("mqttadapter: connect to %s timed out", a.cfg.BrokerURL)
	}
	if err := token.Error(); err != nil {
		a.setLastError(err)
		return fmt.Errorf("mqttadapter: connect to %s: %w", a.cfg.BrokerURL, err)
	}
	return nil
}

func (a *PahoAdapter) Disconnect(timeout time.Duration) {
	if a.client != nil && a.client.IsConnected() {
		a.client.Disconnect(uint(timeout.Milliseconds()))
	}
}

func (a *PahoAdapter) IsConnected() bool {
	return a.client != nil && a.client.IsConnected()
}

func (a *PahoAdapter) Publish(ctx context.Context, topic string, qos byte, retain bool, payload []byte) error {
	if !a.IsConnected() {
		return ErrNotConnected
	}
	token := a.client.Publish(topic, qos, retain, payload)
	token.Wait()
	return token.Error()
}

func (a *PahoAdapter) Subscribe(ctx context.Context, topic string, qos byte, handler Handler) error {
	if !a.IsConnected() {
		return ErrNotConnected
	}
	token := a.client.Subscribe(topic, qos, func(_ mqtt.Client, m mqtt.Message) {
		handler(Message{Topic: m.Topic(), Payload: m.Payload(), QoS: m.Qos(), Retain: m.Retained()})
	})
	token.Wait()
	return token.Error()
}

func (a *PahoAdapter) Unsubscribe(ctx context.Context, topic string) error {
	if !a.IsConnected() {
		return ErrNotConnected
	}
	token := a.client.Unsubscribe(topic)
	token.Wait()
	return token.Error()
}

func (a *PahoAdapter) Health() HealthStatus {
	status := HealthStatus{
		Connected: a.IsConnected(),
		BrokerURL: a.cfg.BrokerURL,
		CheckedAt: time.Now(),
	}
	a.mu.RLock()
	if a.lastError != nil {
		status.LastError = a.lastError.Error()
	}
	a.mu.RUnlock()
	return status
}

func (a *PahoAdapter) setLastError(err error) {
	a.mu.Lock()
	a.lastError = err
	a.mu.Unlock()
}
