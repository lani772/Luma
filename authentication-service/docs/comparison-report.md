# Luma Authentication Service: Existing Backend Analysis & Comparison Report

This report analyzes the existing `luma-cloud-backend` architecture, identifies its architectural, security, and scalability shortcomings, and explains the improvements and design decisions incorporated into the new, independent Authentication Service.

---

## 1. Analysis of the Existing Backend (`luma-cloud-backend`)

### Existing Strengths
1. **Clear Domain Boundaries (Internal Engines):** The existing backend organizes its modules into independent "engines" (e.g., `auth`, `users`, `devices`, `mqtt`, `notifications`). This modularity provides a good separation of concerns.
2. **Unified Response Envelope:** Utilizing an `httputil.Envelope` with standard success/error indicators and machine-readable error codes helps ensure a predictable mobile client contract.
3. **Multi-Phone Sessions:** The design scopes active sessions per *phone* (via a `UserPhone` record), meaning a user can log in on multiple physical devices simultaneously without one session revoking another.
4. **Structured Logging and Request IDs:** It utilizes `slog` for structured logging, attaches a unique request ID to each context, and logs panic recoveries cleanly.

### Existing Weaknesses & Constraints
1. **Tightly-Coupled Database:** All engines share a single database, allowing cross-engine queries (e.g., Auth service checking User records directly). This violates microservice database independence.
2. **MongoDB Schemaless Constraints:** The current system uses MongoDB. While flexible, schema integrity, constraint validation, and relational integrity (foreign keys) are managed in code via manual index management (`EnsureIndexes`).
3. **Bcrypt Password Hashing:** It utilizes Bcrypt with a static default cost (10). While secure for now, Bcrypt is vulnerable to GPU-accelerated brute-force cracking compared to modern memory-hard key-derivation functions like Argon2id.
4. **Weak/Static JWT Key Strategy:** It uses symmetric key signing (HMAC-SHA256) where access and refresh tokens share a single or derived static base secret (`SESSION_SECRET`). This prevents external microservices from verifying tokens independently without possessing the shared key.
5. **No Built-In Step-Up or Adaptive Authentication:** The authentication system has a binary success/fail mechanism. It does not analyze login patterns (IPs, locations, travel velocity, devices) to request step-up confirmation on high-risk attempts.
6. **No Service-to-Service Flow:** The existing backend does not authenticate other backend microservices (e.g., device service, notification service, mqtt-service) via standard machine-to-machine paradigms (like Client Credentials).

---

## 2. Structural & Architectural Improvements in the New Authentication Service

| Feature / Dimension | Existing Backend (`luma-cloud-backend`) | New Standalone Authentication Service |
| :--- | :--- | :--- |
| **Architecture** | Single modular monolith sharing a MongoDB instance. | Independent microservice following **Clean Architecture** & **DDD**. |
| **Database** | MongoDB (Schemaless, manual constraints in code). | **PostgreSQL** (Strict relational schema, constraints, transactions). |
| **Password Hashing**| Bcrypt (CPU-bound, lower GPU-resistance). | **Argon2id** (Memory-hard, highly configurable, GPU-resistant). |
| **JWT Signing** | Symmetric (HMAC-SHA256) sharing secrets. | **Asymmetric (Ed25519 / EdDSA)** with RS256 compatibility. |
| **S2S Authentication**| No native support; shared context or roles. | **Client Credentials flow** with short-lived cryptographic tokens. |
| **Email Verification**| Simple magic link / token generation. | Configurable Policy engine (**OR, AND, MAGIC_LINK_ONLY, OTP_ONLY**). |
| **Login Security** | Direct lookup, simple status check. | **Adaptive Risk Engine** (Low/Med/High) with Step-Up verification. |
| **Event Broker** | No explicit event broker abstraction. | Abstraction layer supporting **NATS, Kafka, RabbitMQ**, & In-Memory. |
| **Database Migration**| Schema indexes created programmatically. | Hand-written SQL migrations with UUID primary keys. |

---

## 3. Rationale for Key Architectural Decisions

### Clean Architecture & DDD
By organizing the service into strictly isolated layers (Domain, Application, Infrastructure, Interfaces), we separate core authentication rules from frameworks (Gin, GORM, Redis). This ensures the core rules remain highly testable, independent of databases, and resilient to third-party updates.

### Relational PostgreSQL with GORM & Hand-Written SQL Migrations
Authentication records require strict ACID guarantees. A user registration shouldn't succeed while the credential or session tables fail. PostgreSQL provides perfect transactional support. GORM facilitates a clean repository pattern, while hand-written SQL migrations guarantee reproducible database states across dev, staging, and production.

### EdDSA (Ed25519) for Token Signing
Using EdDSA asymmetric cryptography allows the Authentication Service to sign JWTs with its private key while other ecosystem services (like the Device or Notification service) verify the signature using only the public key. This eliminates the need to expose the private signing key or make synchronous database calls (`/verify`) to validate tokens. EdDSA has smaller keys and faster signing than RS256.

### Adaptive Authentication & Risk Engine
In a modern IoT ecosystem (LUMA), brute force and credential stuffing attacks are highly prevalent. The risk engine analyzes:
- Accessing from a new device/browser (Device Fingerprint)
- A new or suspicious IP address
- Rate limit thresholds
- History of failed login attempts
When a threat is flagged (High Risk), the system does not fail outright but requests **Step-Up Authentication** via OTP or Magic Link to verify user identity, preventing account takeovers while keeping legitimate flows uninterrupted.

### Flexible Email Verification Policies
Varying legal and operational requirements across different countries demand adjustable verification flows. Financial-grade operations may require high security (**AND** policy), while simple consumer applications prefer low friction (**OR** policy). Decoupling this through environment configuration enables deployment flexibility without code refactoring.
