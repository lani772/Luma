# LUMA Cloud Backend - API Quick Reference

## Base URL
```
http://localhost:8090/cloud
```

## Authentication
All endpoints (except public ones) require:
```
Authorization: Bearer <jwt_access_token>
```

---

## Service Endpoints Overview

| Service | Method | Endpoint | Auth | Description |
|---------|--------|----------|------|-------------|
| **Authentication** | POST | `/auth/register` | ❌ | Register new account |
| | POST | `/auth/login` | ❌ | Login with email/username |
| | POST | `/auth/refresh` | ❌ | Refresh JWT token |
| | POST | `/auth/logout` | ✅ | Logout and revoke session |
| | GET | `/auth/profile` | ✅ | Get authenticated user profile |
| | GET | `/auth/sessions` | ✅ | List all active sessions |
| | POST | `/auth/sessions/revoke-others` | ✅ | Logout all other devices |
| | POST | `/auth/password-reset/request` | ❌ | Request password reset |
| | POST | `/auth/password-reset/confirm` | ❌ | Confirm password reset |
| | POST | `/auth/email-verification/request` | ✅ | Request email verification |
| | POST | `/auth/email-verification/confirm` | ❌ | Confirm email verification |
| **Users** | GET | `/users/me` | ✅ | Get user account |
| | PATCH | `/users/me` | ✅ | Update profile |
| | DELETE | `/users/me` | ✅ | Delete account |
| | PATCH | `/users/me/preferences` | ✅ | Update preferences |
| | GET | `/users/me/phones` | ✅ | List paired phones |
| | DELETE | `/users/me/phones/{id}` | ✅ | Remove phone |
| | GET | `/users/me/devices` | ✅ | List owned devices |
| **Devices** | POST | `/devices` | ✅ | Register device |
| | GET | `/devices` | ✅ | List devices (paginated) |
| | GET | `/devices/{id}` | ✅ | Get device details |
| | PATCH | `/devices/{id}` | ✅ | Update device |
| | DELETE | `/devices/{id}` | ✅ | Delete device (owner only) |
| | POST | `/devices/{id}/transfer-ownership` | ✅ | Transfer ownership (owner only) |
| | POST | `/devices/{id}/admins` | ✅ | Grant admin access (owner only) |
| | DELETE | `/devices/{id}/admins/{userId}` | ✅ | Revoke admin access (owner only) |
| | GET | `/devices/{id}/history` | ✅ | View device history |
| **Firmware** | POST | `/firmware/upload` | ✅ | Upload firmware binary |
| | GET | `/firmware` | ✅ | List firmware releases (paginated) |
| | GET | `/firmware/{id}` | ✅ | Get firmware details |
| | DELETE | `/firmware/{id}` | ✅ | Delete firmware |
| | POST | `/firmware/{id}/publish` | ✅ | Publish to channel |
| | POST | `/firmware/{id}/archive` | ✅ | Archive firmware |
| | GET | `/firmware/{id}/download` | ❌ | Download binary file |
| | GET | `/firmware/compare` | ✅ | Check for updates |
| **Deployments** | POST | `/deployments` | ✅ | Create deployment |
| | GET | `/deployments` | ✅ | List deployments (paginated) |
| | GET | `/deployments/{id}` | ✅ | Get deployment details |
| | POST | `/deployments/{id}/rollback` | ✅ | Rollback deployment |
| | POST | `/deployments/{id}/devices/{deviceId}/retry` | ✅ | Retry device update |
| **Notifications** | POST | `/notifications` | ✅ | Create notification |
| | GET | `/notifications` | ✅ | List notifications (paginated) |
| | POST | `/notifications/mark-read` | ✅ | Mark as read |
| **Sync** | POST | `/sync/push` | ✅ | Push changes to cloud |
| | POST | `/sync/pull` | ✅ | Pull changes from cloud |
| **Backups** | POST | `/backups` | ✅ | Create backup |
| | GET | `/backups` | ✅ | List backups (paginated) |
| | POST | `/backups/{id}/restore` | ✅ | Restore from backup |
| | DELETE | `/backups/{id}` | ✅ | Delete backup |
| **Admin** | GET | `/admin/users` | 👑 | List all users |
| | GET | `/admin/users/{id}` | 👑 | Get user details |
| | PATCH | `/admin/users/{id}/role` | 👑 | Update user role |
| | PATCH | `/admin/users/{id}/status` | 👑 | Update user status |
| | DELETE | `/admin/users/{id}` | 👑 | Force delete user |
| | GET | `/admin/audit` | 👑 | List audit logs |
| **Health** | GET | `/healthz` | ❌ | Service health check |

