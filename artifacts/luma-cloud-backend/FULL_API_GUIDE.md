# LUMA Cloud Backend - Complete API Guide

This document provides a comprehensive guide to all services and endpoints available in the LUMA Cloud Backend (excluding MQTT service). The backend runs on `http://localhost:8090/cloud` (or `/cloud` when proxied).

---

## Base Information

- **Base URL**: `/cloud`
- **Dual Path Support**: All endpoints work under both paths:
  - Mobile/REST path: `/cloud/{service}/{operation}`
  - Spec-literal path: `/cloud/api/engines/{service}/{operation}`
- **Authentication**: JWT Bearer token in `Authorization` header (except for public endpoints)
- **Rate Limiting**: 100 requests/minute per IP address
- **Response Format**: JSON

---

## 1. Authentication Engine (`/auth`)

Handles user registration, login, session management, password resets, and email verification.

### 1.1 Register
**Endpoint**: `POST /cloud/auth/register`

```json
Request:
{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "SecurePassword123!",
  "fullName": "John Doe"
}

Response (201):
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "john_doe",
    "fullName": "John Doe",
    "role": "member",
    "status": "active",
    "emailVerified": false,
    "createdAt": "2025-01-01T12:00:00Z"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "opaque_random_string_64chars",
  "sessionId": "550e8400-e29b-41d4-a716-446655440001"
}
```

### 1.2 Login
**Endpoint**: `POST /cloud/auth/login`

```json
Request:
{
  "email": "user@example.com",  // or "username": "john_doe"
  "password": "SecurePassword123!"
}

Response (200):
{
  "user": { ... },
  "accessToken": "...",
  "refreshToken": "...",
  "sessionId": "..."
}
```

### 1.3 Refresh Session
**Endpoint**: `POST /cloud/auth/refresh`

```json
Request:
{
  "refreshToken": "opaque_random_string_64chars"
}

Response (200):
{
  "accessToken": "new_jwt_token",
  "refreshToken": "new_opaque_token_rotated",
  "sessionId": "550e8400-e29b-41d4-a716-446655440001"
}
```

### 1.4 Logout
**Endpoint**: `POST /cloud/auth/logout`
**Authentication**: Required

```json
Request:
{
  "refreshToken": "opaque_random_string_64chars"
}

Response (200):
{
  "loggedOut": true
}
```

### 1.5 Get Auth Profile
**Endpoint**: `GET /cloud/auth/profile`
**Authentication**: Required

```json
Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "john_doe",
  "fullName": "John Doe",
  "role": "member",
  "emailVerified": true,
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### 1.6 List Sessions
**Endpoint**: `GET /cloud/auth/sessions`
**Authentication**: Required

```json
Response (200):
{
  "data": [
    {
      "sessionId": "550e8400-e29b-41d4-a716-446655440001",
      "phoneId": "550e8400-e29b-41d4-a716-446655440010",
      "userAgent": "iOS/15.0 LUMA/2.1",
      "ipAddress": "192.168.1.100",
      "createdAt": "2025-01-15T10:30:00Z",
      "lastSeenAt": "2025-01-20T14:22:00Z"
    }
  ]
}
```

### 1.7 Revoke Other Sessions
**Endpoint**: `POST /cloud/auth/sessions/revoke-others`
**Authentication**: Required

```json
Response (200):
{
  "revoked": true
}
```

### 1.8 Request Password Reset
**Endpoint**: `POST /cloud/auth/password-reset/request`

```json
Request:
{
  "email": "user@example.com"
}

Response (200):
{
  "message": "if that email is registered, a reset link has been sent"
}
```

### 1.9 Confirm Password Reset
**Endpoint**: `POST /cloud/auth/password-reset/confirm`

```json
Request:
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword123!"
}

Response (200):
{
  "passwordReset": true
}
```

### 1.10 Request Email Verification
**Endpoint**: `POST /cloud/auth/email-verification/request`
**Authentication**: Required

```json
Response (200):
{
  "message": "verification email sent"
}
```

### 1.11 Confirm Email Verification
**Endpoint**: `POST /cloud/auth/email-verification/confirm`

```json
Request:
{
  "token": "verification_token_from_email"
}

