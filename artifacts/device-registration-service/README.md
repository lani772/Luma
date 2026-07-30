# LUMA Device Registration Service

Comprehensive device registration and management service with support for multiple device types, provisioning, and lifecycle management.

## Features

- Device registration and provisioning
- Multi-protocol support (Zigbee, Z-Wave, WiFi, BLE, Thread)
- Device health monitoring
- Firmware management and updates
- Device grouping and organization
- Access control and sharing
- Device discovery and pairing
- Real-time device status tracking
- Historical data storage

## Supported Device Types

- Lights (RGB, Dimmable, On/Off)
- Switches (Relay, Smart Dimmer)
- Sensors (Temperature, Humidity, Motion, Light)
- Locks (Smart Lock, Deadbolt)
- Plugs (Smart Plug, Smart Outlet)
- Thermostats
- Cameras
- Speakers
- Custom Devices

## Endpoints

### Device Registration
- `POST /devices/register` - Register new device
- `POST /devices/pair` - Pair device with home
- `POST /devices/discover` - Discover devices on network

### Device Management
- `GET /devices` - List all devices
- `GET /devices/{deviceId}` - Get device details
- `PATCH /devices/{deviceId}` - Update device
- `DELETE /devices/{deviceId}` - Remove device
- `POST /devices/{deviceId}/rename` - Rename device
- `POST /devices/{deviceId}/assign-room` - Assign to room

### Device Health
- `GET /devices/{deviceId}/health` - Get device health
- `GET /devices/{deviceId}/history` - Get device history
- `POST /devices/{deviceId}/heartbeat` - Device heartbeat

### Firmware Management
- `GET /devices/{deviceId}/firmware` - Get firmware info
- `POST /devices/{deviceId}/firmware/update` - Update firmware
- `GET /devices/{deviceId}/firmware/status` - Get update status

## Configuration

```env
DATABASE_URL=postgresql://user:password@localhost/luma
MQTT_BROKER=mqtt://localhost:1883
REDIS_URL=redis://localhost:6379
DEVICE_TIMEOUT=300
DISCOVERY_TIMEOUT=30
MAX_DEVICES_PER_HOME=500
```

## Database Schema

### Devices Table
- device_id (UUID)
- home_id (UUID)
- name (VARCHAR)
- device_type (VARCHAR)
- protocol (VARCHAR)
- mac_address (VARCHAR)
- ip_address (VARCHAR)
- manufacturer (VARCHAR)
- model (VARCHAR)
- firmware_version (VARCHAR)
- status (VARCHAR: online, offline, error)
- health_score (INTEGER 0-100)
- last_seen (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Device Metrics Table
- metric_id (UUID)
- device_id (UUID)
- metric_type (VARCHAR)
- value (DECIMAL)
- unit (VARCHAR)
- timestamp (TIMESTAMP)

### Firmware Table
- firmware_id (UUID)
- device_type (VARCHAR)
- version (VARCHAR)
- url (VARCHAR)
- checksum (VARCHAR)
- size (INTEGER)
- released_at (TIMESTAMP)

## API Examples

### Register Device
```bash
curl -X POST http://localhost:3002/devices/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "homeid": "home-123",
    "name": "Living Room Light",
    "deviceType": "light",
    "protocol": "zigbee",
    "macAddress": "AA:BB:CC:DD:EE:FF"
  }'
```

### Pair Device
```bash
curl -X POST http://localhost:3002/devices/pair \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "homeId": "home-123",
    "protocol": "zigbee",
    "duration": 60
  }'
```

### Update Device
```bash
curl -X PATCH http://localhost:3002/devices/device-456 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Bedroom Light",
    "room": "bedroom"
  }'
```

## Deployment

### Docker
```bash
docker build -t luma-device-service .
docker run -p 3002:3002 \
  -e DATABASE_URL=postgresql://... \
  -e MQTT_BROKER=mqtt://... \
  luma-device-service
```

### Kubernetes
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/statefulset.yaml
kubectl apply -f k8s/service.yaml
```

## Monitoring

- Health check: `GET /health`
- Metrics: `GET /metrics`
- Device discovery status: `GET /discovery/status`
- MQTT connection status: `GET /mqtt/status`

## License

MIT
