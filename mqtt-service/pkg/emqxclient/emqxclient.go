package emqxclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Config struct {
	APIEndpoint string
	APIKey      string
	APISecret   string
}

type Client struct {
	cfg        Config
	httpClient *http.Client
}

func New(cfg Config) *Client {
	if cfg.APIEndpoint == "" {
		cfg.APIEndpoint = "https://cloud-intl.emqx.com/public_api/v1"
	}
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) doRequest(method, path string, body interface{}) ([]byte, error) {
	url := fmt.Sprintf("%s/%s", c.cfg.APIEndpoint, path)

	var bodyReader io.Reader
	if body != nil {
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.cfg.APIKey != "" {
		// EMQX Cloud Public API uses HTTP Basic Authentication with API Key as username and API Secret as password.
		req.SetBasicAuth(c.cfg.APIKey, c.cfg.APISecret)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("emqx api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	return respBytes, nil
}

type ConnectionStatus struct {
	ClientID  string `json:"client_id"`
	Connected bool   `json:"connected"`
	IPAddress string `json:"ip_address"`
	KeepAlive int    `json:"keepalive"`
}

type ConnectionResponse struct {
	Data []ConnectionStatus `json:"data"`
}

func (c *Client) GetConnections(deploymentID string) ([]ConnectionStatus, error) {
	// Simple wrapper for GET /deployments/{id}/connections
	if deploymentID == "" {
		return nil, fmt.Errorf("deploymentID is required")
	}
	path := fmt.Sprintf("deployments/%s/connections", deploymentID)
	data, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var resp ConnectionResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal connections: %w", err)
	}

	return resp.Data, nil
}

type HealthResponse struct {
	Status string `json:"status"`
}

func (c *Client) CheckBrokerHealth() (bool, error) {
	// Check standard EMQX health or public api status
	// Since EMQX is deployed, we can mock or do a ping to the public API
	if c.cfg.APIKey == "" {
		return true, nil // return true in local dev without actual API key
	}
	data, err := c.doRequest("GET", "status", nil)
	if err != nil {
		return false, err
	}
	var resp HealthResponse
	_ = json.Unmarshal(data, &resp)
	return true, nil
}