Response (200):
{
  "emailVerified": true
}
```

---

## 2. Users Engine (`/users`)

Manages user profiles, preferences, phones, and device ownership.

### 2.1 Get Account
**Endpoint**: `GET /cloud/users/me`
**Authentication**: Required

```json
Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "john_doe",
  "fullName": "John Doe",
  "role": "member",
  "subscriptionTier": "free",
  "preferences": {
    "theme": "dark",
    "notifications": true,
    "language": "en"
  },
  "emailVerified": true,
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### 2.2 Update Profile
**Endpoint**: `PATCH /cloud/users/me`
**Authentication**: Required

```json
Request:
{
  "username": "new_username",
  "fullName": "New Full Name"
}

Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "new_username",
  "fullName": "New Full Name",
  "role": "member",
  "emailVerified": true,
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### 2.3 Update Preferences
**Endpoint**: `PATCH /cloud/users/me/preferences`
**Authentication**: Required

```json
Request:
{
  "preferences": {
    "theme": "light",
    "notifications": false,
    "language": "es"
  }
}

Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "preferences": {
    "theme": "light",
    "notifications": false,
    "language": "es"
  }
}
```

### 2.4 Delete Account
**Endpoint**: `DELETE /cloud/users/me`
**Authentication**: Required

```json
Request:
{
  "password": "CurrentPassword123!"
}

Response (200):
{
  "deleted": true
}
```

### 2.5 List Phones
**Endpoint**: `GET /cloud/users/me/phones`
**Authentication**: Required

```json
Response (200):
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "deviceName": "iPhone 15 Pro",
      "platform": "ios",
      "lastSeenAt": "2025-01-20T14:22:00Z",
      "createdAt": "2025-01-01T12:00:00Z"
    }
  ]
}
```

### 2.6 Remove Phone
**Endpoint**: `DELETE /cloud/users/me/phones/{phoneId}`
**Authentication**: Required

```json
Response (200):
{
  "removed": true
}
```

### 2.7 List Owned Devices
**Endpoint**: `GET /cloud/users/me/devices`
**Authentication**: Required

```json
Response (200):
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "name": "Living Room Hub",
      "type": "hub",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "firmwareVersion": "2.1.0",
      "status": "online",
      "ownerEmail": "user@example.com",
      "createdAt": "2025-01-01T12:00:00Z"
    }
  ]
}
```

---

## 3. Device Registration Engine (`/devices`)

Manages device lifecycle, ownership, admin delegation, and access control.

### 3.1 Register Device
**Endpoint**: `POST /cloud/devices`
**Authentication**: Required

```json
Request:
{
  "name": "Living Room Hub",
  "deviceType": "hub",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "firmwareVersion": "2.1.0"
}

Response (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440020",
  "name": "Living Room Hub",
  "deviceType": "hub",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "firmwareVersion": "2.1.0",
  "status": "online",
  "ownerId": "550e8400-e29b-41d4-a716-446655440000",
  "ownerEmail": "user@example.com",
  "admins": [],
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### 3.2 List Devices
**Endpoint**: `GET /cloud/devices?page=1&perPage=20`
**Authentication**: Required

```json
Response (200):
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "name": "Living Room Hub",
      "deviceType": "hub",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "firmwareVersion": "2.1.0",
      "status": "online",
      "ownerId": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2025-01-01T12:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 5,
    "totalPages": 1
  }
}
```

### 3.3 Get Device
**Endpoint**: `GET /cloud/devices/{deviceId}`
**Authentication**: Required (Must own or be admin)

```json
Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440020",
  "name": "Living Room Hub",
  "deviceType": "hub",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "firmwareVersion": "2.1.0",
  "status": "online",
  "ownerId": "550e8400-e29b-41d4-a716-446655440000",
  "ownerEmail": "user@example.com",
  "admins": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "admin@example.com"
    }
  ],
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### 3.4 Update Device
**Endpoint**: `PATCH /cloud/devices/{deviceId}`
**Authentication**: Required (Owner or admin)

```json
Request:
{
  "name": "New Device Name",
  "firmwareVersion": "2.2.0"
}

Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440020",
  "name": "New Device Name",
  "firmwareVersion": "2.2.0",
  ...
}
```

### 3.5 Delete Device
**Endpoint**: `DELETE /cloud/devices/{deviceId}`
**Authentication**: Required (Owner only)

```json
Response (200):
{
  "removed": true
}
```

### 3.6 Transfer Ownership
**Endpoint**: `POST /cloud/devices/{deviceId}/transfer-ownership`
**Authentication**: Required (Owner only)

```json
Request:
{
  "newOwnerEmail": "neowner@example.com"
}

Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440020",
  "ownerId": "550e8400-e29b-41d4-a716-446655440999",
  "ownerEmail": "newowner@example.com",
  ...
}
```

### 3.7 Grant Admin Access
**Endpoint**: `POST /cloud/devices/{deviceId}/admins`
**Authentication**: Required (Owner only)

```json
Request:
{
  "userEmail": "admin@example.com"
}

