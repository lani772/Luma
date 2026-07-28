package remote

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/pkg/mqttadapter"
)

type Service struct {
	mqtt mqttadapter.Adapter
}

func NewService(mqtt mqttadapter.Adapter) *Service {
	return &Service{mqtt: mqtt}
}

func (s *Service) SendCommand(ctx context.Context, deviceID uuid.UUID, req RemoteCommandRequest) (*RemoteCommandResponse, error) {
	if !s.mqtt.IsConnected() {
		return nil, mqttadapter.ErrNotConnected
	}

	msgID := uuid.New().String()
	payloadMap := map[string]any{
		"messageId": msgID,
		"command":   req.Command,
		"params":    req.Params,
	}

	payloadBytes, err := json.Marshal(payloadMap)
	if err != nil {
		return nil, err
	}

	topic := fmt.Sprintf("luma/devices/%s/commands", deviceID.String())

	err = s.mqtt.Publish(ctx, topic, 1, false, payloadBytes)
	if err != nil {
		return nil, err
	}

	return &RemoteCommandResponse{
		Success:   true,
		Message:   "Command successfully dispatched to device.",
		MessageID: msgID,
	}, nil
}
