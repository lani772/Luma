package automation

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

// Trigger represents an automation trigger
type Trigger struct {
	ID    string      `json:"id"`
	Type  string      `json:"type"` // time, device_state, energy, manual
	Name  string      `json:"name"`
	Value interface{} `json:"value"`
}

// Action represents an action to perform
type Action struct {
	ID       string                 `json:"id"`
	DeviceID string                 `json:"deviceId"`
	Type     string                 `json:"type"` // toggle, set_brightness, set_temp, etc
	Params   map[string]interface{} `json:"params"`
	Delay    int                    `json:"delay"` // delay in seconds
}

// Rule represents an automation rule
type Rule struct {
	ID           string      `json:"id"`
	HomeID       string      `json:"homeId"`
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	Triggers     []Trigger   `json:"triggers"`
	Conditions   []Condition `json:"conditions"`
	Actions      []Action    `json:"actions"`
	Enabled      bool        `json:"enabled"`
	ExecutionLog []Execution `json:"executionLog"`
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
}

// Condition represents a condition to check
type Condition struct {
	ID        string      `json:"id"`
	Type      string      `json:"type"` // device_state, time_range, weather, etc
	Operator  string      `json:"operator"` // equals, greater_than, less_than, etc
	Value     interface{} `json:"value"`
	Negated   bool        `json:"negated"`
}

// Execution represents a rule execution
type Execution struct {
	ID        string    `json:"id"`
	RuleID    string    `json:"ruleId"`
	Status    string    `json:"status"` // success, failed, partial
	StartTime time.Time `json:"startTime"`
	EndTime   time.Time `json:"endTime"`
	Error     string    `json:"error,omitempty"`
	Results   []string  `json:"results"`
}