**Legend:** ❌ = Public, ✅ = Authenticated, 👑 = Owner only

---

## Common Request/Response Patterns

### Paginated List Response
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "perPage": 20,
    "totalItems": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message",
  "details": {}
}
```

### Authentication Response (Login/Register)
```json
{
  "user": {...},
  "accessToken": "eyJhbGc...",
  "refreshToken": "opaque_token",
  "sessionId": "uuid"
}
```

---

## Query Parameters

### Pagination
- `page`: int (default: 1)
- `perPage`: int (default: 20, max: 100)

### Filtering (varies by endpoint)
- Firmware: `deviceType`, `channel`
- Devices: inherited from user context
- Admin/Audit: `role`, `status`, `actor_id`, `target_id`, `action`

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid auth) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (resource exists) |
| 413 | Payload Too Large (file too big) |
| 500 | Internal Server Error |

---

## Key Models

### User
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "john_doe",
  "fullName": "John Doe",
  "role": "member|admin|owner",
  "status": "active|suspended|deleted",
  "subscriptionTier": "free|pro|enterprise",
  "emailVerified": true,
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### Device
```json
{
  "id": "uuid",
  "name": "Living Room Hub",
  "deviceType": "hub|sensor|light",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "firmwareVersion": "2.1.0",
  "status": "online|offline|decommissioned",
  "ownerId": "uuid",
  "ownerEmail": "user@example.com",
  "admins": [],
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### Firmware Release
```json
{
  "id": "uuid",
  "deviceType": "hub",
  "version": "2.2.0",
  "channel": "beta|stable",
  "storagePath": "firmware/hub/2.2.0/file.bin",
  "checksumSHA256": "...",
  "sizeBytes": 1048576,
  "releaseNotes": "...",
  "isRollbackTarget": false,
  "createdBy": "uuid",
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### Deployment
```json
{
  "id": "uuid",
  "firmwareId": "uuid",
  "name": "2.2.0 Rollout",
  "status": "pending|scheduled|running|completed|failed|rolled_back",
  "rolloutPercentage": 10,
  "scheduledAt": "2025-01-25T10:00:00Z",
  "stats": {
    "total": 150,
    "pending": 15,
    "running": 0,
    "completed": 0,
    "failed": 0
  },
  "devices": [],
  "createdAt": "2025-01-01T12:00:00Z"
}
```

### Notification
```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "firmware|device|automation|schedule|user|system",
  "title": "...",
  "body": "...",
  "data": {},
  "readAt": null,
  "createdAt": "2025-01-01T12:00:00Z"
}
```

---

## Typical User Flows

### 1. Registration & Setup
```
1. POST /auth/register
2. POST /auth/email-verification/request
3. POST /auth/email-verification/confirm
4. PATCH /users/me/preferences
5. POST /devices (register first device)
```

### 2. Device Management
```
1. POST /devices (owner registers)
2. POST /devices/{id}/admins (owner grants access)
3. GET /devices (list own devices)
4. PATCH /devices/{id} (update settings)
5. GET /devices/{id}/history (view changes)
```

### 3. Firmware Deployment
```
1. POST /firmware/upload (upload binary)
2. POST /firmware/{id}/publish (set channel)
3. POST /deployments (create rollout)
4. GET /deployments/{id} (monitor progress)
5. POST /deployments/{id}/rollback (if needed)
```

### 4. Data Sync
```
1. POST /sync/push (client uploads changes)
2. POST /sync/pull (client fetches changes)
```

### 5. Backup & Restore
```
1. POST /backups (create backup)
2. GET /backups (list backups)
3. POST /backups/{id}/restore (restore data)
4. DELETE /backups/{id} (delete old backup)
```

---

## Environment Variables

```bash
# Server
PORT=8090
ENV=development

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db

