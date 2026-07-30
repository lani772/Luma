package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// JSONB is a utility type for storing JSON payloads in GORM
type JSONB []byte

func (j JSONB) Value() (interface{}, error) {
	if len(j) == 0 {
		return "{}", nil
	}
	return string(j), nil
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	switch v := value.(type) {
	case string:
		*j = JSONB(v)
	case []byte:
		*j = JSONB(v)
	}
	return nil
}

// Controller represents a physical microcontroller
type Controller struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	OwnerReference   uuid.UUID  `gorm:"type:uuid;not null;index" json:"owner_reference"`
	SerialNumber     string     `gorm:"type:varchar(100);uniqueIndex;not null" json:"serial_number"`
	DeviceType       string     `gorm:"type:varchar(50);not null" json:"device_type"`
	ChipID           string     `gorm:"type:varchar(100)" json:"chip_id"`
	HardwareVersion  string     `gorm:"type:varchar(50)" json:"hardware_version"`
	FirmwareVersion  string     `gorm:"type:varchar(50)" json:"firmware_version"`
	Status           string     `gorm:"type:varchar(50);not null;index" json:"status"` // e.g. "simulation", "active", "suspended"
	MacAddress       string     `gorm:"type:varchar(50);uniqueIndex" json:"mac_address"`
	CreatedAt        time.Time  `gorm:"not null" json:"created_at"`
	RegisteredAt     *time.Time `json:"registered_at"`

	Resources     []Resource           `gorm:"foreignKey:ControllerID;constraint:OnDelete:CASCADE" json:"resources,omitempty"`
	Configuration *DeviceConfiguration `gorm:"foreignKey:ControllerID;constraint:OnDelete:CASCADE" json:"configuration,omitempty"`
	Credentials   *DeviceCredentials   `gorm:"foreignKey:ControllerID;constraint:OnDelete:CASCADE" json:"credentials,omitempty"`
}

// Room represents the room containing logical components
type Room struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	ImageUrl    string    `gorm:"type:text" json:"image_url"`
	Location    string    `gorm:"type:varchar(100)" json:"location"`
	CreatedAt   time.Time `gorm:"not null" json:"created_at"`
}

// Resource represents a logical sensor or control element inside a room/controller
type Resource struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ControllerID uuid.UUID `gorm:"type:uuid;not null;index" json:"controller_id"`
	RoomID       uuid.UUID `gorm:"type:uuid;index" json:"room_id"`
	Name         string    `gorm:"type:varchar(100);not null" json:"name"`
	ResourceType string    `gorm:"type:varchar(50);not null" json:"resource_type"` // e.g. "lamp", "fan", "sensor"
	CreatedAt    time.Time `gorm:"not null" json:"created_at"`

	Capabilities []DeviceCapability `gorm:"foreignKey:ResourceID;constraint:OnDelete:CASCADE" json:"capabilities,omitempty"`
}

// DeviceCapability defines actions or features supported by the resource
type DeviceCapability struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ResourceID     uuid.UUID `gorm:"type:uuid;not null;index" json:"resource_id"`
	CapabilityName string    `gorm:"type:varchar(100);not null" json:"capability_name"` // e.g. "power_control", "brightness", "color_temp", "speed", "sensor_reading"
	Parameters     JSONB     `gorm:"type:jsonb" json:"parameters"`                      // Min, max, config maps
	CreatedAt      time.Time `gorm:"not null" json:"created_at"`
}

// DeviceConfiguration represents pin & GPIO settings
type DeviceConfiguration struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ControllerID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"controller_id"`
	GPIOMappings JSONB     `gorm:"type:jsonb;not null" json:"gpio_mappings"` // e.g. {"resource_uuid": 15, "resource_uuid2": 16}
	DeviceLogic  JSONB     `gorm:"type:jsonb;not null" json:"device_logic"`  // e.g. {"temp_threshold": 25}
	Version      int       `gorm:"not null;default:1" json:"version"`
	CreatedAt    time.Time `gorm:"not null" json:"created_at"`
}

// DeviceCredentials contains encryption metadata and rotational secrets
type DeviceCredentials struct {
	ID                    uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	ControllerID          uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex" json:"controller_id"`
	RegistrationToken     string     `gorm:"type:varchar(255);uniqueIndex" json:"registration_token"`
	APIKeyHash            string     `gorm:"type:varchar(255)" json:"api_key_hash"`
	MqttUsername          string     `gorm:"type:varchar(100)" json:"mqtt_username"`
	EncryptedMqttPassword string     `gorm:"type:text" json:"encrypted_mqtt_password"`
	EncryptedDeviceSecret string     `gorm:"type:text" json:"encrypted_device_secret"`
	Nonce                 string     `gorm:"type:varchar(50)" json:"nonce"`
	KeyVersion            int        `gorm:"not null;default:1" json:"key_version"`
	ExpiresAt             *time.Time `json:"expires_at"`
	CreatedAt             time.Time  `gorm:"not null" json:"created_at"`
}

// DeviceSimulation holds a virtual model designed with the AI assistant before flashing
type DeviceSimulation struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID          uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	ControllerType  string    `gorm:"type:varchar(50);not null" json:"controller_type"`
	LayoutBlueprint JSONB     `gorm:"type:jsonb;not null" json:"layout_blueprint"`
	Status          string    `gorm:"type:varchar(50);not null" json:"status"` // e.g. "simulation", "flashed", "registered"
	CreatedAt       time.Time `gorm:"not null" json:"created_at"`
}

// Simple helper to unmarshal JSONB
func UnmarshalJSONB(data JSONB, target interface{}) error {
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, target)
}

// Simple helper to marshal JSONB
func MarshalJSONB(source interface{}) (JSONB, error) {
	bytes, err := json.Marshal(source)
	if err != nil {
		return nil, err
	}
	return JSONB(bytes), nil
}
