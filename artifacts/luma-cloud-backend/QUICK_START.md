# LUMA Cloud Backend - Quick Start Guide

## Prerequisites

- Go 1.21+
- MongoDB (local or Atlas)
- Redis (optional, uses in-memory fallback)
- Docker & Docker Compose (optional)

---

## 1. Local Development Setup

### Clone & Install Dependencies
```bash
cd artifacts/luma-cloud-backend
go mod download
```

### Set Environment Variables
```bash
export MONGO_URI="mongodb://localhost:27017/luma"
export JWT_ACCESS_SECRET=$(openssl rand -base64 32)
export JWT_REFRESH_SECRET=$(openssl rand -base64 32)
export PORT=8090
export CORS_ORIGINS="http://localhost:3000,http://localhost:8080"
export REDIS_URL="redis://localhost:6379"
```

### Start MongoDB (if local)
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or using brew
brew services start mongodb-community
```

### Start Redis (optional)
```bash
# Using Docker
docker run -d -p 6379:6379 --name redis redis:latest

# Or using brew
brew services start redis
```

### Run the Server
```bash
go run ./cmd/api/main.go
```

Server will start on `http://localhost:8090/cloud`

---

## 2. Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

---

## 3. API Testing

### Health Check
```bash
curl http://localhost:8090/cloud/healthz
```

Expected response:
```json
{
  "status": "ok",
  "uptime": "0h0m5.123456s",
  "cacheBackend": "redis"
}
```

---

## 4. Authentication Flow

### Step 1: Register User
```bash
curl -X POST http://localhost:8090/cloud/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "john_doe",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "john_doe",
  "fullName": "John Doe",
  "emailVerified": false,
  "status": "active",
  "createdAt": "2024-07-29T10:00:00Z",
  "accessToken": "eyJhbGc...",
  "refreshToken": "dGhpcyBpcyBhIHNhbXBs...",
  "expiresIn": 900
}
```

Save the `accessToken` and `refreshToken` for subsequent requests.

### Step 2: Login
```bash
curl -X POST http://localhost:8090/cloud/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### Step 3: Use Access Token
```bash
ACCESS_TOKEN="eyJhbGc..."

# Get user profile
curl http://localhost:8090/cloud/auth/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# List devices
curl http://localhost:8090/cloud/devices \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Step 4: Refresh Token
```bash
REFRESH_TOKEN="dGhpcyBpcyBhIHNhbXBs..."

curl -X POST http://localhost:8090/cloud/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

### Step 5: Logout
```bash
curl -X POST http://localhost:8090/cloud/auth/logout \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

---

## 5. Device Management

### Register a Device
```bash
curl -X POST http://localhost:8090/cloud/devices \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "macAddress": "aa:bb:cc:dd:ee:ff",
    "deviceName": "Living Room Hub",
    "deviceType": "hub",
    "hardwareVersion": "1.0"
  }'
```

Response:
```json
{
  "id": "device123",
  "macAddress": "aa:bb:cc:dd:ee:ff",
  "deviceName": "Living Room Hub",
  "ownerId": "user123",
  "admins": [],
  "createdAt": "2024-07-29T10:05:00Z"
}
```

### List Devices
```bash
curl http://localhost:8090/cloud/devices \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Get Device Details
```bash
curl http://localhost:8090/cloud/devices/device123 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Update Device
```bash
curl -X PATCH http://localhost:8090/cloud/devices/device123 \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceName": "Updated Hub Name"
  }'
```

### Grant Admin Access
```bash
curl -X POST http://localhost:8090/cloud/devices/device123/admins \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "admin@example.com"
  }'
```

---

## 6. Firmware Management

### Upload Firmware
```bash
curl -X POST http://localhost:8090/cloud/firmware/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@firmware.bin" \
  -F "version=1.0.0" \
  -F "deviceType=hub" \
  -F "releaseNotes=Initial release"
```

Response:
```json
{
  "id": "fw123",
  "version": "1.0.0",
  "deviceType": "hub",
  "checksum": "abc123def456...",
  "fileSize": 5242880,
  "releaseNotes": "Initial release",
  "createdAt": "2024-07-29T10:10:00Z"
}
```

### Publish Firmware
```bash
curl -X POST http://localhost:8090/cloud/firmware/fw123/publish \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "stable"
  }'
```

