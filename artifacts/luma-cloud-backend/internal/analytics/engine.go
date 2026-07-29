package analytics

import (
	"fmt"
	"log"
	"math"
	"sort"
	"sync"
	"time"
)

// DataPoint represents a single data point
type DataPoint struct {
	Timestamp time.Time              `json:"timestamp"`
	DeviceID  string                 `json:"deviceId"`
	Metric    string                 `json:"metric"`
	Value     float64                `json:"value"`
	Tags      map[string]interface{} `json:"tags"`
}

// Anomaly represents an anomaly detection result
type Anomaly struct {
	ID          string    `json:"id"`
	DeviceID    string    `json:"deviceId"`
	Metric      string    `json:"metric"`
	DetectedAt  time.Time `json:"detectedAt"`
	ExpectedVal float64   `json:"expectedValue"`
	ActualVal   float64   `json:"actualValue"`
	Severity    string    `json:"severity"` // low, medium, high
	Description string    `json:"description"`
}

// Prediction represents a prediction result
type Prediction struct {
	ID          string    `json:"id"`
	DeviceID    string    `json:"deviceId"`
	Metric      string    `json:"metric"`
	PredictedAt time.Time `json:"predictedAt"`
	TimeFrame   string    `json:"timeFrame"` // 1h, 24h, 7d
	Value       float64   `json:"value"`
	Confidence  float64   `json:"confidence"` // 0-100
	Description string    `json:"description"`
}

// Recommendation represents a recommendation
type Recommendation struct {
	ID          string `json:"id"`
	DeviceID    string `json:"deviceId"`
	Type        string `json:"type"` // efficiency, optimization, maintenance
	Title       string `json:"title"`
	Description string `json:"description"`
	Impact      string `json:"impact"` // energy, cost, performance
	Priority    string `json:"priority"` // low, medium, high
}

// AnalyticsEngine handles advanced analytics
type AnalyticsEngine struct {
	dataPoints   []DataPoint
	anomalies    []Anomaly
	predictions  []Prediction
	mu           sync.RWMutex
	windowSize   int // for moving averages
	stdDevThreshold float64
}

// NewAnalyticsEngine creates a new analytics engine
func NewAnalyticsEngine() *AnalyticsEngine {
	return &AnalyticsEngine{
		dataPoints:      []DataPoint{},
		anomalies:       []Anomaly{},
		predictions:     []Prediction{},
		windowSize:      24, // 24-hour window for analysis
		stdDevThreshold: 2.0, // 2 standard deviations for anomaly detection
	}
}

// AddDataPoint adds a data point
func (ae *AnalyticsEngine) AddDataPoint(dp DataPoint) {
	ae.mu.Lock()
	defer ae.mu.Unlock()

	ae.dataPoints = append(ae.dataPoints, dp)

	// Keep only last 1000 points per device to save memory
	if len(ae.dataPoints) > 10000 {
		ae.dataPoints = ae.dataPoints[len(ae.dataPoints)-10000:]
	}
}

// DetectAnomalies detects anomalies in device data
func (ae *AnalyticsEngine) DetectAnomalies(deviceID string) []Anomaly {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	var anomalies []Anomaly
	metrics := ae.groupByMetric(deviceID)

	for metric, points := range metrics {
		if len(points) < ae.windowSize {
			continue
		}

		// Calculate statistics
		mean, stdDev := ae.calculateStats(points)
		threshold := ae.stdDevThreshold * stdDev

		// Check recent points for anomalies
		recentStart := time.Now().Add(-time.Hour)
		for _, point := range points {
			if point.Timestamp.After(recentStart) {
				deviation := math.Abs(point.Value - mean)
				if deviation > threshold {
					severity := ae.calculateSeverity(deviation, threshold)
					anomaly := Anomaly{
						ID:          fmt.Sprintf("anom_%d", time.Now().UnixNano()),
						DeviceID:    deviceID,
						Metric:      metric,
						DetectedAt:  time.Now(),
						ExpectedVal: mean,
						ActualVal:   point.Value,
						Severity:    severity,
						Description: fmt.Sprintf("Detected unusual %s: %.2f (expected ~%.2f)", metric, point.Value, mean),
					}
					anomalies = append(anomalies, anomaly)
				}
			}
		}
	}

	return anomalies
}

// PredictUsage predicts future energy usage
func (ae *AnalyticsEngine) PredictUsage(deviceID string, timeFrame string) *Prediction {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	points := ae.filterByDevice(deviceID, "energy")
	if len(points) < ae.windowSize {
		return nil
	}

	// Simple linear regression-based prediction
	slope, intercept := ae.linearRegression(points)
	
	var predictedValue float64
	switch timeFrame {
	case "1h":
		predictedValue = slope + intercept // Next hour
	case "24h":
		predictedValue = (slope * 24) + intercept // Next 24 hours
	case "7d":
		predictedValue = (slope * 168) + intercept // Next week
	default:
		predictedValue = slope + intercept
	}

	// Calculate confidence (higher R² = higher confidence)
	confidence := ae.calculateRSquared(points, slope, intercept) * 100

	return &Prediction{
		ID:          fmt.Sprintf("pred_%d", time.Now().UnixNano()),
		DeviceID:    deviceID,
		Metric:      "energy",
		PredictedAt: time.Now(),
		TimeFrame:   timeFrame,
		Value:       math.Max(predictedValue, 0), // Can't be negative
		Confidence:  confidence,
		Description: fmt.Sprintf("Predicted energy usage for %s: %.2f kWh", timeFrame, predictedValue),
	}
}

