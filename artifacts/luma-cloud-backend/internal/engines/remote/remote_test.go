package remote

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/pkg/mqttadapter"
)

type MockMQTTAdapter struct {
	Connected bool
	Topic     string
	Payload   []byte
}

func (m *MockMQTTAdapter) Connect(ctx context.Context) error {
	m.Connected = true
	return nil
}

func (m *MockMQTTAdapter) Disconnect(timeout time.Duration) {}

func (m *MockMQTTAdapter) IsConnected() bool {
	return m.Connected
}

func (m *MockMQTTAdapter) Publish(ctx context.Context, topic string, qos byte, retain bool, payload []byte) error {
	m.Topic = topic
	m.Payload = payload
	return nil
}

func (m *MockMQTTAdapter) Subscribe(ctx context.Context, topic string, qos byte, handler mqttadapter.Handler) error {
	return nil
}

func (m *MockMQTTAdapter) Unsubscribe(ctx context.Context, topic string) error {
	return nil
}

func (m *MockMQTTAdapter) Health() mqttadapter.HealthStatus {
	return mqttadapter.HealthStatus{Connected: m.Connected}
}

func TestRemoteSendCommand(t *testing.T) {
	mockMQTT := &MockMQTTAdapter{Connected: true}
	svc := NewService(mockMQTT)

	deviceID := uuid.New()
	req := RemoteCommandRequest{
		Command: "TURN_ON",
		Params:  map[string]any{"brightness": 80},
	}

	resp, err := svc.SendCommand(context.Background(), deviceID, req)
	if err != nil {
		t.Fatalf("Failed to send remote command: %v", err)
	}

	if !resp.Success {
		t.Errorf("Expected success response")
	}

	expectedTopic := "luma/devices/" + deviceID.String() + "/commands"
	if mockMQTT.Topic != expectedTopic {
		t.Errorf("Expected topic %s, got %s", expectedTopic, mockMQTT.Topic)
	}

	if len(mockMQTT.Payload) == 0 {
		t.Errorf("Expected payload to be written, got empty")
	}
}
