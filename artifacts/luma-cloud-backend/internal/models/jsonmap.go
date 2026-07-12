package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// JSONMap adapts a Postgres JSONB column to a Go map for GORM. Kept minimal
// on purpose — engines that need structured JSON (capabilities, actions,
// time_config, ...) define their own typed DTOs and marshal through this.
type JSONMap map[string]any

func (m JSONMap) Value() (driver.Value, error) {
	if m == nil {
		return "{}", nil
	}
	return json.Marshal(m)
}

func (m *JSONMap) Scan(value any) error {
	if value == nil {
		*m = JSONMap{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		if s, ok := value.(string); ok {
			bytes = []byte(s)
		} else {
			return errors.New("JSONMap: unsupported Scan type")
		}
	}
	if len(bytes) == 0 {
		*m = JSONMap{}
		return nil
	}
	return json.Unmarshal(bytes, m)
}

// JSONList is the array-shaped counterpart of JSONMap, used for columns like
// devices.capabilities that store a JSON array.
type JSONList []any

func (l JSONList) Value() (driver.Value, error) {
	if l == nil {
		return "[]", nil
	}
	return json.Marshal(l)
}

func (l *JSONList) Scan(value any) error {
	if value == nil {
		*l = JSONList{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		if s, ok := value.(string); ok {
			bytes = []byte(s)
		} else {
			return errors.New("JSONList: unsupported Scan type")
		}
	}
	if len(bytes) == 0 {
		*l = JSONList{}
		return nil
	}
	return json.Unmarshal(bytes, l)
}
