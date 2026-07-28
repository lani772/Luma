# LUMA Smart Home — Deep MQTT Service Analysis & EMQX Cloud Integration Guide

This document presents a deep, comprehensive analysis of the MQTT communication architecture across the **LUMA Mobile Frontend** (React Native/Expo) and the **Go Cloud Backend** (`luma-cloud-backend`). It details how to configure, wire, and integrate these services with an **EMQX Cloud Broker**, including handling security authorization (ACLs), authentication hooks, topic structure alignment, and full lifecycle workflows.

---

## 1. High-Level Communication Architecture

In the LUMA Smart Home platform, MQTT acts as the real-time control transport layer. While REST is used for transactional operations (authentication, user preferences, configuration syncing, backup, etc.), MQTT is the pipeline for:
- Command dispatching (e.g., turning a lamp on/off or setting brightness)
- State telemetry reporting (e.g., devices informing the cloud and mobile clients of state transitions)
- Live health and system monitoring (e.g., CPU, RAM, Wi-Fi RSSI readings from ESP32 microcontrollers)
- Over-The-Air (OTA) firmware notification and tracking

### Platform Integration Topography

```
               ┌──────────────────────────────────────────────┐
               │              LUMA Mobile App                 │
               │   (React Native/Expo, custom native engine)  │
               └───────────┬──────────────────────▲───────────┘
                           │ (Publish             │ (Subscribe
                           │  Commands)           │  Telemetry/State)
                           ▼                      │
     ┌────────────────────────────────────────────┴──────────────────────────┐
     │                       EMQX Cloud Broker Cluster                       │
     │                      (mqtt.luma-smart-home.cloud)                     │
     └─────┬──────────────────────────────────────▲────────────────────┬─────┘
           │                                      │                    │
           │ HTTP Hook (Auth/ACL)                 │ Pub/Sub            │ Webhook (Events)
           ▼                                      │                    ▼
┌──────────────────────────────────────────┐      │      ┌──────────────────────────┐
│            Go Cloud Backend              ├──────┘      │     Go Cloud Backend     │
│        (internal/engines/mqtt)           │             │     (internal/worker)    │
│  - Issue device-scoped credentials       │             │  - Process client connect│
│  - Authorize topic ACL dynamically       │             │    and disconnect events │
│  - Act as centralized administrative API │             │  - Dispatch notifications│
└──────────────────────────────────────────┘             └──────────────────────────┘
```

---

## 2. Frontend MQTT Service Analysis

### 2.1 Code Structure and Files
The mobile client's MQTT logic resides under `artifacts/luma-smart-home/src/modules/mqtt/` and React wiring is managed in `artifacts/luma-smart-home/context/MQTTContext.tsx`.

Key modules and their roles:
1. **`MQTTManager.ts` (Core Orchestrator)**: Coordinates the active channels. It implements a priority-based failover chain for sending commands:
   $$\text{Cloud MQTT} \rightarrow \text{Local MQTT} \rightarrow \text{HTTP Fallback} \rightarrow \text{Bluetooth Mesh (Simulation)} \rightarrow \text{Offline Queue}$$
2. **`MQTTConnection.ts`**: Represesents a single connection channel (e.g., `cloud` or `local`). It tracks status lifecycle (`idle`, `connecting`, `connected`, `disconnected`, `error`) and gathers metrics (latency, last message timestamp, messages/minute).
3. **`MQTTService.ts`**: Hides native vs. simulated transport.
   - **`NativeMQTTService`**: Imports `@arduino/react-native-mqtt-client` and handles socket-level connection to an external broker using native Kotlin/Swift bindings.
   - **`SimulatedMQTTService`**: Falls back to the embedded in-memory Javascript/TypeScript simulated broker (`mobileRNMQTTClientEngine`) inside Expo Go.
4. **`MQTTTopics.ts`**: The sole manager for generating and parsing topic strings.
5. **`MQTTQueue.ts`**: Implements an in-memory queue to buffer commands when offline. Buffered commands are replayed via the `drain` helper on channel reconnection.

### 2.2 Topic Structure Mismatch (Current vs. Unified)
An analysis of the codebase reveals a critical naming mismatch between the React Native frontend and the Go backend:

- **Frontend (`MQTTTopics.ts`)**: Generates topics prefixed with `"device"`:
  ```typescript
  // e.g. device/{deviceId}/command
  // e.g. device/{deviceId}/status
  ```
