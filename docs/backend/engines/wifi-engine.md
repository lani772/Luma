# WiFi & Hotspot Engine

**ID:** `wifi_engine`
**File:** `artifacts/api-server/src/engines/wifi/wifi-engine.ts`

---

## Responsibility

The WiFi Engine manages network discovery, ESP32 device detection on the local network,
WiFi connection management, and hotspot creation for direct device provisioning.
It is the "eyes" of the system for anything network-topology related.

---

## Capabilities

| Capability | Description |
|---|---|
| `wifi_scanning` | Scan available WiFi networks and return RSSI/channel info |
| `esp32_discovery` | Find ESP32 devices on the local network by IP/hostname |
| `local_network_communication` | Relay local-network device info |
| `hotspot_management` | Create and stop a WiFi hotspot for device provisioning |
| `ip_detection` | Report the server's current local IP |
| `network_switching` | Switch between known WiFi networks |
| `offline_local_communication` | Supports local-only operation without internet |

---

## Data Types

```typescript
interface NetworkInfo {
  ssid:     string;
  bssid:    string;
  rssi:     number;     // signal strength in dBm (e.g. -42 = excellent)
  channel:  number;
  secured:  boolean;
}

interface DiscoveredDevice {
  ip:       string;
  mac:      string;
  hostname: string;
  type:     string;     // e.g. "esp32"
  lastSeen: string;
}

interface HotspotConfig {
  ssid:           string;
  password:       string;
  channel:        number;
  maxConnections: number;
  active:         boolean;
}
```

---

## Subscribed Actions

### `SCAN_NETWORKS`

Trigger a WiFi network scan.

**Payload:** `{}`

**Response event:** `NETWORK_SCAN_RESULT` → `{ networks: NetworkInfo[] }`

---

### `CONNECT_WIFI`

Connect to a specific WiFi network.

**Payload:**
```typescript
{
  ssid:     string;
  password: string;
}
```

**Broadcasts on success:** `WIFI_CONNECTED` → `{ ssid, localIP }`
**Broadcasts on failure:** `WIFI_DISCONNECTED` → `{ ssid, reason: "network_not_found" }`

---

### `CREATE_HOTSPOT`

Create a WiFi hotspot for provisioning new ESP32 devices.

**Payload:**
```typescript
{
  ssid?:           string;   // default: "LUMA_Hotspot"
  password?:       string;   // default: "luma12345"
  channel?:        number;   // default: 6
  maxConnections?: number;   // default: 8
}
```

**Broadcast:** `HOTSPOT_CREATED` → `{ ssid, password, channel, maxConnections, active }`

---

### `STOP_HOTSPOT`

Stop the active hotspot.

**Payload:** `{}`

**Broadcast:** `HOTSPOT_STOPPED` → `{ ssid }`

---

### `DISCOVER_DEVICES`

Scan the local network for ESP32 and IoT devices.
Each found device triggers a `DEVICE_FOUND` broadcast.

**Payload:** `{}`

**Broadcasts (per device):** `DEVICE_FOUND` → `{ device: DiscoveredDevice }`

**Response event:** `DISCOVERY_COMPLETE` → `{ devices: DiscoveredDevice[], count: number }`

---

### `GET_LOCAL_IP`

Get the server's current local network IP.

**Payload:** `{}`

**Response event:** `LOCAL_IP` → `{ ip: string }`

---

### `SWITCH_NETWORK`

Switch to a different WiFi network.
Triggers `WIFI_CONNECTED` or `WIFI_DISCONNECTED` plus a `NETWORK_CHANGED` broadcast.

**Payload:** `{ ssid: string; password: string }`

**Broadcast:** `NETWORK_CHANGED` → `{ from: string, to: string }`

---

### `GET_NETWORK_STATUS`

Get current network state summary.

**Payload:** `{}`

**Response event:** `NETWORK_STATUS`
```typescript
{
  connected:        boolean;
  network:          NetworkInfo | null;
  localIP:          string;
  hotspotActive:    boolean;
  discoveredDevices: number;
}
```

---

## Broadcasts Emitted

| Broadcast | When |
|---|---|
| `WIFI_CONNECTED` | Successfully connected to a network |
| `WIFI_DISCONNECTED` | Connection failed or dropped |
| `HOTSPOT_CREATED` | Hotspot started |
| `HOTSPOT_STOPPED` | Hotspot stopped |
| `DEVICE_FOUND` | Local network device discovered |
| `NETWORK_CHANGED` | Switched from one network to another |

---

## Signal Strength Reference

| RSSI Range | Quality |
|---|---|
| > -50 dBm | Excellent |
| -50 to -60 dBm | Good |
| -60 to -70 dBm | Fair |
| < -70 dBm | Weak |

---

## REST Endpoints

```
GET  /api/engines/wifi_engine           — engine info + status
POST /api/engines/wifi_engine/command   — send any action
GET  /api/engines/wifi/networks         — scan results + discovered devices + local IP
```

**Example — create hotspot for new device provisioning:**
```bash
curl -X POST /api/engines/wifi_engine/command \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CREATE_HOTSPOT",
    "payload": { "ssid": "LUMA_Setup", "password": "luma2025" },
    "priority": "high"
  }'
```