// GenerateRecommendations generates optimization recommendations
func (ae *AnalyticsEngine) GenerateRecommendations(deviceID string) []Recommendation {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	var recommendations []Recommendation
	energyPoints := ae.filterByDevice(deviceID, "energy")

	if len(energyPoints) == 0 {
		return recommendations
	}

	// Calculate average consumption
	avg := ae.calculateMean(energyPoints)
	peak := ae.calculateMax(energyPoints)

	// Recommendation 1: High peak usage
	if peak > avg*1.5 {
		recommendations = append(recommendations, Recommendation{
			ID:          fmt.Sprintf("rec_%d", time.Now().UnixNano()),
			DeviceID:    deviceID,
			Type:        "optimization",
			Title:       "Reduce Peak Usage",
			Description: "Peak energy usage is 50% higher than average. Consider spreading usage patterns.",
			Impact:      "energy",
			Priority:    "high",
		})
	}

	// Recommendation 2: Continuous operation
	if ae.isRunningContinuous(energyPoints) {
		recommendations = append(recommendations, Recommendation{
			ID:          fmt.Sprintf("rec_%d", time.Now().UnixNano()),
			DeviceID:    deviceID,
			Type:        "efficiency",
			Title:       "Enable Power Saving Mode",
			Description: "Device runs continuously. Consider scheduling or enabling power-saving mode.",
			Impact:      "energy",
			Priority:    "medium",
		})
	}

	// Recommendation 3: Maintenance
	if ae.detectDegradation(energyPoints) {
		recommendations = append(recommendations, Recommendation{
			ID:          fmt.Sprintf("rec_%d", time.Now().UnixNano()),
			DeviceID:    deviceID,
			Type:        "maintenance",
			Title:       "Schedule Maintenance",
			Description: "Energy consumption trend shows potential degradation. Consider maintenance check.",
			Impact:      "performance",
			Priority:    "medium",
		})
	}

	return recommendations
}

// Helper functions

func (ae *AnalyticsEngine) groupByMetric(deviceID string) map[string][]DataPoint {
	grouped := make(map[string][]DataPoint)
	for _, point := range ae.dataPoints {
		if point.DeviceID == deviceID {
			grouped[point.Metric] = append(grouped[point.Metric], point)
		}
	}
	return grouped
}

func (ae *AnalyticsEngine) filterByDevice(deviceID string, metric string) []DataPoint {
	var filtered []DataPoint
	for _, point := range ae.dataPoints {
		if point.DeviceID == deviceID && point.Metric == metric {
			filtered = append(filtered, point)
		}
	}
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Timestamp.Before(filtered[j].Timestamp)
	})
	return filtered
}

func (ae *AnalyticsEngine) calculateStats(points []DataPoint) (mean float64, stdDev float64) {
	if len(points) == 0 {
		return 0, 0
	}

	mean = ae.calculateMean(points)
	
	sumSquares := 0.0
	for _, p := range points {
		diff := p.Value - mean
		sumSquares += diff * diff
	}
	
	stdDev = math.Sqrt(sumSquares / float64(len(points)))
	return mean, stdDev
}

func (ae *AnalyticsEngine) calculateMean(points []DataPoint) float64 {
	if len(points) == 0 {
		return 0
	}
	sum := 0.0
	for _, p := range points {
		sum += p.Value
	}
	return sum / float64(len(points))
}

func (ae *AnalyticsEngine) calculateMax(points []DataPoint) float64 {
	if len(points) == 0 {
		return 0
	}
	max := points[0].Value
	for _, p := range points {
		if p.Value > max {
			max = p.Value
		}
	}
	return max
}

func (ae *AnalyticsEngine) calculateSeverity(deviation, threshold float64) string {
	multiplier := deviation / threshold
	if multiplier > 3 {
		return "high"
	} else if multiplier > 1.5 {
		return "medium"
	}
	return "low"
}

func (ae *AnalyticsEngine) linearRegression(points []DataPoint) (slope float64, intercept float64) {
	if len(points) < 2 {
		return 0, 0
	}

	n := float64(len(points))
	sumX, sumY, sumXY, sumX2 := 0.0, 0.0, 0.0, 0.0

	for i, p := range points {
		x := float64(i)
		y := p.Value
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX)
	intercept = (sumY - slope*sumX) / n

	return slope, intercept
}

func (ae *AnalyticsEngine) calculateRSquared(points []DataPoint, slope float64, intercept float64) float64 {
	if len(points) < 2 {
		return 0
	}

	meanY := ae.calculateMean(points)
	ssRes := 0.0 // Residual sum of squares
	ssTot := 0.0 // Total sum of squares

	for i, p := range points {
		predicted := slope*float64(i) + intercept
		ssTot += (p.Value - meanY) * (p.Value - meanY)
		ssRes += (p.Value - predicted) * (p.Value - predicted)
	}

	if ssTot == 0 {
		return 0
	}

	return 1 - (ssRes / ssTot)
}

func (ae *AnalyticsEngine) isRunningContinuous(points []DataPoint) bool {
	if len(points) < 10 {
		return false
	}
	
	// If all recent points are above threshold, consider it continuous
	recentStart := time.Now().Add(-24 * time.Hour)
	aboveThreshold := 0
	for _, p := range points {
		if p.Timestamp.After(recentStart) && p.Value > 10 {
			aboveThreshold++
		}
	}
	
	return aboveThreshold > len(points)*80/100 // 80% of time above threshold
}

func (ae *AnalyticsEngine) detectDegradation(points []DataPoint) bool {
	if len(points) < ae.windowSize*2 {
		return false
	}

	// Compare first half vs second half
	mid := len(points) / 2
	firstHalf := ae.calculateMean(points[:mid])
	secondHalf := ae.calculateMean(points[mid:])

	// Degradation if consumption increases significantly over time
	return (secondHalf - firstHalf) > firstHalf*0.2 // 20% increase
}
