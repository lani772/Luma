package mqtt

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/models"
	"github.com/luma-smart-home/cloud-backend/pkg/mqttadapter"
)

const credentialTTL = 24 * 30 * time.Hour // 30 days; mobile app rotates via re-issuance

type Service struct {
	repo    *Repository
	adapter mqttadapter.Adapter
	brokerURL string
}

func NewService(repo *Repository, adapter mqttadapter.Adapter, brokerURL string) *Service {
	return &Service{repo: repo, adapter: adapter, brokerURL: brokerURL}
}

// IssueCredentials mints a broker credential scoped to exactly one device.
// The backend never hands out its own broker admin credentials — each
// device gets a distinct username/password pair tied to device_id, so
// broker-side ACLs (configured on mqtt.luma.local, outside this codebase)
// can restrict each credential to that device's own topic namespace.
func (s *Service) IssueCredentials(deviceID uuid.UUID) (*CredentialsDTO, error) {
	username := fmt.Sprintf("device-%s", deviceID.String())
	rawPassword, err := randomToken(24)
	if err != nil {
		return nil, err
	}
	hash := hashCredential(rawPassword)
	clientID := fmt.Sprintf("luma-device-%s", deviceID.String())

	now := time.Now()
	expiresAt := now.Add(credentialTTL)
	identity := &models.MQTTDeviceIdentity{
		ID:             uuid.New(),
		DeviceID:       deviceID,
		MQTTClientID:   clientID,
		MQTTUsername:   username,
		CredentialHash: hash,
		IssuedAt:       now,
		ExpiresAt:      expiresAt,
	}
	if err := s.repo.Upsert(identity); err != nil {
		return nil, fmt.Errorf("mqtt: issue credentials: %w", err)
	}

	return &CredentialsDTO{
		MQTTClientID: clientID,
		MQTTUsername: username,
		MQTTPassword: rawPassword,
		BrokerURL:    s.brokerURL,
		Topics:       TopicsForDevice(deviceID.String()),
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *Service) RevokeCredentials(deviceID uuid.UUID) error {
	return s.repo.Revoke(deviceID)
}

func (s *Service) TopicsFor(deviceID uuid.UUID) TopicsResponse {
	return TopicsResponse{DeviceID: deviceID.String(), Topics: TopicsForDevice(deviceID.String())}
}

func (s *Service) Health() mqttadapter.HealthStatus {
	return s.adapter.Health()
}

func randomToken(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashCredential(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
