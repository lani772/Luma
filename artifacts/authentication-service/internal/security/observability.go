package security

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	MetricLoginAttempts = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_login_attempts_total",
			Help: "The total number of login attempts",
		},
		[]string{"status"}, // "success", "failed", "step_up"
	)

	MetricRegistrations = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_registrations_total",
			Help: "The total number of successful user registrations",
		},
	)

	MetricTokenRotations = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_token_rotations_total",
			Help: "The total number of refresh token rotation events",
		},
	)

	MetricRiskAssessments = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_risk_assessments_total",
			Help: "The total number of threat login risk assessments performed",
		},
		[]string{"level"}, // "low", "medium", "high"
	)
)

func RecordLoginAttempt(status string) {
	MetricLoginAttempts.WithLabelValues(status).Inc()
}

func RecordRegistration() {
	MetricRegistrations.Inc()
}

func RecordTokenRotation() {
	MetricTokenRotations.Inc()
}

func RecordRiskAssessment(level string) {
	MetricRiskAssessments.WithLabelValues(level).Inc()
}
