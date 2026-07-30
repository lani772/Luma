package security

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/database"
	"gorm.io/gorm"
)

type RiskLevel string

const (
	RiskLevelLow    RiskLevel = "low"
	RiskLevelMedium RiskLevel = "medium"
	RiskLevelHigh   RiskLevel = "high"
)

type RiskAssessment struct {
	Level               RiskLevel `json:"level"`
	Reason              string    `json:"reason"`
	ThreatScore         int       `json:"threat_score"` // 0 to 100 numerical score
	StepUpRequired      bool      `json:"step_up_required"`
}

type RiskAnalyzer struct {
	db *gorm.DB
}

func NewRiskAnalyzer(db *gorm.DB) *RiskAnalyzer {
	return &RiskAnalyzer{db: db}
}

func (ra *RiskAnalyzer) AssessRisk(ctx context.Context, userID uuid.UUID, reqIP, reqUserAgent, reqDeviceID string) (*RiskAssessment, error) {
	// If no previous sessions exist, first-time user profile is considered low risk initially (Score 10)
	var count int64
	err := ra.db.Model(&database.Session{}).Where("user_id = ?", userID).Count(&count).Error
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return &RiskAssessment{
			Level:               RiskLevelLow,
			Reason:              "first-time user session registration",
			ThreatScore:         10,
			StepUpRequired:      false,
		}, nil
	}

	threatScore := 0
	reasons := []string{}

	// 1. Device recognition check (Weight: 40 points)
	var matchingDeviceSessions int64
	err = ra.db.Model(&database.Session{}).Where("user_id = ? AND device_id = ? AND status = 'active'", userID, reqDeviceID).Count(&matchingDeviceSessions).Error
	if err != nil {
		return nil, err
	}
	if matchingDeviceSessions == 0 {
		threatScore += 40
		reasons = append(reasons, "unrecognized device fingerprint (+40)")
	}

	// 2. Unrecognized IP address / network context check (Weight: 35 points)
	var matchingIPSessions int64
	err = ra.db.Model(&database.Session{}).Where("user_id = ? AND ip_address = ?", userID, reqIP).Count(&matchingIPSessions).Error
	if err != nil {
		return nil, err
	}
	if matchingIPSessions == 0 {
		threatScore += 35
		reasons = append(reasons, "new network address origin (+35)")
	}

	// 3. User-Agent heuristics / Headless / Automation Bot check (Weight: 30 points)
	reqUaLower := strings.ToLower(reqUserAgent)
	if strings.Contains(reqUaLower, "bot") || strings.Contains(reqUaLower, "headless") || strings.Contains(reqUaLower, "phantomjs") || strings.Contains(reqUaLower, "selenium") {
		threatScore += 30
		reasons = append(reasons, "suspicious automation agent fingerprint (+30)")
	}

	// 4. Lockout failed login history check (Weight: 20 points)
	var attempt database.LoginAttempt
	err = ra.db.Where("key = ?", userID.String()).First(&attempt).Error
	if err == nil && attempt.Attempts > 1 {
		threatScore += 20
		reasons = append(reasons, "history of recent failed login attempts (+20)")
	}

	// Bound threatScore to maximum of 100
	if threatScore > 100 {
		threatScore = 100
	}

	// Evaluate level based on cumulative score thresholds
	level := RiskLevelLow
	stepUpRequired := false
	if threatScore >= 70 {
		level = RiskLevelHigh
		stepUpRequired = true
	} else if threatScore >= 30 {
		level = RiskLevelMedium
		stepUpRequired = false
	}

	reasonStr := strings.Join(reasons, ", ")
	if reasonStr == "" {
		reasonStr = "verified device and network profile match"
	}

	return &RiskAssessment{
		Level:               level,
		Reason:              reasonStr,
		ThreatScore:         threatScore,
		StepUpRequired:      stepUpRequired,
	}, nil
}