- **Go Cloud Backend (`topics.go`)**: Generates topics prefixed with `"luma/devices"`:
  ```go
  // e.g. luma/devices/{deviceId}/commands
  // e.g. luma/devices/{deviceId}/state
  ```

#### Unified Topic & QoS Mapping

To resolve this inconsistency, both the frontend and backend must align on a canonical topic taxonomy. We specify the unified mapping table below:

| Topic Pattern | Direction | QoS | Retained | Description |
|---|---|---|---|---|
| `luma/devices/{deviceId}/state` | ESP32 $\rightarrow$ Cloud/App | `1` | **Yes** | Device's current state (e.g., JSON payload representing parameters like `on: true, brightness: 80`). Retained to allow new subscribers to read the state immediately. |
| `luma/devices/{deviceId}/commands` | Cloud/App $\rightarrow$ ESP32 | `1` | **No** | Target command actions dispatched to the microcontroller. |
| `luma/devices/{deviceId}/response` | ESP32 $\rightarrow$ Cloud/App | `1` | **No** | Acknowledgement or reply containing command execution results. |
| `luma/devices/{deviceId}/status` | ESP32 $\rightarrow$ Cloud/App | `1` | **Yes** | Presence indicator. ESP32 sets its **Last Will and Testament (LWT)** to this topic with `{"online": false}`. Upon connecting, it publishes `{"online": true}`. |
| `luma/devices/{deviceId}/telemetry` | ESP32 $\rightarrow$ Cloud | `0` | **No** | High-frequency sensor streams (such as energy readings, temperature). Loss is tolerated. |
| `luma/devices/{deviceId}/firmware` | Cloud $\rightarrow$ ESP32 | `1` | **No** | Triggers Over-The-Air (OTA) updates on the microcontroller. |

---

## 3. Backend MQTT Service Analysis

### 3.1 Code Architecture and Files
The backend's MQTT logic lives in `artifacts/luma-cloud-backend/internal/engines/mqtt/` and the client adapter is under `pkg/mqttadapter/`.

- **`internal/engines/mqtt/service.go`**: Contains the core business logic. It handles the dynamic generation of credentials (`IssueCredentials`), credential revocation (`RevokeCredentials`), and listing of active topics.
- **`internal/engines/mqtt/handlers.go`**: Exposes the REST API routes for credential management, protected by access middleware.
- **`pkg/mqttadapter/adapter.go`**: Declares a broker-agnostic interface (`Adapter`) supporting publish, subscribe, unsubscribe, and health status checking.
- **`pkg/mqttadapter/paho.go`**: Implements the `Adapter` using Eclipse Paho (`github.com/eclipse/paho.mqtt.golang`). This is the **only** Go file containing direct references to the Paho client library, ensuring the broker implementation remains swappable.

### 3.2 Database Identity Schema
Active device credentials issued by the cloud backend are persisted in the `mqtt_device_identities` table:

```sql
CREATE TABLE mqtt_device_identities (
    id              UUID PRIMARY KEY,
    device_id       UUID REFERENCES devices(id) ON DELETE CASCADE,
    mqtt_client_id  TEXT NOT NULL UNIQUE,
    mqtt_username   TEXT NOT NULL,
    credential_hash TEXT NOT NULL,   -- SHA-256 of generated password
    issued_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ      -- NULL = active
);
```

---

## 4. EMQX Cloud Broker Integration Architecture

EMQX is a highly performant, distributed, enterprise-grade cloud MQTT broker. Integrating EMQX Cloud with LUMA requires utilizing three critical integration hooks:

1. **HTTP Authentication (Authn)**
2. **HTTP Authorization (Authz/ACL)**
3. **Event Webhooks**

```
 ┌──────────┐                                                   ┌──────────────┐
 │   EMQX   │─── 1. HTTP POST: /auth/mqtt (verify username) ───►│  Go Backend  │
 │  Broker  │◄── Response: 200 OK (allow) or 400/401 ───────────│  Auth Engine │
 └────┬─────┘                                                   └──────────────┘
      │
      │                                                         ┌──────────────┐
      ├─── 2. HTTP POST: /auth/acl (check topic permissions) ──►│  Go Backend  │
      │◄── Response: 200 OK (allow/deny action) ────────────────│  ACL Engine  │
      │                                                         └──────────────┘
      │
      │                                                         ┌──────────────┐
      └─── 3. HTTP POST: /hooks/emqx (connected/disconnected) ─►│  Go Backend  │
                                                                │  Worker/Sync │
                                                                └──────────────┘
```

