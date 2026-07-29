# Luma Authentication Service: System Design Specification

This document details the production-ready system design for the standalone Authentication Service designed for the LUMA ecosystem.

---

## 1. Requirements

### Functional Requirements
1. **User Account Management:** Register, log in, log out, profile retrieval, account activation, deactivation, and soft/hard deletion.
2. **Login System:** Support traditional Email + Password, Magic Link, OTP (6-digit, rate-limited), and Google Sign-In (OpenID Connect flow).
3. **Adaptive Login Security:** Threat detection on login attempts classifying risk as Low, Medium, or High, triggering step-up verification for High Risk.
4. **Email Verification:** Flexible policy-driven verification supporting `OR` (default), `AND`, `MAGIC_LINK_ONLY`, and `OTP_ONLY` with independent status tracking.
5. **Password Management:** Reset workflow via Magic Link or OTP. Old sessions must be invalidated upon password reset.
6. **Session Management:** Support for multi-device login, active session enumeration, and targeted or global session revocation.
7. **Service-to-Service Authentication:** Issue short-lived cryptographic service tokens using Client Credentials (Client ID + Client Secret) to identify trusted internal services.

### Non-Functional Requirements
1. **Performance:** Under 50ms average response time for normal API endpoints, excluding Argon2id hashing overhead.
2. **Scalability:** Horizontal scaling of instances; database reads offloaded to Redis caching where applicable.
3. **Security:** Zero plaintext password storage (Argon2id), asymmetric JWT signing (Ed25519/EdDSA), and strict IP/email rate limiting (Redis-backed).
4. **Resilience:** Fallbacks for third-party systems (such as SMTP to stdout/mock provider) to prevent service startup blocking.
5. **Observability:** Prometheus metrics exported on `/metrics` and OpenTelemetry tracing spans embedded in database and service boundaries.

---

## 2. API Specifications

### Public Endpoints
- **POST /auth/register**
  Registers a new user account.
- **POST /auth/login**
  Authenticates user via password, Google ID token, OTP, or Magic Link. Performs risk analysis. Returns step-up details if High Risk.
- **POST /auth/logout**
  Invalidates current session and revokes refresh tokens.
- **POST /auth/refresh**
  Rotates refresh token and returns a new access/refresh pair.
- **POST /auth/email/send**
  Sends an OTP and/or Magic Link depending on the verification policy.
- **POST /auth/email/verify**
  Validates an OTP or Magic Link token.
- **POST /auth/password/forgot**
  Initiates a password reset flow, generating a reset token.
- **POST /auth/password/reset**
  Validates a reset token and updates the password.
- **POST /auth/google/login**
  Exchanges/authenticates a Google ID Token, links or creates an account, and issues local JWTs.
- **GET /auth/me**
  Returns details of the currently authenticated user.

### Internal Endpoints
- **POST /internal/token/verify**
  Validates a user access token and returns payload details (for legacy/dumb gateways).
- **POST /internal/token/introspect**
  Performs full introspection on an active user token including database blacklist check.
- **POST /internal/service/token**
  Mints a service token using `client_id` and `client_secret`.
- **POST /internal/service/verify**
  Validates a service token cryptographically.
- **POST /internal/session/revoke**
  Direct session revocation requested by internal components.
- **GET /internal/users/{id}**
  Fetches standard user profiles by ID for external services.

---

## 3. Database Schema Design

We use PostgreSQL for strict ACID compliance, relational integrity, foreign keys, and indexes.

### Entity Relationship & Tables