### Check for Updates
```bash
curl "http://localhost:8090/cloud/firmware/compare?deviceType=hub&currentVersion=1.0.0&channel=stable" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Download Firmware
```bash
curl -O "http://localhost:8090/cloud/firmware/fw123/download"
```

---

## 7. Deployments

### Create Deployment
```bash
curl -X POST http://localhost:8090/cloud/deployments \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firmwareId": "fw123",
    "rolloutPercentage": 50,
    "scheduledStartTime": "2024-07-29T15:00:00Z"
  }'
```

### List Deployments
```bash
curl http://localhost:8090/cloud/deployments \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Get Deployment Status
```bash
curl http://localhost:8090/cloud/deployments/deploy123 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Rollback Deployment
```bash
curl -X POST http://localhost:8090/cloud/deployments/deploy123/rollback \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## 8. Cloud Sync

### Push Changes
```bash
curl -X POST http://localhost:8090/cloud/sync/push \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device123",
    "data": {
      "rooms": [{"id": "room1", "name": "Living Room"}],
      "devices": [{"id": "dev1", "name": "Light"}]
    },
    "version": 1
  }'
```

### Pull Changes
```bash
curl -X POST http://localhost:8090/cloud/sync/pull \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device123",
    "lastSyncVersion": 0
  }'
```

---

## 9. Backups

### Create Backup
```bash
curl -X POST http://localhost:8090/cloud/backups \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### List Backups
```bash
curl http://localhost:8090/cloud/backups \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Restore Backup
```bash
curl -X POST http://localhost:8090/cloud/backups/backup123/restore \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restoreType": "all"
  }'
```

---

## 10. Notifications

### Create Notification
```bash
curl -X POST http://localhost:8090/cloud/notifications \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Update Available",
    "message": "Firmware update available",
    "type": "firmware_update"
  }'
```

### List Notifications
```bash
curl http://localhost:8090/cloud/notifications \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## 11. Admin Functions

### List All Users (Owner Only)
```bash
curl http://localhost:8090/cloud/admin/users \
  -H "Authorization: Bearer $OWNER_ACCESS_TOKEN"
```

### Get User Details
```bash
curl http://localhost:8090/cloud/admin/users/user123 \
  -H "Authorization: Bearer $OWNER_ACCESS_TOKEN"
```

### Update User Role
```bash
curl -X PATCH http://localhost:8090/cloud/admin/users/user123/role \
  -H "Authorization: Bearer $OWNER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

### View Audit Logs
```bash
curl http://localhost:8090/cloud/admin/audit \
  -H "Authorization: Bearer $OWNER_ACCESS_TOKEN"
```

---

## 12. Running Tests

```bash
# Run all tests
go test ./...

# Run with verbose output
go test -v ./...

# Run specific package tests
go test -v ./internal/engines/firmware/...

# Run with coverage
go test -cover ./...
```

---

## 13. Useful Tools

### Generate JWT Secret
```bash
openssl rand -base64 32
```

### Monitor Logs (Docker)
```bash
docker-compose logs -f api
```

### Check MongoDB
```bash
# Using mongosh
mongosh mongodb://localhost:27017/luma

# List collections
db.getCollectionNames()

# View users
db.users.find()
```

### Check Redis
```bash
redis-cli ping
redis-cli keys "*"
```

---

## 14. Common Issues

### "Connection refused" for MongoDB
- Ensure MongoDB is running: `docker ps | grep mongo`
- Check MONGO_URI is correct
- Try: `docker run -d -p 27017:27017 mongo:latest`

### "Port 8090 already in use"
```bash
# Find and kill process
lsof -i :8090
kill -9 <PID>

# Or use different port
PORT=8091 go run ./cmd/api/main.go
```

### "Redis connection failed"
- Redis is optional, server uses in-memory cache fallback
- Install Redis: `docker run -d -p 6379:6379 redis:latest`
- Or leave `REDIS_URL` unset

### "Token expired"
- Access tokens expire after 15 minutes
- Use refresh token to get new access token
- See "Step 4: Refresh Token" above

---

## 15. Next Steps

1. ✅ Review the [API_REFERENCE.md](API_REFERENCE.md) for complete endpoint list
2. ✅ Check [FULL_API_GUIDE.md](FULL_API_GUIDE.md) for detailed documentation
3. ✅ Deploy to production following your platform's guide
4. ✅ Set up monitoring and alerting
5. ✅ Configure production MongoDB & Redis
6. ✅ Update CORS origins for your domain

---

**All 56+ endpoints are ready to use!**
