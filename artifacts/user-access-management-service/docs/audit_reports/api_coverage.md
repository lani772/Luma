# LUMA User Access Management Service (UAMS)
## Phase 3 — API Review & Coverage Report

This report evaluates API schema consistency, REST naming patterns, validation constraints, and OpenAPI specification alignment.

### 1. Endpoint Coverage Matrix

The REST API implements standard, uniform JSON envelopes and REST patterns under `/api/v1/*`.

| Route | HTTP Method | Action | Input Validation | Auth Scoping | Status Codes |
|---|---|---|---|---|---|
| `/api/v1/roles/assign` | `POST` | Assign microcontroller role | `AssignRoleRequest` (JSON) | Owner-only | `201 Created`, `400`, `403` |
| `/api/v1/roles` | `GET` | List role assignments | Query filters (`userId`, `microcontrollerId`) | Authenticated user | `200 OK`, `401` |
| `/api/v1/roles/:id` | `PATCH` | Update role assignment | `UpdateRoleRequest` | Owner-only | `200 OK`, `400`, `404` |
| `/api/v1/roles/:id` | `DELETE` | Remove role assignment | Path parameter | Owner-only | `200 OK`, `404` |
| `/api/v1/permissions/grant` | `POST` | Grant custom permission | `GrantPermissionRequest` | Owner/Admin | `201 Created`, `400` |
| `/api/v1/permissions/check` | `POST` | Evaluate action allowance | `CheckPermissionRequest` | Public (System) | `200 OK`, `400` |
| `/api/v1/permissions` | `GET` | Query granted permissions | Query filters (`userId`, `microcontrollerId`) | Authenticated user | `200 OK` |
| `/api/v1/permissions/:id` | `DELETE` | Revoke a custom permission | Path parameter | Owner/Admin | `200 OK`, `404` |
| `/api/v1/invitations` | `POST` | Send sharing invitation | `CreateInvitationRequest` | Owner/Admin | `201 Created` |
| `/api/v1/invitations` | `GET` | List active invitations | Query filters | Sender/Recipient | `200 OK` |
| `/api/v1/invitations/:id/accept` | `POST` | Accept sharing invite | Path parameter | Recipient-only | `200 OK`, `409` |
| `/api/v1/invitations/:id/reject` | `POST` | Reject sharing invite | Path parameter | Recipient-only | `200 OK` |
| `/api/v1/access-requests` | `POST` | Request resource access | `CreateAccessRequest` | Requester | `201 Created` |
| `/api/v1/access-requests` | `GET` | Query requests | Query filters | Requester/Owner | `200 OK` |
| `/api/v1/access-requests/:id/approve`| `POST` | Approve request | Path parameter | Owner-only | `200 OK` |
| `/api/v1/access-requests/:id/reject` | `POST` | Reject request | Path parameter | Owner-only | `200 OK` |
| `/api/v1/ownership/request` | `POST` | Initiate transfer | `RequestTransferRequest` | Owner-only | `201 Created` |
| `/api/v1/ownership/accept` | `POST` | Accept transfer | `AcceptTransferRequest` | Recipient-only | `200 OK` |
| `/api/v1/ownership/reject` | `POST` | Reject transfer | `RejectTransferRequest` | Recipient-only | `200 OK` |

### 2. Standardization Evaluation

* **Consistent REST Naming**: Pluralized collection resource names (`roles`, `permissions`, `invitations`, `access-requests`, `ownership`) are cleanly utilized.
* **Pagination & Filtering**: Core list endpoints support query param filters (such as `userId`, `status`, `microcontrollerId`) for targeted search results.
* **OpenAPI Alignment**: Every single path, request body, and parameter mapped in the OpenAPI YAML aligns exactly with handler definitions in Go.
