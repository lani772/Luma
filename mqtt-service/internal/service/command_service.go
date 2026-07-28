package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"mqtt-service/internal/models"
	"mqtt-service/internal/repository"
	"mqtt-service/internal/utils"
	"mqtt-service/pkg/mqttclient"
	"time"

	"github.com/google/uuid"
)

type CommandService struct {
	commandRepo repository.CommandRepository
	redis       repository.RedisClient
	mqttClient  *mqttclient.MQTTClient
	log         *slog.Logger
}

type CommandAckPayload struct {
	CommandID string `json:"command_id"`
	Status    string `json:"status"`
}

func NewCommandService(commandRepo repository.CommandRepository, redis repository.RedisClient, mqttClient *mqttclient.MQTTClient, log *slog.Logger) *CommandService {
	return &CommandService{
		commandRepo: commandRepo,
		redis:       redis,
		mqttClient:  mqttClient,
		log:         log,
	}
}

func (s *CommandService) SendCommand(deviceID uuid.UUID, payload string, qos byte) (*models.Command, error) {
	commandID := uuid.New()

	cmd := &models.Command{
		ID:       commandID,
		DeviceID: deviceID,
		Payload:  payload,
		QoS:      qos,
		Status:   "pending",
	}

	// 1. Check if device is online
	online, _ := s.redis.GetDevicePresence(deviceID.String())
	topic := utils.BuildDeviceTopic(deviceID.String(), "command")

	// Wrap the user payload to include the command ID for tracking ACKs!
	wrappedPayload := map[string]interface{}{
		"command_id": commandID.String(),
		"payload":    payload,
	}
	wrappedBytes, err := json.Marshal(wrappedPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal wrapped command: %w", err)
	}

	if online {
		// Device is online: publish and save as sent
		if s.mqttClient.IsConnected() {
			err := s.mqttClient.Publish(topic, qos, false, wrappedBytes)
			if err != nil {
				// Failed to publish, queue in retry queue and save as pending
				s.log.Error("failed_to_publish_command_retrying", "command_id", commandID, "error", err)
				cmd.Status = "pending"
				_ = s.redis.EnqueueRetryMessage(commandID.String(), topic, string(wrappedBytes), qos, 1, time.Now().Add(5*time.Second))
			} else {
				cmd.Status = "sent"
			}
		} else {
			// MQTT broker not connected, queue in offline queue
			s.log.Warn("mqtt_not_connected_queuing_offline", "command_id", commandID)
			cmd.Status = "pending"
			_ = s.redis.EnqueueOfflineMessage(deviceID.String(), string(wrappedBytes))
		}
	} else {
		// Device is offline: queue in offline queue and save as pending
		s.log.Info("device_offline_queuing_command", "device_id", deviceID, "command_id", commandID)
		cmd.Status = "pending"
		err = s.redis.EnqueueOfflineMessage(deviceID.String(), string(wrappedBytes))
		if err != nil {
			s.log.Error("failed_to_enqueue_offline_message", "device_id", deviceID, "error", err)
		}
	}

	err = s.commandRepo.Create(cmd)
	if err != nil {
		return nil, err
	}

	return cmd, nil
}

func (s *CommandService) HandleDeviceResponse(deviceID uuid.UUID, responsePayload string) error {
	var ack CommandAckPayload
	err := json.Unmarshal([]byte(responsePayload), &ack)
	if err != nil {
		s.log.Warn("failed_to_parse_device_ack_payload", "payload", responsePayload, "error", err)
		return err
	}

	if ack.CommandID == "" {
		return errors.New("empty command_id in response payload")
	}

	cmdID, err := uuid.Parse(ack.CommandID)
	if err != nil {
		return fmt.Errorf("invalid command_id format: %w", err)
	}

	cmd, err := s.commandRepo.FindByID(cmdID)
	if err != nil {
		return err
	}
	if cmd == nil {
		return fmt.Errorf("command not found for ack: %s", ack.CommandID)
	}

	if ack.Status == "failed" {
		_ = s.commandRepo.UpdateStatus(cmdID, "failed")
		s.log.Warn("command_execution_failed_by_device", "command_id", cmdID)
		return nil
	}

	err = s.commandRepo.MarkAcked(cmdID)
	if err != nil {
		s.log.Error("failed_to_mark_command_acked", "command_id", cmdID, "error", err)
		return err
	}

	s.log.Info("command_acknowledged_successfully", "command_id", cmdID)
	return nil
}

func (s *CommandService) GetCommandHistory(deviceID uuid.UUID) ([]models.Command, error) {
	return s.commandRepo.ListByDevice(deviceID)
}
