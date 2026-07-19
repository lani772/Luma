package models

// JSONMap is a flexible key-value map stored as a BSON document in MongoDB.
// MongoDB natively handles map[string]any serialization; no custom driver
// methods are needed unlike the old Postgres JSONB approach.
type JSONMap map[string]any

// JSONList is the array counterpart of JSONMap, used for fields like
// Device.Capabilities that hold a JSON array.
type JSONList []any