Response (200):
{
  "granted": true
}
```

### 3.8 Revoke Admin Access
**Endpoint**: `DELETE /cloud/devices/{deviceId}/admins/{userId}`
**Authentication**: Required (Owner only)

```json
Response (200):
{
  "revoked": true
}
```

### 3.9 Device History
**Endpoint**: `GET /cloud/devices/{deviceId}/history?page=1&perPage=20`
**Authentication**: Required (Owner or admin)

```json
Response (200):
{
  "data": [
    {
      "id": "history_entry_id",
      "deviceId": "550e8400-e29b-41d4-a716-446655440020",
      "action": "updated",
      "actor": "user@example.com",
      "details": {
        "changed": ["firmwareVersion"],
        "from": "2.1.0",
        "to": "2.2.0"
      },
      "timestamp": "2025-01-20T14:22:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 15,
    "totalPages": 1
  }
}
```

---

## 4. Firmware Engine (`/firmware`)

Manages firmware releases, versions, and distribution channels.

### 4.1 Upload Firmware
**Endpoint**: `POST /cloud/firmware/upload`
**Authentication**: Required
**Content-Type**: `multipart/form-data`

```
Request:
- file: <binary .bin file>
- deviceType: "hub"
- version: "2.2.0"
- channel: "beta"
- signature: "signature_string_optional"
- isRollbackTarget: false
- releaseNotes: "Bug fixes and improvements"

Response (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440030",
  "deviceType": "hub",
  "version": "2.2.0",
  "channel": "beta",
  "storagePath": "firmware/hub/2.2.0/firmware.bin",
  "checksumSHA256": "abc123def456...",
  "signature": "signature_string_optional",
  "sizeBytes": 1048576,
  "releaseNotes": "Bug fixes and improvements",
  "isRollbackTarget": false,
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2025-01-20T14:22:00Z"
}
```

### 4.2 List Firmware Releases
**Endpoint**: `GET /cloud/firmware?deviceType=hub&channel=stable&page=1&perPage=20`
**Authentication**: Required

```json
Response (200):
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "deviceType": "hub",
      "version": "2.2.0",
      "channel": "stable",
      "checksumSHA256": "abc123def456...",
      "sizeBytes": 1048576,
      "isRollbackTarget": false,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 8,
    "totalPages": 1
  }
}
```

### 4.3 Get Firmware Details
**Endpoint**: `GET /cloud/firmware/{id}`
**Authentication**: Required

```json
Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440030",
  "deviceType": "hub",
  "version": "2.2.0",
  "channel": "stable",
  "storagePath": "firmware/hub/2.2.0/firmware.bin",
  "checksumSHA256": "abc123def456...",
  "sizeBytes": 1048576,
  "releaseNotes": "Bug fixes and improvements",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### 4.4 Delete Firmware
**Endpoint**: `DELETE /cloud/firmware/{id}`
**Authentication**: Required

```json
Response (200):
{
  "deleted": true
}
```

### 4.5 Publish Firmware to Channel
**Endpoint**: `POST /cloud/firmware/{id}/publish`
**Authentication**: Required

```json
Request:
{
  "channel": "stable"
}

Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440030",
  "channel": "stable",
  ...
}
```

### 4.6 Archive Firmware
**Endpoint**: `POST /cloud/firmware/{id}/archive`
**Authentication**: Required

