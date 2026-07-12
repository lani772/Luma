// Package mqtt implements the MQTT Broker Adapter Engine's business logic:
// per-device topic conventions, scoped credential issuance, and broker
// health surfaced over HTTP. It talks to the broker only through
// pkg/mqttadapter.Adapter — never a concrete client library — per the
// project's "adapter interface, swappable broker" requirement.
package mqtt

import "fmt"

// Topics is the fixed topic convention devices and the cloud agree on. All
// topics are scoped per device id so one compromised device credential
// cannot subscribe to another device's traffic (enforced by the broker's
// ACLs using the same device-scoped username, provisioned in
// IssueCredentials).
type Topics struct {
	State     string // device -> cloud: retained current state
	Telemetry string // device -> cloud: sensor readings/events stream
	Commands  string // cloud -> device: command messages
	Status    string // device -> cloud: online/offline LWT topic
}

func TopicsForDevice(deviceID string) Topics {
	base := fmt.Sprintf("luma/devices/%s", deviceID)
	return Topics{
		State:     base + "/state",
		Telemetry: base + "/telemetry",
		Commands:  base + "/commands",
		Status:    base + "/status",
	}
}