# Authentication
SESSION_SECRET=<random 32 bytes>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# Cache
REDIS_URL=redis://localhost:6379

# Storage
FIRMWARE_STORAGE_PATH=data/firmware
BACKUP_STORAGE_PATH=data/backups

# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=user
MQTT_PASSWORD=pass
MQTT_TLS_ENABLED=false

# CORS
CORS_ORIGINS=http://localhost:3000,https://app.example.com

# Rate Limiting
RATE_LIMIT_RPM=100
RATE_LIMIT_BURST=10
```

---

## Deployment Checklist

- [ ] Set all required environment variables
- [ ] Configure MongoDB Atlas connection
- [ ] Set up Redis instance (or use in-memory fallback)
- [ ] Configure MQTT broker connection
- [ ] Set JWT_SESSION_SECRET to random 32-byte value
- [ ] Set up storage paths or cloud storage provider
- [ ] Configure CORS_ORIGINS for your domain(s)
- [ ] Run database migrations (automatic on startup)
- [ ] Enable HTTPS in production
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting appropriately
- [ ] Set up automated backups

---

## Troubleshooting

### Common Issues

**"Unauthorized" on all authenticated requests**
- Check JWT_ACCESS_SECRET matches between client and server
- Verify token is not expired (15 minute default TTL)
- Ensure Authorization header format: `Bearer <token>`

**"Firmware file too large"**
- Default limit is 20MB
- Increase with FIRMWARE_MAX_SIZE env var

**"Conflict: Device already registered"**
- Each MAC address can only be registered once
- Transfer ownership or delete to re-register

**"No Redis connection"**
- Set REDIS_URL or service will use in-memory cache
- In-memory cache doesn't work with multiple instances
- Warning will be logged at startup

**Rate limit exceeded**
- Adjust RATE_LIMIT_RPM and RATE_LIMIT_BURST
- Use caching and batch requests when possible

---

## API Examples

### Example: Complete User Registration Flow

```bash
# 1. Register
curl -X POST http://localhost:8090/cloud/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "john_doe",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'

# Response includes accessToken and refreshToken

# 2. Request email verification
curl -X POST http://localhost:8090/cloud/auth/email-verification/request \
  -H "Authorization: Bearer <accessToken>"

# 3. Confirm email (token would come from email in real flow)
curl -X POST http://localhost:8090/cloud/auth/email-verification/confirm \
  -H "Content-Type: application/json" \
  -d '{"token": "<verification_token>"}'
```

### Example: Upload and Deploy Firmware

```bash
# 1. Upload firmware
curl -X POST http://localhost:8090/cloud/firmware/upload \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@firmware.bin" \
  -F "deviceType=hub" \
  -F "version=2.2.0" \
  -F "channel=beta"

# Save the returned firmware ID

# 2. Publish to stable channel
curl -X POST http://localhost:8090/cloud/firmware/<firmwareId>/publish \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"channel": "stable"}'

# 3. Create deployment
curl -X POST http://localhost:8090/cloud/deployments \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "firmwareId": "<firmwareId>",
    "name": "2.2.0 Rollout",
    "rolloutPercentage": 10,
    "scheduledAt": "2025-01-25T10:00:00Z"
  }'
```

---

For complete details, see **FULL_API_GUIDE.md**
