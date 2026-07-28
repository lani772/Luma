package mqttclient

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"math"
	"os"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

type Config struct {
	BrokerHost     string
	BrokerPort     int
	ClientIDPrefix string
	Username       string
	Password       string
	TLSEnabled     bool
	CACertPath     string
	KeepAlive      int
	CleanSession   bool
	ConnectTimeout int
}

type Message struct {
	Topic   string
	Payload []byte
	QoS     byte
	Retain  bool
}

type MessageHandler func(msg Message)

type MQTTClient struct {
	cfg       Config
	log       *slog.Logger
	client    mqtt.Client
	mu        sync.RWMutex
	lastError error
	onConnect func()
}

func New(cfg Config, log *slog.Logger) *MQTTClient {
	if cfg.BrokerHost == "" {
		cfg.BrokerHost = "localhost"
	}
	if cfg.BrokerPort == 0 {
		cfg.BrokerPort = 1883
	}
	if cfg.KeepAlive == 0 {
		cfg.KeepAlive = 60
	}
	if cfg.ConnectTimeout == 0 {
		cfg.ConnectTimeout = 10
	}
	return &MQTTClient{
		cfg: cfg,
		log: log,
	}
}

func (c *MQTTClient) SetOnConnect(fn func()) {
	c.mu.Lock()
	c.onConnect = fn
	c.mu.Unlock()
}

func (c *MQTTClient) Connect(ctx context.Context) error {
	brokerURL := fmt.Sprintf("tcp://%s:%d", c.cfg.BrokerHost, c.cfg.BrokerPort)
	if c.cfg.TLSEnabled {
		brokerURL = fmt.Sprintf("ssl://%s:%d", c.cfg.BrokerHost, c.cfg.BrokerPort)
	}

	opts := mqtt.NewClientOptions().
		AddBroker(brokerURL).
		SetClientID(fmt.Sprintf("%s-%d", c.cfg.ClientIDPrefix, time.Now().UnixNano())).
		SetKeepAlive(time.Duration(c.cfg.KeepAlive) * time.Second).
		SetCleanSession(c.cfg.CleanSession).
		SetConnectTimeout(time.Duration(c.cfg.ConnectTimeout) * time.Second).
		SetAutoReconnect(true).
		SetMaxReconnectInterval(30 * time.Second)

	// Exponential backoff reconnect behavior:
	// Paho has automatic reconnect built-in, but we can customize SetReconnectingHandler to track reconnect logs.
	opts.SetReconnectingHandler(func(client mqtt.Client, options *mqtt.ClientOptions) {
		c.log.Warn("mqtt_client_reconnecting", "broker", brokerURL)
	})

	opts.SetOnConnectHandler(func(_ mqtt.Client) {
		c.log.Info("mqtt_client_connected", "broker", brokerURL)
		c.setLastError(nil)
		c.mu.RLock()
		fn := c.onConnect
		c.mu.RUnlock()
		if fn != nil {
			go fn()
		}
	})

	opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
		c.log.Warn("mqtt_client_connection_lost", "broker", brokerURL, "error", err)
		c.setLastError(err)
	})

	// Username/Password authentication
	if c.cfg.Username != "" {
		opts.SetUsername(c.cfg.Username)
		opts.SetPassword(c.cfg.Password)
	}

	// Last Will and Testament (LWT)
	// Set LWT on "luma/gateway/status" to announce unexpected disconnects
	statusTopic := "luma/gateway/status"
	opts.SetWill(statusTopic, `{"status": "offline", "reason": "unexpected_disconnect"}`, 1, true)

	// TLS Configuration
	if c.cfg.TLSEnabled {
		tlsCfg, err := c.createTLSConfig()
		if err != nil {
			return fmt.Errorf("failed to create tls config: %w", err)
		}
		opts.SetTLSConfig(tlsCfg)
	}

	c.client = mqtt.NewClient(opts)
	token := c.client.Connect()

	// Wait with context timeout
	done := make(chan struct{})
	go func() {
		token.Wait()
		close(done)
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-done:
		if err := token.Error(); err != nil {
			c.setLastError(err)
			return fmt.Errorf("failed to connect to %s: %w", brokerURL, err)
		}
	}

	return nil
}

func (c *MQTTClient) Disconnect(timeout time.Duration) {
	if c.client != nil && c.client.IsConnected() {
		// Publish graceful offline status before disconnecting
		c.Publish("luma/gateway/status", 1, true, []byte(`{"status": "offline", "reason": "graceful_shutdown"}`))
		c.client.Disconnect(uint(timeout.Milliseconds()))
		c.log.Info("mqtt_client_disconnected_gracefully")
	}
}

func (c *MQTTClient) IsConnected() bool {
	return c.client != nil && c.client.IsConnected()
}

func (c *MQTTClient) Publish(topic string, qos byte, retain bool, payload []byte) error {
	if !c.IsConnected() {
		return fmt.Errorf("mqtt client not connected")
	}
	token := c.client.Publish(topic, qos, retain, payload)
	token.Wait()
	return token.Error()
}

func (c *MQTTClient) Subscribe(topic string, qos byte, handler MessageHandler) error {
	if !c.IsConnected() {
		return fmt.Errorf("mqtt client not connected")
	}
	token := c.client.Subscribe(topic, qos, func(_ mqtt.Client, m mqtt.Message) {
		handler(Message{
			Topic:   m.Topic(),
			Payload: m.Payload(),
			QoS:     m.Qos(),
			Retain:  m.Retained(),
		})
	})
	token.Wait()
	return token.Error()
}

func (c *MQTTClient) Unsubscribe(topic string) error {
	if !c.IsConnected() {
		return fmt.Errorf("mqtt client not connected")
	}
	token := c.client.Unsubscribe(topic)
	token.Wait()
	return token.Error()
}

func (c *MQTTClient) GetLastError() error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastError
}

func (c *MQTTClient) setLastError(err error) {
	c.mu.Lock()
	c.lastError = err
	c.mu.Unlock()
}

func (c *MQTTClient) createTLSConfig() (*tls.Config, error) {
	tlsCfg := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	if c.cfg.CACertPath != "" {
		caCert, err := os.ReadFile(c.cfg.CACertPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA certificate: %w", err)
		}
		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to append CA certificate to pool")
		}
		tlsCfg.RootCAs = caCertPool
	}

	return tlsCfg, nil
}

// ReconnectWithExponentialBackoff is a utility for retrying initial connections if the broker is temporarily down.
func ReconnectWithExponentialBackoff(ctx context.Context, client *MQTTClient, log *slog.Logger) {
	attempt := 0
	for {
		if client.IsConnected() {
			return
		}
		log.Info("attempting_mqtt_initial_connection", "attempt", attempt)
		err := client.Connect(ctx)
		if err == nil {
			return
		}

		attempt++
		backoff := time.Duration(math.Min(math.Pow(2, float64(attempt)), 30)) * time.Second
		log.Warn("mqtt_connection_failed_retrying", "error", err, "backoff_seconds", backoff.Seconds())

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
	}
}