// Schedule represents a scheduled task
type Schedule struct {
	ID          string    `json:"id"`
	HomeID      string    `json:"homeId"`
	Name        string    `json:"name"`
	CronExpression string `json:"cronExpression"` // e.g. "0 22 * * *" for 10 PM daily
	RuleID      string    `json:"ruleId"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// AutomationEngine handles automation and scheduling
type AutomationEngine struct {
	rules       map[string]*Rule
	schedules   map[string]*Schedule
	cron        *cron.Cron
	executors   map[string]cron.EntryID
	mu          sync.RWMutex
	actionQueue chan *queuedAction
	done        chan bool
}

type queuedAction struct {
	rule   *Rule
	action Action
	delay  time.Duration
}

// NewAutomationEngine creates a new automation engine
func NewAutomationEngine() *AutomationEngine {
	return &AutomationEngine{
		rules:     make(map[string]*Rule),
		schedules: make(map[string]*Schedule),
		cron:      cron.New(),
		executors: make(map[string]cron.EntryID),
		actionQueue: make(chan *queuedAction, 1000),
		done:      make(chan bool),
	}
}

// CreateRule creates a new automation rule
func (ae *AutomationEngine) CreateRule(homeID, name, description string, triggers []Trigger, conditions []Condition, actions []Action) *Rule {
	rule := &Rule{
		ID:          uuid.New().String(),
		HomeID:      homeID,
		Name:        name,
		Description: description,
		Triggers:    triggers,
		Conditions:  conditions,
		Actions:     actions,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	ae.mu.Lock()
	defer ae.mu.Unlock()
	ae.rules[rule.ID] = rule

	log.Printf("Automation rule created: %s (%s)", rule.Name, rule.ID)
	return rule
}

// UpdateRule updates an existing rule
func (ae *AutomationEngine) UpdateRule(ruleID string, updates map[string]interface{}) (*Rule, error) {
	ae.mu.Lock()
	rule, exists := ae.rules[ruleID]
	ae.mu.Unlock()

	if !exists {
		return nil, fmt.Errorf("rule not found")
	}

	if name, ok := updates["name"].(string); ok {
		rule.Name = name
	}
	if description, ok := updates["description"].(string); ok {
		rule.Description = description
	}
	if enabled, ok := updates["enabled"].(bool); ok {
		rule.Enabled = enabled
	}

	rule.UpdatedAt = time.Now()

	ae.mu.Lock()
	ae.rules[ruleID] = rule
	ae.mu.Unlock()

	return rule, nil
}

// DeleteRule deletes a rule
func (ae *AutomationEngine) DeleteRule(ruleID string) error {
	ae.mu.Lock()
	defer ae.mu.Unlock()

	if _, exists := ae.rules[ruleID]; !exists {
		return fmt.Errorf("rule not found")
	}

	delete(ae.rules, ruleID)
	log.Printf("Automation rule deleted: %s", ruleID)
	return nil
}

// CreateSchedule creates a new schedule
func (ae *AutomationEngine) CreateSchedule(homeID, name, cronExpression, ruleID string) (*Schedule, error) {
	schedule := &Schedule{
		ID:             uuid.New().String(),
		HomeID:         homeID,
		Name:           name,
		CronExpression: cronExpression,
		RuleID:         ruleID,
		Enabled:        true,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	// Validate cron expression
	_, err := cron.ParseStandard(cronExpression)
	if err != nil {
		return nil, fmt.Errorf("invalid cron expression: %v", err)
	}

	ae.mu.Lock()
	defer ae.mu.Unlock()

	ae.schedules[schedule.ID] = schedule

	// Start the schedule
	ae.startSchedule(schedule)

	log.Printf("Schedule created: %s (%s) - %s", schedule.Name, schedule.ID, cronExpression)
	return schedule, nil
}

// ExecuteRule executes an automation rule
func (ae *AutomationEngine) ExecuteRule(ruleID string) (*Execution, error) {
	ae.mu.RLock()
	rule, exists := ae.rules[ruleID]
	ae.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("rule not found")
	}

	if !rule.Enabled {
		return nil, fmt.Errorf("rule is disabled")
	}

	execution := &Execution{
		ID:        uuid.New().String(),
		RuleID:    ruleID,
		Status:    "success",
		StartTime: time.Now(),
		Results:   []string{},
	}

	// Execute each action
	for _, action := range rule.Actions {
		if action.Delay > 0 {
			qa := &queuedAction{
				rule:   rule,
				action: action,
				delay:  time.Duration(action.Delay) * time.Second,
			}
			ae.actionQueue <- qa
		} else {
			// Execute immediately
			result := ae.executeAction(&action)
			execution.Results = append(execution.Results, result)
		}
	}

	execution.EndTime = time.Now()

	// Log execution
	ae.mu.Lock()
	if len(rule.ExecutionLog) > 100 {
		rule.ExecutionLog = rule.ExecutionLog[1:]
	}
	rule.ExecutionLog = append(rule.ExecutionLog, *execution)
	ae.mu.Unlock()

	return execution, nil
}

// GetRule gets a rule by ID
func (ae *AutomationEngine) GetRule(ruleID string) (*Rule, error) {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	rule, exists := ae.rules[ruleID]
	if !exists {
		return nil, fmt.Errorf("rule not found")
	}

	return rule, nil
}

// GetRulesByHome gets all rules for a home
func (ae *AutomationEngine) GetRulesByHome(homeID string) []*Rule {
	ae.mu.RLock()
	defer ae.mu.RUnlock()

	var rules []*Rule
	for _, rule := range ae.rules {
		if rule.HomeID == homeID {
			rules = append(rules, rule)
		}
	}

	return rules
}

// Start starts the automation engine
func (ae *AutomationEngine) Start() {
	ae.cron.Start()

	// Start action processor
	go func() {
		for {
			select {
			case qa := <-ae.actionQueue:
				time.Sleep(qa.delay)
				result := ae.executeAction(&qa.action)
				log.Printf("Delayed action executed: %s - %s", qa.action.ID, result)

			case <-ae.done:
				return
			}
		}
	}()

	log.Println("Automation engine started")
}

// Stop stops the automation engine
func (ae *AutomationEngine) Stop() {
	ae.cron.Stop()
	close(ae.done)
	log.Println("Automation engine stopped")
}

// Helper functions

func (ae *AutomationEngine) startSchedule(schedule *Schedule) {
	rule, exists := ae.rules[schedule.RuleID]
	if !exists {
		return
	}

	_, err := ae.cron.AddFunc(schedule.CronExpression, func() {
		if schedule.Enabled {
			ae.ExecuteRule(rule.ID)
		}
	})

	if err != nil {
		log.Printf("Failed to start schedule: %v", err)
	}
}

func (ae *AutomationEngine) executeAction(action *Action) string {
	// This would integrate with device control
	// For now, return a simulated result
	actionType := action.Type
	switch actionType {
	case "toggle":
		return fmt.Sprintf("Toggled device %s", action.DeviceID)
	case "set_brightness":
		brightness := action.Params["brightness"]
		return fmt.Sprintf("Set brightness to %v on device %s", brightness, action.DeviceID)
	case "set_temp":
		temp := action.Params["temperature"]
		return fmt.Sprintf("Set temperature to %v on device %s", temp, action.DeviceID)
	default:
		return fmt.Sprintf("Executed action %s on device %s", actionType, action.DeviceID)
	}
}

// CheckConditions checks if all conditions are met
func (ae *AutomationEngine) CheckConditions(conditions []Condition) bool {
	for _, condition := range conditions {
		if !ae.checkCondition(&condition) {
			return false
		}
	}
	return true
}

// checkCondition checks a single condition
func (ae *AutomationEngine) checkCondition(condition *Condition) bool {
	// Implementation would check actual device states, time, weather, etc
	result := false

	switch condition.Type {
	case "time_range":
		// Check if current time is in range
		result = true // Simplified
	case "device_state":
		// Check device state
		result = true // Simplified
	case "energy":
		// Check energy consumption
		result = true // Simplified
	}

	if condition.Negated {
		result = !result
	}

	return result
}