```json
Request:
{
  "isRollbackTarget": true
}

Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440030",
  "isRollbackTarget": true,
  ...
}
```

### 4.7 Download Firmware Binary
**Endpoint**: `GET /cloud/firmware/{id}/download?deviceId=xxx`

```
Response (200):
<binary firmware file>

Headers:
- Content-Type: application/octet-stream
- Content-Disposition: attachment; filename="firmware.bin"
```

### 4.8 Compare Firmware Versions
**Endpoint**: `GET /cloud/firmware/compare?deviceType=hub&currentVersion=2.1.0&channel=stable`
**Authentication**: Required

```json
Response (200):
{
  "currentVersion": "2.1.0",
  "latestVersion": "2.2.0",
  "needsUpdate": true,
  "channel": "stable"
}
```

---

## 5. Deployment Engine (`/deployments`)

Manages firmware rollout campaigns with percentage-based deployment.

### 5.1 Create Deployment
**Endpoint**: `POST /cloud/deployments`
**Authentication**: Required

```json
Request:
{
  "firmwareId": "550e8400-e29b-41d4-a716-446655440030",
  "name": "2.2.0 Stable Rollout",
  "rolloutPercentage": 10,
  "scheduledAt": "2025-01-25T10:00:00Z"
}

Response (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440040",
  "firmwareId": "550e8400-e29b-41d4-a716-446655440030",
  "name": "2.2.0 Stable Rollout",
  "status": "scheduled",
  "rolloutPercentage": 10,
  "scheduledAt": "2025-01-25T10:00:00Z",
  "stats": {
    "total": 150,
    "pending": 15,
    "running": 0,
    "completed": 0,
    "failed": 0
  },
  "createdAt": "2025-01-20T14:22:00Z"
}
```

### 5.2 List Deployments
**Endpoint**: `GET /cloud/deployments?page=1&perPage=20`
**Authentication**: Required

```json
Response (200):
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440040",
      "name": "2.2.0 Stable Rollout",
      "status": "running",
      "rolloutPercentage": 10,
      "stats": {
        "total": 150,
        "pending": 5,
        "running": 5,
        "completed": 5,
        "failed": 0
      },
      "createdAt": "2025-01-20T14:22:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 3,
    "totalPages": 1
  }
}
```

### 5.3 Get Deployment Details
**Endpoint**: `GET /cloud/deployments/{id}`
**Authentication**: Required

```json
Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440040",
  "firmwareId": "550e8400-e29b-41d4-a716-446655440030",
  "name": "2.2.0 Stable Rollout",
  "status": "running",
  "rolloutPercentage": 10,
  "stats": {
    "total": 150,
    "pending": 5,
    "running": 5,
    "completed": 5,
    "failed": 0
  },
  "devices": [
    {
      "deviceId": "550e8400-e29b-41d4-a716-446655440020",
      "status": "completed",
      "retries": 0,
      "updatedAt": "2025-01-20T15:22:00Z"
    }
  ],
  "createdAt": "2025-01-20T14:22:00Z"
}
```

### 5.4 Rollback Deployment
**Endpoint**: `POST /cloud/deployments/{id}/rollback`
**Authentication**: Required

```json
Response (200):
{
  "rolledBack": true
}
```

### 5.5 Retry Device Deployment
**Endpoint**: `POST /cloud/deployments/{id}/devices/{deviceId}/retry`
**Authentication**: Required

```json
Response (200):
{
  "retrying": true
}
```

---

## 6. Notifications Engine (`/notifications`)

Manages notifications delivery via FCM (Firebase), APNs (Apple), and Email.

### 6.1 Create Notification
**Endpoint**: `POST /cloud/notifications`
**Authentication**: Required

```json
Request:
{
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "type": "firmware",
  "title": "Firmware Update Available",
  "body": "Version 2.2.0 is ready for installation",
  "data": {
    "firmwareId": "550e8400-e29b-41d4-a716-446655440030",
    "version": "2.2.0"
  }
}

Response (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440050",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "type": "firmware",
  "title": "Firmware Update Available",
  "body": "Version 2.2.0 is ready for installation",
  "data": {
    "firmwareId": "550e8400-e29b-41d4-a716-446655440030",
    "version": "2.2.0"
  },
  "readAt": null,
  "createdAt": "2025-01-20T14:22:00Z"
}
```

