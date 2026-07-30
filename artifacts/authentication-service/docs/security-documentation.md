# LUMA Authentication Service: Security hardening Guide

This document describes the cryptographic principles, risk mitigation layers, and security defenses implemented in the standalone Authentication Service to protect the LUMA ecosystem against common attack vectors.

---

## 1. Cryptographic Safeguards

### Argon2id Password Hashing
All user and service secrets are hashed with **Argon2id** (the winner of the Password Hashing Competition), configured with:
- `m` (Memory): 64MB
- `t` (Iterations): 3
- `p` (Parallelism): 2
This ensures strong hardware resistance against custom ASIC and GPU-accelerated brute-force attacks while remaining lightweight for single login transactions.

### Asymmetric JWT Verification (EdDSA)
The service utilizes **Ed25519 (EdDSA)** to issue identity tokens:
- **Private Key:** Stored strictly inside the Authentication Service. Used to cryptographically sign Issued access tokens.
- **Public Key:** Shared with other LUMA services (Device service, Notification service, MQTT service).
Other backend services verify user identities autonomously without calling the `/verify` endpoint, eliminating database lookups and bottlenecks.

---

## 2. Advanced Defenses

### Brute-Force and Credential Stuffing Prevention
The lockout system monitors failures by IP address and User Email. If more than 5 failed login attempts occur within 15 minutes, the account/IP is locked automatically for 15 minutes. This rate limit threshold is fully configurable using Viper.

### Session Revocation Blacklist (Fast Redis-Backed Cache)
To support instantaneous revocation (such as globally logging out or resetting passwords), revoked session IDs are stored in a Redis high-speed blacklist cache. Every API Gateway or authenticating route checks the Redis blacklist first, preventing stolen JWTs from remaining valid during their remaining TTL.

### Mitigation of Identity Enumeration Attacks
API endpoints (such as `POST /auth/password/forgot` and `POST /auth/login` under invalid profiles) return generic, indistinguishable responses. This prevents attackers from enumerating valid registered email addresses.

### Suspicious Travel / Impossible Velocity Detection
The adaptive risk engine analyzes login attempts from unrecognized device fingerprints occurring on foreign networks. If marked high risk, step-up MFA is enforced before a session is granted.
