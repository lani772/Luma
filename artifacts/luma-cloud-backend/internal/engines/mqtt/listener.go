package mqtt

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/engines/health"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"github.com/luma-smart-home/cloud-backend/pkg/mqttadapter"
	"gorm.io/gorm"
)

type Listener struct {
	db     *gorm.DB
	mqtt   mqttadapter.Adapter
	health *health.Service
	log    *slog.Logger
}

func NewListener(db *gorm.DB, mqtt mqttadapter.Adapter, health *health.Service, log *slog.Logger) *Listener {
	return &Listener{
		db:     db,
		mqtt:   mqtt,
		health: health,
		log:    log,
	}
}

func (l *Listener) Start(ctx context.Context) {
	// Subscribe to device status topics (LWT)
	_ = l.mqtt.Subscribe(ctx, "luma/devices/+/status", 1, func(msg mqttadapter.Message) {
		l.log.Info("mqtt_received_status", "topic", msg.Topic, "payload", string(msg.Payload))
		parts := strings.Split(msg.Topic, "/")
		if len(parts) >= 3 {
			devIDStr := parts[2]
			if devID, err := uuid.Parse(devIDStr); err == nil {
				statusStr := string(msg.Payload)
				// Update db
				_ = l.db.Model(&models.Device{}).Where("id = ?", devID).Updates(map[string]any{
					"status":     statusStr,
					"updated_at": time.Now(),
				})
			}
		}
	})

	// Subscribe to device heartbeat/telemetry topics
	_ = l.mqtt.Subscribe(ctx, "luma/devices/+/telemetry", 1, func(msg mqttadapter.Message) {
		l.log.Info("mqtt_received_telemetry", "topic", msg.Topic)
		parts := strings.Split(msg.Topic, "/")
		if len(parts) >= 3 {
			devIDStr := parts[2]
			if devID, err := uuid.Parse(devIDStr); err == nil {
				var req health.SubmitHeartbeatRequest
				if err := json.Unmarshal(msg.Payload, &req); err == nil {
					// Retrieve device owner
					var d models.Device
					if err := l.db.Where("id = ?", devID).First(&d).Error; err == nil {
						_, _ = l.health.SubmitHeartbeat(ctx, devID, d.OwnerID, req)
					}
				}
			}
		}
	})
}