### 4.1 Integration Hook 1: Authn (HTTP Authentication Hook)
When an ESP32 microcontroller or a mobile application attempts a TCP/TLS connection to the EMQX Cloud broker, EMQX triggers an HTTP request to the Go backend to verify credentials instead of storing plaintext keys locally on the broker.

#### EMQX Auth Request Configuration (`emqx.conf` style)
```hocon
authentication = [
  {
    mechanism = password_based
    backend   = http
    url       = "https://api.luma-smart-home.cloud/cloud/auth/mqtt"
    method    = post
    headers {
      "Content-Type" = "application/json"
      "X-Auth-Token" = "${env:EMQX_HOOK_TOKEN}"
    }
    body {
      username = "${username}"
      password = "${password}"
      clientid = "${clientid}"
    }
    connect_timeout = "5s"
    request_timeout = "10s"
    pool_size       = 32
  }
]
```

#### Backend Implementation Requirement
The Go backend should expose `/auth/mqtt` to authenticate connection requests.
1. Extract the `username` and `password`.
2. Compute the SHA-256 sum of the incoming password:
   $$\text{computed\_hash} = \text{HexEncode}(\text{SHA256}(\text{password}))$$
3. Query the `mqtt_device_identities` table:
   ```sql
   SELECT credential_hash, revoked_at, expires_at
   FROM mqtt_device_identities
   WHERE mqtt_username = $1 AND revoked_at IS NULL;
   ```
4. Check if the credential has expired or been revoked.
5. Verify if the computed hash matches the `credential_hash`. Return HTTP `200 OK` (with `"result": "allow"`) or `401 Unauthorized` (with `"result": "deny"`).

---

### 4.2 Integration Hook 2: Authz (HTTP Authorization / Topic ACL Hook)
To prevent compromised microcontrollers or rogue clients from subscribing to other devices' telemetry or publishing malicious command payloads, EMQX queries the Go backend on every Publish and Subscribe attempt.

#### EMQX ACL Request Configuration
```hocon
authorization {
  no_match = deny
  sources = [
    {
      type   = http
      enable = true
      url    = "https://api.luma-smart-home.cloud/cloud/auth/acl"
      method = post
      headers {
        "Content-Type" = "application/json"
        "X-Auth-Token" = "${env:EMQX_HOOK_TOKEN}"
      }
      body {
        username = "${username}"
        clientid = "${clientid}"
        topic    = "${topic}"
        action   = "${action}"  # "publish" or "subscribe"
      }
    }
  ]
}
```

#### Backend ACL Authorization Rules
The Go backend's `/auth/acl` endpoint determines whether access is permitted based on the client identity prefix and role boundaries:

```go
func HandleACLCheck(c *gin.Context) {
    var req ACLRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"result": "deny"})
        return
    }

    // Parse the target topic (e.g. "luma/devices/abc-123/commands")
    parsed := ParseTopic(req.Topic)
    if parsed == nil {
        c.JSON(http.StatusOK, gin.H{"result": "deny"})
        return
    }

    // Rule 1: Microcontrollers can ONLY access their own scoped topic path
    if strings.HasPrefix(req.ClientID, "luma-device-") {
        expectedDeviceID := strings.TrimPrefix(req.ClientID, "luma-device-")
        if parsed.DeviceID != expectedDeviceID {
            c.JSON(http.StatusOK, gin.H{"result": "deny"})
            return
        }

        // Microcontrollers can only SUBSCRIBE to commands/schedules, and PUBLISH to state/telemetry/responses
        if req.Action == "subscribe" && (parsed.Kind == "commands" || parsed.Kind == "schedule" || parsed.Kind == "firmware") {
            c.JSON(http.StatusOK, gin.H{"result": "allow"})
            return
        }
        if req.Action == "publish" && (parsed.Kind == "state" || parsed.Kind == "telemetry" || parsed.Kind == "response" || parsed.Kind == "status") {
            c.JSON(http.StatusOK, gin.H{"result": "allow"})
            return
        }
        c.JSON(http.StatusOK, gin.H{"result": "deny"})
        return
    }

    // Rule 2: Mobile clients (luma-phone-) can access devices they are owners or admins of
    if strings.HasPrefix(req.ClientID, "luma-phone-") {
        userId, phoneId := parsePhoneClientID(req.ClientID)

        // Validate in DB that userId has active permissions (owner or device_admins) for parsed.DeviceID
        hasAccess := checkDevicePermission(userId, parsed.DeviceID)
        if !hasAccess {
            c.JSON(http.StatusOK, gin.H{"result": "deny"})
            return
        }

        // Mobile apps PUBLISH to commands and SUBSCRIBE to state/telemetry/responses
        if req.Action == "publish" && (parsed.Kind == "commands" || parsed.Kind == "schedule") {
            c.JSON(http.StatusOK, gin.H{"result": "allow"})
            return
        }
        if req.Action == "subscribe" && (parsed.Kind == "state" || parsed.Kind == "telemetry" || parsed.Kind == "response" || parsed.Kind == "status") {
            c.JSON(http.StatusOK, gin.H{"result": "allow"})
            return
        }
    }

    c.JSON(http.StatusOK, gin.H{"result": "deny"})
}
```

