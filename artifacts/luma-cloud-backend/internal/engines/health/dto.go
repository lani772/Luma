package health

import "time"

type SubmitHeartbeatRequest struct {
	FirmwareVersion    string   `json:"firmwareVersion"`
	HeapFreeBytes      int64    `json:"heapFreeBytes"`
	FlashUsedBytes     int64    `json:"flashUsedBytes"`
	WifiRSSI           int      `json:"wifiRSSI"`
	MqttConnected      bool     `json:"mqttConnected"`
	RestartCount       int      `json:"restartCount"`
	TemperatureCelsius *float64 `json:"temperatureCelsius,omitempty"`
}

type HealthReportDTO struct {
	ID                 string    `json:"id"`
	DeviceID           string    `json:"deviceId"`
	FirmwareVersion    *string   `json:"firmwareVersion,omitempty"`
	HeapFreeBytes      int64     `json:"heapFreeBytes"`
	FlashUsedBytes     int64     `json:"flashUsedBytes"`
	WifiRSSI           int      `json:"wifiRSSI"`
	MqttConnected      bool     `json:"mqttConnected"`
	RestartCount       int      `json:"restartCount"`
	TemperatureCelsius *float64  `json:"temperatureCelsius,omitempty"`
	CreatedAt          time.Time `json:"createdAt"`
}

type DeviceHealthSummaryDTO struct {
	DeviceID      string            `json:"deviceId"`
	Status        string            `json:"status"`
	LastHeartbeat *time.Time        `json:"lastHeartbeat,omitempty"`
	LatestReport  *HealthReportDTO  `json:"latestReport,omitempty"`
	History       []HealthReportDTO `json:"history,omitempty"`
}
