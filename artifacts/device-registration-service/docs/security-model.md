# DRDMS Security Model

## Hardware Protection Rule

The system implements strict field-level access controls for physical parameters to prevent malicious control hijacking or cloning:

1. **Owner-Level / Admin-Level View**:
   - Authorized callers (the owner or administrators with delegated permissions) can view sensitive values:
     - `mac_address`
     - `chip_id`
     - `gpio_mappings`
     - `device_secrets`
     - `mqtt_credentials`
     - `network_credentials`
2. **Standard / Guest User View**:
   - Guests or members see only a simplified logical interface:
     - Logical `resource` definitions (e.g. "Lamp 1", "Bedroom Fan")
     - Available `capabilities` (e.g. Turn ON/OFF, adjust speed)
     - Online / Offline status
   - Under no circumstances will raw GPIO pins, secrets, or certificates be serialized in a public DTO.

## Security Controls

### 1. AES-256-GCM Encryption at Rest
- Raw device secrets, passwords, certificates, and WiFi configuration parameters are encrypted inside GORM before writing to the PostgreSQL database.
- A 32-byte key is read from the `DEVICE_ENCRYPTION_KEY` environment variable.
- Nonce size is 12 bytes.
- Format inside DB: `key_version:nonce_hex:encrypted_hex`.

### 2. SHA-256 Hashing of API Keys
- API keys used by microcontrollers for direct REST validation are stored as SHA-256 hashes inside the database.
- When authenticating a microcontroller request:
  - Extract header `X-LUMA-Device-Key`.
  - Hash it with SHA-256.
  - Query DB by the hash to authenticate.

### 3. JWT Token Validation (RS256)
- User authentication header parsed as `Bearer <token>`.
- Public Key verification: DRDMS decodes and verifies user identity using the Auth Service's RS256/Ed25519 signature. No direct DB connection to the Authentication service database is required.