---

### 4.3 Integration Hook 3: Webhooks (Connection & Disconnection Lifecycle)
EMQX fires a webhook to the Go backend on connectivity changes. The backend processes these hooks to maintain real-time status in the database (`devices.status` field set to `'online'` or `'offline'`).

```hocon
webhook {
  enable = true
  url    = "https://api.luma-smart-home.cloud/cloud/hooks/emqx"
  headers {
    "Content-Type" = "application/json"
    "X-Hook-Token" = "${env:EMQX_HOOK_TOKEN}"
  }
  events = [
    { event = "client.connected",    qos = 1 },
    { event = "client.disconnected", qos = 1 }
  ]
}
```

```go
func HandleEMQXWebhook(c *gin.Context) {
    var event EMQXEvent
    if err := c.ShouldBindJSON(&event); err != nil {
        c.Status(http.StatusBadRequest)
        return
    }

    if strings.HasPrefix(event.ClientID, "luma-device-") {
        deviceID := strings.TrimPrefix(event.ClientID, "luma-device-")
        status := "offline"
        if event.Event == "client.connected" {
            status = "online"
        }

        // Update state in database
        _ = db.Model(&Device{}).Where("id = ?", deviceID).Update("status", status)

        // Emit history event
        _ = AppendDeviceHistory(deviceID, "status_changed", map[string]interface{}{"status": status})
    }
    c.Status(http.StatusOK)
}
```

---

## 5. End-to-End Workflow & Lifecycle

The following sequence details how the Mobile App and EMQX Broker interact during device control:

```
Mobile App                    Cloud API REST                  EMQX Broker               ESP32 Device
    │                               │                              │                         │
    │ 1. POST /auth/login           │                              │                         │
    ├──────────────────────────────►│                              │                         │
    │ ◄─────────────────────────────┤ (Store Auth tokens)          │                         │
    │                               │                              │                         │
    │ 2. POST /devices/{id}/mqtt-credentials                       │                         │
    ├──────────────────────────────►│                              │                         │
    │ ◄─────────────────────────────┤ (Generate dynamic creds)     │                         │
    │                               │                              │                         │
    │ 3. Connect (via Native MQTT service)                         │                         │
    ├─────────────────────────────────────────────────────────────►│                         │
    │                               │                              │                         │
    │                               │ 4. authn webhook             │                         │
    │                               │◄─────────────────────────────┤                         │
    │                               ├─────────────────────────────►│ (Validate credential)   │
    │                               │                              │                         │
    │ ◄────────────────────────────────────────────────────────────┤ (Connected success)     │
    │                               │                              │                         │
    │ 5. Subscribe to "luma/devices/{id}/state"                    │                         │
    ├─────────────────────────────────────────────────────────────►│                         │
    │                               │                              │                         │
    │                               │ 6. authz (ACL) webhook       │                         │
    │                               │◄─────────────────────────────┤                         │
    │                               ├─────────────────────────────►│ (ACL allowed)           │
    │                               │                              │                         │
    │                               │                              │ 7. ESP32 connects       │
    │                               │                              │◄────────────────────────┤
    │                               │                              │                         │
    │ 8. Send "TOGGLE" command                                     │                         │
    │    (Publish to commands topic)                               │                         │
    ├─────────────────────────────────────────────────────────────►│                         │
    │                               │                              │                         │
    │                               │                              │ 9. Dispatch to ESP32    │
    │                               │                              │────────────────────────►│
    │                               │                              │                         │
    │                               │                              │ 10. ESP32 acts & replies│
    │                               │                              │     (Publish to state)  │
    │                               │                              │◄────────────────────────┤
    │                               │                              │                         │
    │ 11. Dispatch state to Mobile  │                              │                         │
    │◄─────────────────────────────────────────────────────────────┤                         │
```