```
+-----------------------------------------------------------------+
| users                                                           |
+-----------------------------------------------------------------+
| id (UUID, PK)                                                   |
| email (VARCHAR, UNIQUE, NOT NULL)                               |
| username (VARCHAR, UNIQUE, NULL)                                |
| password_hash (VARCHAR, NOT NULL)                               |
| status (VARCHAR, NOT NULL) -- active, suspended, deleted        |
| email_verified (BOOLEAN, DEFAULT FALSE)                        |
| phone (VARCHAR, NULL)                                           |
| phone_verified (BOOLEAN, DEFAULT FALSE)                        |
| created_at (TIMESTAMP)                                          |
| updated_at (TIMESTAMP)                                          |
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
| sessions                                                        |
+-----------------------------------------------------------------+
| id (UUID, PK)                                                   |
| user_id (UUID, FK -> users)                                     |
| device_id (VARCHAR, NOT NULL)                                   |
| ip_address (VARCHAR, NOT NULL)                                  |
| browser (VARCHAR, NULL)                                         |
| location (VARCHAR, NULL)                                        |
| expires_at (TIMESTAMP)                                          |
| last_activity (TIMESTAMP)                                       |
| status (VARCHAR) -- active, revoked                             |
| created_at (TIMESTAMP)                                          |
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
| refresh_tokens                                                  |
+-----------------------------------------------------------------+
| id (UUID, PK)                                                   |
| session_id (UUID, FK -> sessions)                               |
| token_hash (VARCHAR, UNIQUE, NOT NULL)                          |
| expires_at (TIMESTAMP)                                          |
| revoked (BOOLEAN, DEFAULT FALSE)                                |
| created_at (TIMESTAMP)                                          |
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
| oauth_accounts                                                  |
+-----------------------------------------------------------------+
| id (UUID, PK)                                                   |
| user_id (UUID, FK -> users)                                     |
| provider (VARCHAR, NOT NULL) -- e.g. google                     |
| provider_user_id (VARCHAR, NOT NULL)                            |
| email (VARCHAR, NOT NULL)                                       |
| created_at (TIMESTAMP)                                          |
| CONSTRAINT unique_provider_user UNIQUE(provider, provider_user_id)|
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
| service_accounts                                                |
+-----------------------------------------------------------------+
| id (UUID, PK)                                                   |
| service_name (VARCHAR, NOT NULL)                                |
| client_id (VARCHAR, UNIQUE, NOT NULL)                           |
| client_secret_hash (VARCHAR, NOT NULL)                          |
| status (VARCHAR) -- active, suspended                           |
| created_at (TIMESTAMP)                                          |
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
| email_verifications                                             |
+-----------------------------------------------------------------+
| id (UUID, PK)                                                   |
| user_id (UUID, FK -> users)                                     |
| magic_link_hash (VARCHAR, UNIQUE, NULL)                         |
| magic_link_expires (TIMESTAMP, NULL)                            |
| magic_link_verified (BOOLEAN, DEFAULT FALSE)                    |
| otp_code_hash (VARCHAR, NULL)                                   |
| otp_expires (TIMESTAMP, NULL)                                   |
| otp_verified (BOOLEAN, DEFAULT FALSE)                           |
| otp_attempts (INT, DEFAULT 0)                                   |
| created_at (TIMESTAMP)                                          |
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
| password_reset_tokens                                           |
+-----------------------------------------------------------------+
| id (UUID, PK)                                                   |
| user_id (UUID, FK -> users)                                     |
| token_hash (VARCHAR, UNIQUE, NOT NULL)                          |
| expires_at (TIMESTAMP)                                          |
| used (BOOLEAN, DEFAULT FALSE)                                   |
| created_at (TIMESTAMP)                                          |
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
| audit_logs                                                      |
+-----------------------------------------------------------------+
| id (UUID, PK)                                                   |
| user_id (UUID, FK -> users, NULL)                               |
| event_type (VARCHAR, NOT NULL)                                  |
| description (TEXT)                                              |
| ip_address (VARCHAR)                                            |
| user_agent (VARCHAR)                                            |
| created_at (TIMESTAMP)                                          |
+-----------------------------------------------------------------+
```

---

## 4. Workflows & Sequence Diagrams

### Adaptive Secure Login Workflow

```
Client                     Auth Service                    Risk Engine
  |                             |                              |
  |--- POST /auth/login ------->|                              |
  |    (email, password, dev)   |                              |
  |                             |--- Analyze parameters ------>|
  |                             |<-- Returns Risk Level -------|
  |                             |    (Low, Medium, High)       |
  |                             |                              |
  |                             |--[If High Risk]------------->|
  |                             |  - Generate OTP / Magic Link |
  |                             |  - Send to verified email    |
  |                             |                              |
  |<-- 202 Accepted ------------|                              |
  |    {step_up_required: true} |                              |
  |                             |                              |
```

### Email Verification with Customizable Policies

The configuration variable `EMAIL_VERIFICATION_MODE` controls verification logic.

- **OR Mode:** Successful validation of either OTP or Magic Link triggers `email_verified = true`.
- **AND Mode:** Both `magic_link_verified` and `otp_verified` must equal `true`.
- **MAGIC_LINK_ONLY:** Only the Magic Link token triggers verification.
- **OTP_ONLY:** Only the 6-digit OTP code triggers verification.

---

## 5. Security Architecture

### Argon2id Settings
Our hashing system uses Argon2id parameters optimized to balance security and responsiveness:
- `Memory`: 64MB (65536 KB)
- `Iterations`: 3
- `Parallelism`: 2
- `Salt Length`: 16 bytes
- `Key Length`: 32 bytes

### Asymmetric Cryptography (EdDSA)
Access tokens are signed using the private key component of an Ed25519 keypair. This algorithm yields shorter signatures and provides robust cryptographic protection against quantum and traditional mathematical exploits.

### Redis Blacklist
To ensure instant token revocation on logout or password reset, session IDs associated with the revoked tokens are cached in Redis with a Time-To-Live (TTL) matching the duration of the Access Token expiration. The gateway checks this high-speed cache before accepting requests.

---

## 6. Observability & Monitoring

1. **Prometheus Metrics:**
   - `auth_login_attempts_total{status="success|failed|step_up"}`
   - `auth_registration_total`
   - `auth_token_rotation_total`
   - `auth_risk_assessment_total{level="low|medium|high"}`
2. **OpenTelemetry Tracing:**
   - Standard integration with HTTP request handlers and GORM DB queries.
