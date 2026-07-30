# LUMA User Access Management Service (UAMS)

## Purpose

The LUMA User Access Management Service (UAMS) is a fully independent service responsible for handling authorization, permissions, resource sharing, microcontroller/controller ownership, and synchronization.

While the Authentication Service answers **"Who is this user?"**, UAMS answers **"What resources can this user access, and what specific actions can they perform?"**. UAMS maintains a clean, secure boundaries with zero hardware-sensitive details leaked to non-owners.

## Core Modules

1. **Role Management (Module 7)**: Supports microcontroller-scoped roles (`owner`, `administrator`, `operator`, `viewer`). Replaces coarse device admin flags with single-ownership authority.
2. **Permission Management (Module 8)**: Implements hierarchical resource-scoped detailed rules (`microcontroller` -> `home` -> `room` -> `device` -> `feature`) supporting temporary actions, expirations, and inheritance (e.g. room-level implies device control unless overridden).
3. **Permission Key Management (Module 9)**: Manages cryptographically secure random token keys (64 bytes generated, SHA-256 hashed at rest) used by physical controllers and mobile core engines.
4. **Invitation Management (Module 10)**: Facilitates secure, WhatsApp-style invitations for resource sharing with automatic role/permission/key provisioning upon acceptance.
5. **Access Request Management (Module 11)**: Enables requester-initiated access request workflows, presenting rich safe verified profiles to owners while fully masking system secrets.
6. **Ownership Management (Module 13)**: Enforces unique microcontroller ownership through a robust, secure two-step transfer request and accept/reject workflow.
7. **Permission Synchronization (Module 12)**: Automatically records changes on the standard `cloud_sync_records` schema so clients immediately pull authorization updates when they reconnect.
8. **Resource Visibility Security (Module 8 - Rule)**: Custom serialization layer that fully protects hardware secrets (MAC, GPIOs, firmware configs, MQTT topics) from non-owners.

---

## Technical Stack & Architecture

- **Runtime**: Go 1.25.5
- **API Framework**: Gin
- **Database**: MongoDB (completely schema-less collection wiring)
- **Design Pattern**: Clean Architecture (decoupled interfaces, modular package isolation)

### Folder Hierarchy
```
user-access-management-service/
├── cmd/
│   └── server/                    # App entrypoint & composition root
├── internal/
│   ├── database/                  # DB connection and idempotent index creation
│   ├── middleware/                # JWT verification (shared secret)
│   ├── httputil/                  # Shared JSON response envelopes
│   ├── events/                    # Event-driven publishers
│   ├── workers/                   # Background routines (temporary permission cleanup)
│   └── modules/                   # Independent modules (Clean Architecture)
│       ├── roles/
│       ├── permissions/
│       ├── permission_keys/
│       ├── invitations/
│       ├── access_requests/
│       ├── ownership/
│       ├── sync/
│       └── resource_visibility/
├── docs/                          # OpenAPI 3.0.3 specification
├── tests/                         # Full workflow and service unit tests
├── Dockerfile                     # Multi-stage production container build
├── docker-compose.yml             # Single-command environment runner
└── README.md                      # Documentation
```

---

## REST API Reference

All routes are nested under `/api/v1` and require a valid Bearer JWT.

### Roles
- `POST /api/v1/roles/assign` - Assign a role to a user.
- `GET /api/v1/roles` - Query role assignments.
- `PATCH /api/v1/roles/:id` - Update a role.
- `DELETE /api/v1/roles/:id` - Remove a role.

### Permissions
- `POST /api/v1/permissions/grant` - Grant a specific custom permission (supports temporary bounds).
- `POST /api/v1/permissions/check` - Enforce permission action checks.
- `GET /api/v1/permissions` - Query existing permissions.
- `DELETE /api/v1/permissions/:id` - Revoke permission.

### Invitations
- `POST /api/v1/invitations` - Create a pending sharing invitation.
- `GET /api/v1/invitations` - Query invitations.
- `POST /api/v1/invitations/:id/accept` - Accept invitation (auto-provisions roles/permissions/keys/syncs).
- `POST /api/v1/invitations/:id/reject` - Reject invitation.

### Access Requests
- `POST /api/v1/access-requests` - Request access to a resource.
- `GET /api/v1/access-requests` - List access requests (displays requester's safe profile).
- `POST /api/v1/access-requests/:id/approve` - Approve request (auto-provisions roles/permissions/keys/syncs).
- `POST /api/v1/access-requests/:id/reject` - Reject request.

### Ownership
- `POST /api/v1/ownership/request` - Initiate ownership transfer to a new owner email.
- `POST /api/v1/ownership/accept` - Accept ownership (reassigns owner, rotates old keys, demotes old owner).
- `POST /api/v1/ownership/reject` - Reject ownership.

---

## Local Development & Testing

### How to Run Locally

1. Set up environmental variables:
   ```bash
   export PORT=8095
   export MONGODB_URI=mongodb://localhost:27017/luma
   export SESSION_SECRET=my-shared-secret
   ```
2. Start the service:
   ```bash
   go run ./cmd/server/main.go
   ```

### Run with Docker Compose
```bash
docker compose up --build
```

### Run Tests
To run the automated mock workflow unit/integration test suite:
```bash
go test ./...
```