### 6.2 List Notifications
**Endpoint**: `GET /cloud/notifications?page=1&perPage=20`
**Authentication**: Required

```json
Response (200):
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440050",
      "type": "firmware",
      "title": "Firmware Update Available",
      "body": "Version 2.2.0 is ready for installation",
      "readAt": null,
      "createdAt": "2025-01-20T14:22:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 12,
    "totalPages": 1
  }
}
```

### 6.3 Mark Notifications as Read
**Endpoint**: `POST /cloud/notifications/mark-read`
**Authentication**: Required

```json
Request:
{
  "notificationIds": [
    "550e8400-e29b-41d4-a716-446655440050",
    "550e8400-e29b-41d4-a716-446655440051"
  ]
}

Response (200):
{
  "markedRead": true
}
```

---

## 7. Cloud Sync Engine (`/sync`)

Handles cross-device synchronization with conflict resolution via Last-Write-Wins.

### 7.1 Push Changes (Upload to Cloud)
**Endpoint**: `POST /cloud/sync/push`
**Authentication**: Required

```json
Request:
{
  "phoneId": "550e8400-e29b-41d4-a716-446655440010",
  "resources": [
    {
      "resourceType": "homes",
      "resourceId": "home_001",
      "data": {
        "name": "My Home",
        "location": "San Francisco"
      },
      "version": 1,
      "updatedAt": "2025-01-20T14:22:00Z",
      "deleted": false
    }
  ]
}

Response (200):
{
  "success": true,
  "conflicts": []
}
```

### 7.2 Pull Changes (Download from Cloud)
**Endpoint**: `POST /cloud/sync/pull`
**Authentication**: Required

```json
Request:
{
  "phoneId": "550e8400-e29b-41d4-a716-446655440010",
  "resourceType": "homes",
  "lastVersion": 5
}

Response (200):
{
  "resources": [
    {
      "resourceId": "home_001",
      "resourceType": "homes",
      "data": {
        "name": "My Home",
        "location": "San Francisco"
      },
      "version": 6,
      "updatedAt": "2025-01-20T14:22:00Z",
      "deleted": false
    }
  ],
  "currentVersion": 6
}
```

---

## 8. Cloud Backup Engine (`/backups`)

Manages user data backups and restoration.

### 8.1 Create Backup
**Endpoint**: `POST /cloud/backups`
**Authentication**: Required

```json
Response (201):
{
  "id": "550e8400-e29b-41d4-a716-446655440060",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "storagePath": "backups/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440060.json",
  "sizeBytes": 5242880,
  "checksum": "abc123def456...",
  "createdAt": "2025-01-20T14:22:00Z"
}
```

### 8.2 List Backups
**Endpoint**: `GET /cloud/backups?page=1&perPage=20`
**Authentication**: Required

```json
Response (200):
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440060",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "sizeBytes": 5242880,
      "checksum": "abc123def456...",
      "createdAt": "2025-01-20T14:22:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 7,
    "totalPages": 1
  }
}
```

### 8.3 Restore from Backup
**Endpoint**: `POST /cloud/backups/{id}/restore`
**Authentication**: Required

```json
Request:
{
  "targetType": "all",
  "targetId": ""
}

// Or restore specific resources:
{
  "targetType": "home",
  "targetId": "home_001"
}

Response (200):
{
  "restored": true
}
```

### 8.4 Delete Backup
**Endpoint**: `DELETE /cloud/backups/{id}`
**Authentication**: Required

```json
Response (200):
{
  "deleted": true
}
```

---

## 9. Admin & Audit Engine (`/admin`)

Administrative operations and audit trail logging. **Requires owner role**.

### 9.1 List Users
**Endpoint**: `GET /cloud/admin/users?role=admin&status=active&page=1&perPage=20`
**Authentication**: Required (Owner only)

```json
Response (200):
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "admin@example.com",
      "username": "admin_user",
      "fullName": "Admin User",
      "role": "admin",
      "status": "active",
      "subscriptionTier": "pro",
      "emailVerified": true,
      "lastSeenAt": "2025-01-20T14:22:00Z",
      "createdAt": "2025-01-01T12:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 3,
    "totalPages": 1
  }
}
```

