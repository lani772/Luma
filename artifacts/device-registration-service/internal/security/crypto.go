package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// AESGCMEncryptor handles AES-256-GCM encryption and decryption of hardware secrets at rest
type AESGCMEncryptor interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(ciphertext string) (string, error)
}

type aesGCMEncryptor struct {
	key []byte
}

func NewAESGCMEncryptor() (AESGCMEncryptor, error) {
	keyStr := os.Getenv("DEVICE_ENCRYPTION_KEY")
	if keyStr == "" {
		// Use a stable key fallback for local testing/environments if not configured
		keyStr = "12345678901234567890123456789012"
	}
	key := []byte(keyStr)
	if len(key) != 32 {
		return nil, fmt.Errorf("encryption: key must be exactly 32 bytes (256 bits), got %d", len(key))
	}
	return &aesGCMEncryptor{key: key}, nil
}

func (e *aesGCMEncryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	// Output structure: version:nonce:ciphertext
	return fmt.Sprintf("1:%s:%s", hex.EncodeToString(nonce), hex.EncodeToString(ciphertext[gcm.NonceSize():])), nil
}

func (e *aesGCMEncryptor) Decrypt(cipherTextStr string) (string, error) {
	parts := strings.Split(cipherTextStr, ":")
	if len(parts) != 3 {
		return "", errors.New("invalid ciphertext format")
	}
	nonceBytes, err := hex.DecodeString(parts[1])
	if err != nil {
		return "", err
	}
	ciphertextBytes, err := hex.DecodeString(parts[2])
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(nonceBytes) != gcm.NonceSize() {
		return "", errors.New("invalid nonce size")
	}
	plaintext, err := gcm.Open(nil, nonceBytes, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// HashAPIKey returns a SHA-256 hash of the device's API Key
func HashAPIKey(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

// GenerateRandomSecret creates highly secure cryptographically-secure opaque strings
func GenerateRandomSecret(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := io.ReadFull(rand.Reader, bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
