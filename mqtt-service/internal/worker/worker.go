package worker

import (
	"context"
	"encoding/json"
	"log/slog"
	"mqtt-service/internal/repository"
	"mqtt-service/internal/utils"
	"mqtt-service/pkg/mqttclient"
	"time"

	"github.com/google/uuid"
)

type Worker struct {
	dbRepo     repository.DeviceRepository
	cmdRepo    repository.CommandRepository
	redis      repository.RedisClient
	mqttClient *mqttclient.MQTTClient
	log        *slog.Logger
}

func NewWorker(dbRepo repository.DeviceRepository, cmdRepo repository.CommandRepository, redis repository.RedisClient, mqttClient *mqttclient.MQTTClient, log *slog.Logger) *Worker {
	return &Worker{
		dbRepo:     dbRepo,
		cmdRepo:    cmdRepo,
		redis:      redis,
		mqttClient: mqttClient,
		log:        log,
	}
}

func (w *Worker) Start(ctx context.Context) {
	w.log.Info("background_workers_starting")

	// Retry Queue loop - every 5 seconds
	go w.retryQueueLoop(ctx)

	// Presence timeout check loop - every 30 seconds
	go w.presenceTimeoutLoop(ctx)

	// Offline queue checker loop - check presence changes to deliver offline messages
	go w.offlineQueueDeliveryLoop(ctx)
}

func (w *Worker) retryQueueLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.log.Info("retry_queue_loop_shutting_down")
			return
		case <-ticker.C:
			w.processRetryQueue()
		}
	}
}

func (w *Worker) presenceTimeoutLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.log.Info("presence_timeout_loop_shutting_down")
			return
		case <-ticker.C:
			w.checkPresenceTimeouts()
		}
	}
}

func (w *Worker) offlineQueueDeliveryLoop(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.log.Info("offline_queue_delivery_loop_shutting_down")
			return
		case <-ticker.C:
			w.deliverOfflineMessagesToOnlineDevices()
		}
	}
}

func (w *Worker) processRetryQueue() {
	if !w.mqttClient.IsConnected() {
		return
	}

	messages, err := w.redis.GetRetryMessages()
	if err != nil {
		w.log.Error("failed_to_get_retry_messages", "error", err)
		return
	}

	for _, msg := range messages {
		if time.Now().Before(msg.NextRunAt) {
			continue
		}

		w.log.Info("retrying_failed_publish", "msg_id", msg.ID, "topic", msg.Topic, "attempt", msg.Attempts)
		err = w.mqttClient.Publish(msg.Topic, msg.QoS, false, []byte(msg.Payload))
		if err == nil {
			w.log.Info("publish_retry_successful", "msg_id", msg.ID)
			_ = w.redis.RemoveRetryMessage(msg.ID)
		} else {
			attempts := msg.Attempts + 1
			if attempts > 5 {
				w.log.Error("publish_retry_failed_permanently", "msg_id", msg.ID, "attempts", attempts)
				_ = w.redis.RemoveRetryMessage(msg.ID)

				// Update status in DB
				if cmdID, err := uuid.Parse(msg.ID); err == nil {
					_ = w.cmdRepo.UpdateStatus(cmdID, "failed")
				}
			} else {
				backoff := time.Duration(attempts*5) * time.Second
				nextRun := time.Now().Add(backoff)
				w.log.Warn("publish_retry_failed_requeuing", "msg_id", msg.ID, "next_attempt", attempts, "backoff_seconds", backoff.Seconds())
				_ = w.redis.EnqueueRetryMessage(msg.ID, msg.Topic, msg.Payload, msg.QoS, attempts, nextRun)
			}
		}
	}
}

func (w *Worker) checkPresenceTimeouts() {
	devices, err := w.dbRepo.List()
	if err != nil {
		w.log.Error("failed_to_list_devices_for_presence_timeout", "error", err)
		return
	}

	for _, dev := range devices {
		if dev.Status == "online" {
			// Check Redis presence
			online, err := w.redis.GetDevicePresence(dev.ID.String())
			if err != nil {
				continue
			}

			// If Redis key expired or last seen is older than 180 seconds, mark offline
			if !online || time.Since(dev.LastSeen) > 180*time.Second {
				w.log.Warn("device_presence_timed_out", "device_id", dev.ID, "last_seen", dev.LastSeen)
				_ = w.dbRepo.UpdateStatus(dev.ID, "offline")
				_ = w.redis.SetDevicePresence(dev.ID.String(), false, 0)
			}
		}
	}
}

func (w *Worker) deliverOfflineMessagesToOnlineDevices() {
	if !w.mqttClient.IsConnected() {
		return
	}

	onlineDevices, err := w.redis.GetOnlineDevices()
	if err != nil {
		return
	}

	for _, deviceIDStr := range onlineDevices {
		deviceID, err := uuid.Parse(deviceIDStr)
		if err != nil {
			continue
		}

		// Dequeue offline commands for this device
		msgs, err := w.redis.DequeueOfflineMessages(deviceIDStr)
		if err != nil || len(msgs) == 0 {
			continue
		}

		w.log.Info("delivering_offline_messages_to_device", "device_id", deviceID, "count", len(msgs))
		topic := utils.BuildDeviceTopic(deviceIDStr, "command")

		for _, payload := range msgs {
			// Extract command_id from wrapped payload to update status to "sent" in PostgreSQL
			var wrapped map[string]interface{}
			_ = json.Unmarshal([]byte(payload), &wrapped)

			err := w.mqttClient.Publish(topic, 1, false, []byte(payload))
			if err == nil {
				if wrapped != nil {
					if cmdIDStr, ok := wrapped["command_id"].(string); ok {
						if cmdID, err := uuid.Parse(cmdIDStr); err == nil {
							_ = w.cmdRepo.UpdateStatus(cmdID, "sent")
						}
					}
				}
			} else {
				// Re-enqueue or put in retry queue
				w.log.Error("failed_to_deliver_offline_message", "device_id", deviceID, "error", err)
				if wrapped != nil {
					if cmdIDStr, ok := wrapped["command_id"].(string); ok {
						_ = w.redis.EnqueueRetryMessage(cmdIDStr, topic, payload, 1, 1, time.Now().Add(5*time.Second))
					}
				}
			}
		}
	}
}