---

## 6. Detailed EMQX Rule Engine Configurations

The EMQX Rule Engine allows processing MQTT message payloads and forwarding metrics directly to databases, message queues, or HTTP servers.

### 6.1 Rule 1: Parse Telemetry Events & Store in Database
When an ESP32 microcontroller publishes telemetry logs onto `luma/devices/+/telemetry`, this rule automatically extracts the parameters and publishes them as a JSON structure:

- **SQL Statement**:
  ```sql
  SELECT
    clientid,
    topic,
    payload.temperature as temp,
    payload.humidity as hum,
    payload.voltage as volt,
    timestamp as ts
  FROM
    "luma/devices/+/telemetry"
  ```
- **Action**: Add a `Data Bridge` pointing to an HTTP REST Server or a Time-Series Database (e.g., InfluxDB / TimescaleDB) to record the metric.

### 6.2 Rule 2: Capture Abnormal Disconnections (LWT Trigger)
When an ESP32 disconnects abnormally without sending a graceful shutdown request, the LWT fires. This rule catches the disconnect event and routes a high-priority system push notification:

- **SQL Statement**:
  ```sql
  SELECT
    clientid as client_id,
    payload.reason as disconnect_reason,
    timestamp as ts
  FROM
    "luma/devices/+/status"
  WHERE
    payload.online = false
  ```
- **Action**: Call the Notification Engine REST API endpoint (`https://api.luma-smart-home.cloud/cloud/notifications/trigger-alert`) to push a mobile notification: *"Device XYZ went offline unexpectedly"*.

---

## 7. Concrete Step-by-Step Configuration Guide

To implement this integration in an EMQX Cloud deployment:

1. **Broker URL and TLS Setup**:
   - Locate your EMQX Cloud Broker's TCP and SSL endpoints (e.g., `broker.luma.emqx.cloud` on port `8883` for secure MQTTS connections).
   - In your mobile client and microcontroller configuration files, set the broker URL schema to `mqtts://` to ensure transport layer encryption.
2. **Setup Secret Environment Variables**:
   - In the Go Cloud Backend environment, provision a strong secret token:
     `EMQX_HOOK_TOKEN=your_secure_random_hex_string_here`
   - In the EMQX Cloud console, add `X-Auth-Token` to HTTP headers under Auth/ACL and Webhook configs with the matching secret value.
3. **Configure Authentication (Authn) Hook**:
   - In EMQX Cloud console, navigate to **Access Control $\rightarrow$ Authentication** and add an **HTTP** backend.
   - Set the method to `POST`.
   - Set URL: `https://api.yourdomain.com/cloud/auth/mqtt` (or `/cloud/api/engines/mqtt/auth`).
   - Define payload structure to transmit `username`, `password`, and `clientid`.
4. **Configure Authorization (Authz) Hook**:
   - Under **Access Control $\rightarrow$ Authorization**, select **HTTP** as the backend.
   - Set the method to `POST`.
   - Set URL: `https://api.yourdomain.com/cloud/auth/acl` (or `/cloud/api/engines/mqtt/acl`).
   - Map parameters for `username`, `clientid`, `topic`, and `action`.
5. **Setup Event Webhooks**:
   - In EMQX Console, create a new **Webhook** or **Integration Rule**.
   - Direct webhooks to the Go backend's `/cloud/hooks/emqx` endpoint.
   - Check events: `client.connected` and `client.disconnected`.
6. **Verify and Monitor**:
   - Open EMQX Cloud dashboard.
   - Use the **Websocket Client** on the EMQX dashboard to simulate a connection with generated device-scoped credentials.
   - Confirm subscription limitations are enforced correctly.
