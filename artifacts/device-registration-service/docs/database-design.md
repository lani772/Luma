# Database Design Specification

DRDMS uses PostgreSQL as the primary production database to ensure transaction integrity and strong relational modeling. It supports SQLite for development and testing.

## Relational Schema Diagram (Concept)

```
 [controllers] <──1:N── [resources] <──1:N── [device_capabilities]
       │                    │
       ├──1:1── [device_configurations]
       │
       ├──1:1── [device_credentials]
       │
       ├──1:N── [device_status_history]
       │
       └──1:N── [device_relationships]
```

## Schema Table Definitions

### 1. `controllers`
Stores registered microcontrollers (ESP32, Arduino, Raspberry Pi).
- `id` (UUID PRIMARY KEY)
- `owner_reference` (UUID NOT NULL) - Points to user ID
- `serial_number` (VARCHAR UNIQUE NOT NULL)
- `device_type` (VARCHAR NOT NULL) - e.g. "ESP32", "Arduino"
- `chip_id` (VARCHAR)
- `hardware_version` (VARCHAR)
- `firmware_version` (VARCHAR)
- `status` (VARCHAR NOT NULL) - "simulation", "unregistered", "pending", "active", "suspended"
- `mac_address` (VARCHAR UNIQUE)
- `created_at` (TIMESTAMPTZ NOT NULL)
- `registered_at` (TIMESTAMPTZ)

### 2. `resources`
Smart devices attached to a microcontroller.
- `id` (UUID PRIMARY KEY)
- `controller_id` (UUID REFERENCES controllers(id) ON DELETE CASCADE)
- `room_id` (UUID)
- `name` (VARCHAR NOT NULL)
- `resource_type` (VARCHAR NOT NULL) - e.g., "lamp", "fan", "sensor"
- `created_at` (TIMESTAMPTZ NOT NULL)

### 3. `rooms`
Rooms where controllers or resources reside.
- `id` (UUID PRIMARY KEY)
- `name` (VARCHAR NOT NULL)
- `description` (TEXT)
- `image_url` (TEXT)
- `location` (VARCHAR)
- `created_at` (TIMESTAMPTZ NOT NULL)

### 4. `device_capabilities`
Abilities of a specific resource.
- `id` (UUID PRIMARY KEY)
- `resource_id` (UUID REFERENCES resources(id) ON DELETE CASCADE)
- `capability_name` (VARCHAR NOT NULL) - e.g., "power_control", "brightness", "color_temp", "speed", "sensor_reading"
- `parameters` (JSONB) - Min, max, config mapping
- `created_at` (TIMESTAMPTZ NOT NULL)

### 5. `device_configurations`
Hardware pin & logic settings for the controller.
- `id` (UUID PRIMARY KEY)
- `controller_id` (UUID REFERENCES controllers(id) ON DELETE CASCADE)
- `gpio_mappings` (JSONB NOT NULL) - Key-value map of resource IDs to pin numbers
- `device_logic` (JSONB) - Threshold rules, double-claps, default rules
- `version` (INT NOT NULL DEFAULT 1)
- `created_at` (TIMESTAMPTZ NOT NULL)

### 6. `device_credentials`
Microcontroller security keys and credentials stored securely.
- `id` (UUID PRIMARY KEY)
- `controller_id` (UUID REFERENCES controllers(id) ON DELETE CASCADE)
- `registration_token` (VARCHAR UNIQUE) - Single-use code for claiming
- `api_key_hash` (VARCHAR) - SHA-256 hash of device key
- `mqtt_username` (VARCHAR)
- `encrypted_mqtt_password` (TEXT) - AES-256-GCM encrypted
- `encrypted_device_secret` (TEXT) - AES-256-GCM encrypted
- `nonce` (VARCHAR)
- `key_version` (INT NOT NULL DEFAULT 1)
- `expires_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ NOT NULL)

### 7. `device_simulations`
Temporary blueprints for devices being designed by the AI assistant prior to physical flashing.
- `id` (UUID PRIMARY KEY)
- `user_id` (UUID NOT NULL)
- `controller_type` (VARCHAR NOT NULL)
- `layout_blueprint` (JSONB NOT NULL)
- `status` (VARCHAR NOT NULL) - "simulation", "flashed", "registered"
- `created_at` (TIMESTAMPTZ NOT NULL)
