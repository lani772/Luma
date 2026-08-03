# LUMA User Access Management Service (UAMS)
## Phase 10 — Architecture & Engineering Guide

This guide describes the Clean Architecture design, code organization patterns, and domain interactions inside UAMS.

### 1. Structural Paradigm & Domain Flow

UAMS is engineered as a highly-decoupled, independent service that communicates with external systems strictly through REST APIs, gRPC internal contracts, and sync records.

Each module within `internal/modules/` adheres to a strict layered structure:

```
module/
├── domain/                  # Bounded context truth
│   └── entities/            # Pure domain structs with zero external imports
├── repository/              # Data persistence (implements interfaces for mockability)
├── service/                 # Core use cases (orchestrates validation, state transitions)
├── handler/                 # HTTP layer (JSON binding, response formatting)
├── routes/                  # Route registration mappings
└── dto/                     # Data transfer objects for network payloads
```

### 2. Dependency Injection & Cyclic Prevention
Dependencies (such as roles, permissions, and keys) are injected exclusively via interfaces. For example:
- `invitations.Service` does not import `roles.Service` directly; instead, it consumes a `RoleAssigner` interface, which is satisfied by `roles.Service` during dependency wiring in `cmd/server/main.go`.
- This interface-based inversion of control completely eliminates circular package references, enabling safe compile-time correctness.

### 3. Synchronization & State Reconciliation Loop
To support offline operation (e.g. users losing internet connection), any change to roles, permissions, keys, or invitations automatically logs a serialized version-incremented state record inside `cloud_sync_records`. When clients reconnect, they request a `/cloud/sync/pull` since their last known version number, bringing their local cache immediately up to date.
