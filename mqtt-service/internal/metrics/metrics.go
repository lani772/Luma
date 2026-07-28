package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	ConnectedDevices = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "luma_mqtt_connected_devices",
		Help: "The total number of currently active connected IoT devices",
	})

	PublishedMessages = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "luma_mqtt_published_messages_total",
		Help: "The total number of published messages to MQTT broker",
	})

	ReceivedMessages = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "luma_mqtt_received_messages_total",
		Help: "The total number of received messages from MQTT broker",
	})

	FailedPublishes = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "luma_mqtt_failed_publishes_total",
		Help: "The total number of failed publish operations",
	})

	ActiveSubscriptions = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "luma_mqtt_active_subscriptions",
		Help: "The total number of currently active MQTT topic subscriptions",
	})

	RetryCount = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "luma_mqtt_retry_operations_total",
		Help: "The total number of message publish retries",
	})
)

func Init() {
	prometheus.MustRegister(ConnectedDevices)
	prometheus.MustRegister(PublishedMessages)
	prometheus.MustRegister(ReceivedMessages)
	prometheus.MustRegister(FailedPublishes)
	prometheus.MustRegister(ActiveSubscriptions)
	prometheus.MustRegister(RetryCount)
}
