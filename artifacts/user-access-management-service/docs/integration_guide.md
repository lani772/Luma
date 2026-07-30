# LUMA User Access Management Service (UAMS)
## Integration & Interface Control Document

This document defines the interface boundaries, inter-service contracts, and integration pathways between UAMS and external LUMA services.

### 1. Integration Scope

```
┌───────────────────────┐          ┌───────────────┐
│  Authentication Svc   │ ◄─────── │   UAMS API    │
│  (Validates identity) │  (Bearer)│ (Authorization│
└───────────────────────┘          │    Gateway)   │
                                   └───────┬───────┘
                                           │ (Sync records)
                                           ▼
                                   ┌───────────────┐
                                   │  Cloud Sync   │
                                   │  (Pull/Push)  │
                                   └───────────────┘
```

* **Authentication Service**: Handled over shared `SESSION_SECRET` JWT signatures. UAMS validates that requests contain a valid bearer token signed by the shared secret, parsing the `sub`, `sid`, and global `role`.
* **User Management Service**: Queried over REST or inter-service bridges to fetch verified user profile data (e.g. email, full name, phone verification status) when owners review pending sharing requests.
* **Device Registration Service**: Coordinates microcontroller onboarding. Once a microcontroller is registered, an automatic callback or event registers the owner role in UAMS (`owner_id`), generating associated owner permissions and keys.
* **Synchronization Service**: Direct database-level or event-driven alignment on the `cloud_sync_records` schema. UAMS updates sync records with version increments, enabling mobile clients to pull permissions seamlessly.

---

### 2. Service Contracts (gRPC and REST)

For high-performance, internal inter-service checks (such as physical device command validation or API gateway routing), UAMS defines a protobuf contract:

```proto
syntax = "proto3";

package uams.v1;

service AuthorizationService {
  rpc CheckPermission(CheckPermissionRequest) returns (CheckPermissionResponse);
  rpc ValidatePermissionKey(ValidateKeyRequest) returns (ValidateKeyResponse);
}

message CheckPermissionRequest {
  string user_id = 1;
  string microcontroller_id = 2;
  string resource_id = 3;
  string resource_type = 4;
  string action = 5;
}

message CheckPermissionResponse {
  bool allowed = 1;
  string reason = 2;
}

message ValidateKeyRequest {
  string key = 1;
  string resource_id = 2;
}

message ValidateKeyResponse {
  bool valid = 1;
  string user_id = 2;
}
```
Using this high-performance inter-service contract, the cloud API Gateway can evaluate permissions or keys in under `<1ms` before forwarding commands to MQTT or Edge brokers.
