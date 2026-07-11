# MQTT Engine

**ID:** `mqtt_engine`
**File:** `artifacts/api-server/src/engines/mqtt/mqtt-engine.ts`

---

## Responsibility

The MQTT Engine is the bridge between the internal message system and the physical MQTT broker.
It owns the broker connection, manages topic subscriptions, and queues outgoing messages when the broker is offline.

```
device_engine
      │  PUBLISH_DEVICE_STATE
      ▼
mqtt_engine
      │  (if connected)
      ▼
MQTT Broker (mqtt.luma.local:1883)
      │
      ▼
ESP32 devices
```

---

## Configuration

Broker settings are read from environment variables at engine start:

| Variable | Default | Description |
|---|---|---|
| `MQTT_HOST` | `mqtt.luma.local` | Broker hostname |
| `MQTT_PORT` | `1883` | Broker port |
| `MQTT_USER` | — | Username (optional) |
| `MQTT_PASS` | — | Password (optional) |

The `clientId` is auto-generated: `luma-server-{timestamp}`

---

## Capabilities

| Capability | Description |
|---|---|
| `mqtt_broker_communication` | Connect to and communicate with an MQTT broker |
| `topic_management` | Subscribe and unsubscribe from topics |
| `publish_subscribe` | Publish messages, notify internal engines of received messages |
| `device_messaging` | Route device state updates to/from physical hardware |
| `mqtt_authentication` | Validate credentials before connecting |
| `offline_message_queue` | Buffer outgoing messages when broker is unreachable |

---

## Subscribed Actions

### `CONNECT_BROKER`

Connect (or reconnect) to the MQTT broker.
Optionally override broker config in the payload.

**Payload:**
```typescript
{
  host?:      string;
  port?:      number;
  clientId?:  string;
  username?:  string;
  password?:  string;
  clean?:     boolean;
  keepalive?: number;
}
```

**Side effects:**
- Sets `connected = true`
- Resets reconnect counter
- Drains the offline publish queue
- Broadcasts `MQTT_CONNECTED`

---

### `DISCONNECT_BROKER`

Gracefully disconnect from the broker.

**Payload:** `{}`

**Broadcast emitted:** `MQTT_DISCONNECTED`

---

### `PUBLISH` / `PUBLISH_DEVICE_STATE`

Publish a message to an MQTT topic.
Both action names behave identically.

**Payload:**
```typescript
{
  topic:     string;     // e.g. "luma/device/ESP32_Lamp_01/state"
  payload:   unknown;    // any JSON-serializable value
  retained?: boolean;    // default false
}
```

**Behaviour when broker is offline:**
Message is added to the `offlinePublishQueue`.
When the broker reconnects, the queue is drained in order.

---

### `SUBSCRIBE_TOPIC`

Register a subscription so incoming messages on that topic are broadcast internally.

**Payload:**
```typescript
{
  topic: string;
  qos?:  0 | 1 | 2;   // default 0
}
```

---

### `UNSUBSCRIBE_TOPIC`

Remove a subscription.

**Payload:** `{ topic: string }`

---

### `GET_BROKER_STATUS`

Query current connection state.

**Payload:** `{}`

**Response event:** `MQTT_STATUS`
```typescript
{
  connected:         boolean;
  broker:            string;
  port:              number;
  clientId:          string;
  subscriptions:     number;
  offlineQueueSize:  number;
  reconnectAttempts: number;
}
```

---

### `GET_SUBSCRIPTIONS`

List all active subscriptions.

**Payload:** `{}`

**Response event:** `SUBSCRIPTIONS_LIST`
```typescript
{
  subscriptions: Array<{
    topic:        string;
    qos:          0 | 1 | 2;
    subscribedBy: EngineId;
  }>
}
```

---

### `AUTHENTICATE`

Validate MQTT credentials before connecting.

**Payload:** `{ username: string; password: string }`

**Response event:** `AUTH_RESULT` → `{ valid: boolean }`

---

## Broadcasts Emitted

| Broadcast | When | Payload |
|---|---|---|
| `MQTT_CONNECTED` | Broker connected | `{ broker, clientId }` |
| `MQTT_DISCONNECTED` | Broker disconnected | `{ broker }` |
| `MQTT_MESSAGE_PUBLISHED` | Message published successfully | `{ topic, payload }` |

---

## Offline Queue

Messages published while the broker is disconnected are buffered:

```
PUBLISH received (broker offline)
        │
        ▼
  offlinePublishQueue[]
        │
  broker reconnects (CONNECT_BROKER)
        │
        ▼
  drainOfflineQueue() → all queued messages published in order
```

The offline queue is **in-memory** — messages are lost if the server restarts.
For persistent offline queuing, integrate with the internal gateway's `queueOfflineMessage` (which survives within the process lifetime).

---

## Topic Conventions

```
luma/device/{deviceId}/state        ← device state updates (lamp on/off, brightness…)
luma/device/{deviceId}/command      ← commands sent to device
luma/device/{deviceId}/telemetry    ← sensor readings
luma/device/{deviceId}/health       ← CPU, memory, RSSI
luma/home/events                    ← system-wide events
```

---

## REST Endpoints

```
GET  /api/engines/mqtt_engine           — engine info + status
POST /api/engines/mqtt_engine/command   — send any action
GET  /api/engines/mqtt/status           — broker status + subscriptions
```

**Example — connect to broker:**
```bash
curl -X POST /api/engines/mqtt_engine/command \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CONNECT_BROKER",
    "payload": { "host": "192.168.1.10", "port": 1883 },
    "priority": "high"
  }'
```

**Example — publish a state update:**
```bash
curl -X POST /api/engines/mqtt_engine/command \
  -H "Content-Type: application/json" \
  -d '{
    "action": "PUBLISH",
    "payload": {
      "topic": "luma/device/ESP32_Lamp_01/state",
      "payload": { "on": true, "brightness": 80 }
    }
  }'
```
