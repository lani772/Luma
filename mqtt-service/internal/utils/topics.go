package utils

import (
	"fmt"
	"regexp"
)

var (
	deviceTopicRegex = regexp.MustCompile(`^luma/device/([^/]+)/([^/]+)$`)
)

type TopicInfo struct {
	DeviceID string
	Type     string
}

func ParseDeviceTopic(topic string) (*TopicInfo, error) {
	matches := deviceTopicRegex.FindStringSubmatch(topic)
	if len(matches) != 3 {
		return nil, fmt.Errorf("invalid device topic format: %s", topic)
	}
	return &TopicInfo{
		DeviceID: matches[1],
		Type:     matches[2],
	}, nil
}

func BuildDeviceTopic(deviceID string, topicType string) string {
	return fmt.Sprintf("luma/device/%s/%s", deviceID, topicType)
}

func ValidateTopic(topic string) bool {
	if topic == "" {
		return false
	}
	// Matches either device topics, system broadcasts, or notifications
	matched := deviceTopicRegex.MatchString(topic)
	if matched {
		return true
	}
	systemBroadcastRegex := regexp.MustCompile(`^luma/system/broadcast$`)
	userNotificationRegex := regexp.MustCompile(`^luma/user/([^/]+)/notification$`)
	return systemBroadcastRegex.MatchString(topic) || userNotificationRegex.MatchString(topic)
}
