package realtime

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"luma-cloud-backend/internal/realtime"
)

// RealtimeEngine handles real-time operations
type RealtimeEngine struct {
	wsManager *realtime.Manager
	upgrader  websocket.Upgrader
}

// NewRealtimeEngine creates a new real-time engine
func NewRealtimeEngine() *RealtimeEngine {
	return &RealtimeEngine{
		wsManager: realtime.NewManager(),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // In production, validate origins properly
			},
		},
	}
}

// Initialize initializes the real-time engine
func (e *RealtimeEngine) Initialize() {
	go e.wsManager.Run()
	log.Println("Real-time engine initialized")
}

// HandleWebSocketConnection handles WebSocket connections
func (e *RealtimeEngine) HandleWebSocketConnection(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	conn, err := e.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := &realtime.Client{
		ID:      uuid.New().String(),
		UserID:  userID,
		Conn:    conn,
		Send:    make(chan *realtime.WebSocketMessage, 256),
		Manager: e.wsManager,
	}

	e.wsManager.RegisterClient(client)

	// Start read and write pumps
	go client.ReadPump()
	go client.WritePump()
}

// BroadcastDeviceUpdate broadcasts a device update to subscribed clients
func (e *RealtimeEngine) BroadcastDeviceUpdate(deviceID string, data map[string]interface{}) {
	msg := &realtime.WebSocketMessage{
		Type:      "device_update",
		DeviceID:  deviceID,
		Timestamp: time.Now(),
		Data:      data,
	}
	e.wsManager.BroadcastMessage(msg)
}

// BroadcastEnergyUpdate broadcasts energy data update
func (e *RealtimeEngine) BroadcastEnergyUpdate(deviceID string, consumption float64, cost float64) {
	msg := &realtime.WebSocketMessage{
		Type:      "energy_update",
		DeviceID:  deviceID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"consumption": consumption,
			"cost":        cost,
		},
	}
	e.wsManager.BroadcastMessage(msg)
}

// BroadcastNotification broadcasts a notification to users
func (e *RealtimeEngine) BroadcastNotification(userID, title, body string) {
	msg := &realtime.WebSocketMessage{
		Type:      "notification",
		UserID:    userID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"title": title,
			"body":  body,
		},
	}
	e.wsManager.BroadcastMessage(msg)
}

// BroadcastRoomStatus broadcasts room status change
func (e *RealtimeEngine) BroadcastRoomStatus(roomID string, status map[string]interface{}) {
	msg := &realtime.WebSocketMessage{
		Type:      "room_status",
		RoomID:    roomID,
		Timestamp: time.Now(),
		Data:      status,
	}
	e.wsManager.BroadcastMessage(msg)
}

// BroadcastSceneActivation broadcasts scene activation
func (e *RealtimeEngine) BroadcastSceneActivation(sceneID string, deviceChanges []map[string]interface{}) {
	msg := &realtime.WebSocketMessage{
		Type:      "scene_activated",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"sceneId":       sceneID,
			"deviceChanges": deviceChanges,
		},
	}
	e.wsManager.BroadcastMessage(msg)
}

import "time"
