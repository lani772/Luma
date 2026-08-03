package ai

import (
	"context"
	"regexp"
	"strconv"
)

// Provider matches natural language assistant prompt demands to logical resources
type Provider interface {
	ParseLayoutPrompt(ctx context.Context, prompt string) (map[string]interface{}, error)
}

type mockAIProvider struct{}

func NewMockAIProvider() Provider {
	return &mockAIProvider{}
}

func (p *mockAIProvider) ParseLayoutPrompt(ctx context.Context, prompt string) (map[string]interface{}, error) {
	// Simple rule-based regex parsing of natural language prompts for local test stability
	// "Create ESP32 controller with 6 lamps, 2 fans and temperature sensor"
	lamps := 1
	fans := 0
	sensors := 0

	reLamps := regexp.MustCompile(`(\d+)\s+lamp`)
	if match := reLamps.FindStringSubmatch(prompt); len(match) > 1 {
		lamps, _ = strconv.Atoi(match[1])
	}

	reFans := regexp.MustCompile(`(\d+)\s+fan`)
	if match := reFans.FindStringSubmatch(prompt); len(match) > 1 {
		fans, _ = strconv.Atoi(match[1])
	}

	reSensors := regexp.MustCompile(`(\d+)\s+sensor`)
	if match := reSensors.FindStringSubmatch(prompt); len(match) > 1 {
		sensors, _ = strconv.Atoi(match[1])
	} else {
		// handle singular "temperature sensor"
		reTemp := regexp.MustCompile(`temperature sensor`)
		if reTemp.MatchString(prompt) {
			sensors = 1
		}
	}

	resources := []map[string]interface{}{}
	currentPin := 15

	for i := 1; i <= lamps; i++ {
		resources = append(resources, map[string]interface{}{
			"name":          "Lamp " + strconv.Itoa(i),
			"resource_type": "lamp",
			"gpio":          currentPin,
		})
		currentPin++
	}

	for i := 1; i <= fans; i++ {
		resources = append(resources, map[string]interface{}{
			"name":          "Fan " + strconv.Itoa(i),
			"resource_type": "fan",
			"gpio":          currentPin,
		})
		currentPin++
	}

	for i := 1; i <= sensors; i++ {
		resources = append(resources, map[string]interface{}{
			"name":          "Temperature Sensor",
			"resource_type": "sensor",
			"gpio":          currentPin,
		})
		currentPin++
	}

	blueprint := map[string]interface{}{
		"resources": resources,
	}

	return blueprint, nil
}
