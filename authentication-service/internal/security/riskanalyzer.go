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
	StepUpRequired      bool      `json:"step_up_required"`
}

type RiskAnalyzer struct {
	db *gorm.DB
}

func NewRiskAnalyzer(db *gorm.DB) *RiskAnalyzer {
	return &RiskAnalyzer{db: db}
}

func (ra *RiskAnalyzer) AssessRisk(ctx context.Context, userID uuid.UUID, reqIP, reqUserAgent, reqDeviceID string) (*RiskAssessment, error) {
	// 1. If no previous sessions exist, it's a first-time login on a new device. Considered Low/Medium risk by default.
	var count int64
	err := ra.db.Model(&database.Session{}).Where("user_id = ?", userID).Count(&count).Error
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return &RiskAssessment{
			Level:               RiskLevelLow,
			Reason:              "first time user account registration or session",
			StepUpRequired:      false,
		}, nil
	}

	// 2. Look up all active sessions to see if this DeviceID has logged in before.
	var matchingSessions []database.Session
	err = ra.db.Where("user_id = ? AND device_id = ? AND status = 'active'", userID, reqDeviceID).Find(&matchingSessions).Error
	if err != nil {
		return nil, err
	}

	// If device is already known, analyze IP or browser changes
	if len(matchingSessions) > 0 {
		knownIP := false
		knownUA := false
		for _, s := range matchingSessions {
			if s.IPAddress == reqIP {
				knownIP = true
			}
			if s.Browser == reqUserAgent {
				knownUA = true
			}
		}

		if knownIP && knownUA {
			return &RiskAssessment{
				Level:               RiskLevelLow,
				Reason:              "verified device and network profile match",
				StepUpRequired:      false,
			}, nil
		}

		// Known device but IP/UA changed (e.g. user traveling or switching networks)
		return &RiskAssessment{
			Level:               RiskLevelMedium,
			Reason:              "verified device on a new network address or browser",
			StepUpRequired:      false,
		}, nil
	}

	// 3. New device ID login.
	// Check if the login requests are from a totally new IP address that hasn't been seen anywhere in the user's login history.
	var sameIPSessions int64
	err = ra.db.Model(&database.Session{}).Where("user_id = ? AND ip_address = ?", userID, reqIP).Count(&sameIPSessions).Error
	if err != nil {
		return nil, err
	}

	if sameIPSessions > 0 {
		// New device, but from a previously verified IP address (e.g. user bought a new phone at home)
		return &RiskAssessment{
			Level:               RiskLevelMedium,
			Reason:              "new device identified on a familiar network",
			StepUpRequired:      false,
		}, nil
	}

	// Suspicious login: New Device ID AND New IP Address.
	// We require Step-Up Verification!
	reason := "suspicious login attempt: unrecognized device fingerprint and network"

	// Add location checking heuristic if headers indicate proxy/travel (simulated)
	if strings.Contains(reqUserAgent, "Bot") || strings.Contains(reqUserAgent, "Headless") {
		reason = "suspicious automated browser profile detected"
		return &RiskAssessment{
			Level:               RiskLevelHigh,
			Reason:              reason,
			StepUpRequired:      true,
		}, nil
	}

	return &RiskAssessment{
		Level:               RiskLevelHigh,
		Reason:              reason,
		StepUpRequired:      true,
	}, nil
}
