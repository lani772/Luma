package realtime

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocketMessage represents a real-time message
type WebSocketMessage struct {
	Type      string      `json:"type"`      // device_update, energy_update, notification, etc
	DeviceID  string      `json:"deviceId,omitempty"`
	RoomID    string      `json:"roomId,omitempty"`
	UserID    string      `json:"userId,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

// Client represents a WebSocket client
type Client struct {
	ID      string
	UserID  string
	Conn    *websocket.Conn
	Send    chan *WebSocketMessage
	Manager *Manager
	mu      sync.Mutex
	active  bool
}

// Manager manages all WebSocket connections
type Manager struct {
	clients      map[string]*Client
	broadcast    chan *WebSocketMessage
	register     chan *Client
	unregister   chan *Client
	mu           sync.RWMutex
	subscriptions map[string][]string // topic -> client IDs
	mu2          sync.RWMutex
}

// NewManager creates a new WebSocket manager
func NewManager() *Manager {
	return &Manager{
		clients:       make(map[string]*Client),
		broadcast:     make(chan *WebSocketMessage, 256),
		register:      make(chan *Client, 256),
		unregister:    make(chan *Client, 256),
		subscriptions: make(map[string][]string),
	}
}

// RegisterClient registers a new WebSocket client
func (m *Manager) RegisterClient(client *Client) {
	m.register <- client
}

// UnregisterClient unregisters a WebSocket client
func (m *Manager) UnregisterClient(client *Client) {
	m.unregister <- client
}

// BroadcastMessage sends a message to subscribed clients
func (m *Manager) BroadcastMessage(msg *WebSocketMessage) {
	m.broadcast <- msg
}

// Subscribe subscribes a client to a topic
func (m *Manager) Subscribe(clientID, topic string) {
	m.mu2.Lock()
	defer m.mu2.Unlock()
	
	if _, exists := m.subscriptions[topic]; !exists {
		m.subscriptions[topic] = []string{}
	}
	m.subscriptions[topic] = append(m.subscriptions[topic], clientID)
}

// Unsubscribe unsubscribes a client from a topic
func (m *Manager) Unsubscribe(clientID, topic string) {
	m.mu2.Lock()
	defer m.mu2.Unlock()
	
	if clients, exists := m.subscriptions[topic]; exists {
		for i, id := range clients {
			if id == clientID {
				m.subscriptions[topic] = append(clients[:i], clients[i+1:]...)
				break
			}
		}
	}
}

// Run starts the manager loop
func (m *Manager) Run() {
	for {
		select {
		case client := <-m.register:
			m.mu.Lock()
			m.clients[client.ID] = client
			m.mu.Unlock()
			log.Printf("Client registered: %s (User: %s)", client.ID, client.UserID)

		case client := <-m.unregister:
			m.mu.Lock()
			if _, exists := m.clients[client.ID]; exists {
				delete(m.clients, client.ID)
				close(client.Send)
			}
			m.mu.Unlock()
			log.Printf("Client unregistered: %s", client.ID)

		case msg := <-m.broadcast:
			m.broadcastToSubscribers(msg)
		}
	}
}

// broadcastToSubscribers sends message to subscribed clients
func (m *Manager) broadcastToSubscribers(msg *WebSocketMessage) {
	m.mu2.RLock()
	topic := fmt.Sprintf("%s:%s", msg.Type, msg.DeviceID)
	subscribers := m.subscriptions[topic]
	m.mu2.RUnlock()

	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, clientID := range subscribers {
		if client, exists := m.clients[clientID]; exists {
			select {
			case client.Send <- msg:
			default:
				// Client not reading, skip
			}
		}
	}
}

// ReadPump reads messages from the WebSocket connection
func (c *Client) ReadPump() {
	defer func() {
		c.Manager.UnregisterClient(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, data, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var cmd map[string]interface{}
		if err := json.Unmarshal(data, &cmd); err != nil {
			continue
		}

		// Handle subscription commands
		if cmdType, ok := cmd["command"].(string); ok {
			switch cmdType {
			case "subscribe":
				if topic, ok := cmd["topic"].(string); ok {
					c.Manager.Subscribe(c.ID, topic)
				}
			case "unsubscribe":
				if topic, ok := cmd["topic"].(string); ok {
					c.Manager.Unsubscribe(c.ID, topic)
				}
			}
		}
	}
}

// WritePump writes messages to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			data, _ := json.Marshal(msg)
			if err := c.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Close closes the client connection
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if c.active {
		c.active = false
		c.Conn.Close()
	}
}
