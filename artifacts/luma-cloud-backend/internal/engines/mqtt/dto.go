package mqtt

import "time"

type CredentialsDTO struct {
	MQTTClientID string    `json:"mqttClientId"`
	MQTTUsername string    `json:"mqttUsername"`
	MQTTPassword string    `json:"mqttPassword"` // returned once, at issuance time only
	BrokerURL    string    `json:"brokerUrl"`
	Topics       Topics    `json:"topics"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

type TopicsResponse struct {
	DeviceID string `json:"deviceId"`
	Topics   Topics `json:"topics"`
}