### 9.2 Get User Details
**Endpoint**: `GET /cloud/admin/users/{userId}`
**Authentication**: Required (Owner only)

```json
Response (200):
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "admin@example.com",
  "username": "admin_user",
  "fullName": "Admin User",
  "role": "admin",
  "status": "active",
  "subscriptionTier": "pro",
  "emailVerified": true,
  "lastSeenAt": "2025-01-20T14:22:00Z",
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### 9.3 Update User Role
**Endpoint**: `PATCH /cloud/admin/users/{userId}/role`
**Authentication**: Required (Owner only)

```json
Request:
{
  "role": "admin"
}

Response (200):
{
  "updated": true
}
```

### 9.4 Update User Status
**Endpoint**: `PATCH /cloud/admin/users/{userId}/status`
**Authentication**: Required (Owner only)

```json
Request:
{
  "status": "suspended"
}

Response (200):
{
  "updated": true
}
```

### 9.5 Force Delete User
**Endpoint**: `DELETE /cloud/admin/users/{userId}`
**Authentication**: Required (Owner only)

```json
Response (200):
{
  "deleted": true
}
```

### 9.6 List Audit Logs
**Endpoint**: `GET /cloud/admin/audit?actor_id=xxx&target_id=yyy&action=user.role_changed&page=1&perPage=20`
**Authentication**: Required (Owner only)

```json
Response (200):
{
  "data": [
    {
      "id": "audit_entry_001",
      "actorUserId": "550e8400-e29b-41d4-a716-446655440000",
      "actorRole": "owner",
      "targetUserId": "550e8400-e29b-41d4-a716-446655440001",
      "targetDeviceId": null,
      "action": "user.role_changed",
      "details": {
        "from_role": "member",
        "to_role": "admin"
      },
      "ipAddress": "192.168.1.100",
      "createdAt": "2025-01-20T14:22:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 45,
    "totalPages": 3
  }
}
```

---

## 10. Health Check Endpoint

### 10.1 Service Health
**Endpoint**: `GET /cloud/healthz`

```json
Response (200):
{
  "status": "ok",
  "uptime": "48h15m30s",
  "cacheBackend": "redis"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "additional_context"
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` (400) - Invalid input
- `UNAUTHORIZED` (401) - Missing or invalid auth token
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `CONFLICT` (409) - Resource already exists
- `INTERNAL_ERROR` (500) - Server error

---

## Authentication Headers

All authenticated requests must include:

```
Authorization: Bearer <your_jwt_access_token>
```

Access tokens expire after 15 minutes. Use the refresh endpoint to get a new token.

---

## Rate Limiting

- **Limit**: 100 requests per minute per IP address
- **Headers**:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 85`
  - `X-RateLimit-Reset: 1705774920`

---

## Pagination

List endpoints support pagination:

- `page`: Page number (1-indexed, default: 1)
- `perPage`: Items per page (default: 20, max: 100)

---

## Implementation Summary

**Implemented Services:**
1. ✅ Authentication Engine - Full register/login/session management
2. ✅ Users Engine - Profile, preferences, phone management
3. ✅ Device Registration Engine - Device lifecycle and access control
4. ✅ Firmware Engine - Upload, distribute, and version firmware
5. ✅ Deployment Engine - Rolling update campaigns with percentage-based rollout
6. ✅ Notifications Engine - FCM, APNs, and email delivery (mocked in Phase 1)
7. ✅ Cloud Sync Engine - Cross-device sync with conflict resolution
8. ✅ Cloud Backup Engine - Backup/restore with selective restoration
9. ✅ Admin & Audit Engine - User management and audit trail

**Backend Stack:**
- Language: Go
- Framework: Gin HTTP framework
- Database: MongoDB Atlas (with migrations support)
- Cache: Redis (with in-memory fallback)
- Storage: Local filesystem or cloud storage providers
- Authentication: JWT + opaque refresh tokens

**Deployment:**
- Docker: Run with `docker-compose up`
- Replit: Deployed via `.replit-artifact` workflow
- Port: 8090 (or configured via `PORT` env var)
