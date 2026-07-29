# LUMA Cloud Backend - Implementation Guide

## Project Architecture

### Directory Structure

```
luma-cloud-backend/
├── cmd/
│   └── api/
│       └── main.go                 # Application entrypoint
├── internal/
│   ├── api/
│   │   └── router.go              # Gin router with all routes
│   ├── config/
│   │   └── config.go              # Environment configuration
│   ├── middleware/
│   │   ├── auth.go                # JWT validation & RBAC
│   │   ├── rate_limit.go          # Rate limiting
│   │   ├── cors.go                # CORS configuration
│   │   ├── logging.go             # Structured logging
│   │   └── recovery.go            # Panic recovery
│   ├── engines/
│   │   ├── auth/
│   │   │   ├── handlers.go        # HTTP handlers
│   │   │   ├── service.go         # Business logic
│   │   │   ├── repository.go      # Data access
│   │   │   ├── dto.go             # Request/response DTOs
│   │   │   ├── tokens.go          # JWT generation
│   │   │   ├── blacklist.go       # Token revocation
│   │   │   └── errors.go          # Domain errors
│   │   ├── devices/
│   │   ├── users/
│   │   ├── firmware/
│   │   ├── deployment/
│   │   ├── notifications/
│   │   ├── sync/
│   │   ├── backup/
│   │   ├── admin/
│   │   └── mqtt/
│   ├── models/
│   │   └── *.go                   # GORM models
│   ├── storage/
│   │   ├── database/
│   │   │   └── database.go        # MongoDB connection
│   │   ├── cache/
│   │   │   ├── cache.go           # Cache interface
│   │   │   ├── memory.go          # In-memory impl
│   │   │   └── redis.go           # Redis impl
│   │   └── storage.go             # File storage interface
│   ├── worker/
│   │   └── worker.go              # Background jobs
│   ├── httputil/
│   │   └── httputil.go            # Response helpers
│   └── models/
│       └── *.go                   # Domain models
├── pkg/
│   └── mqttadapter/               # MQTT adapter pattern
├── migrations/
│   └── *.sql                      # Database migrations
├── go.mod
├── go.sum
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Design Patterns

### 1. Service-Oriented Architecture

Each engine is self-contained with three layers:

**Handler Layer** (`handlers.go`)
- HTTP request parsing
- Middleware enforcement
- Response formatting
- Error handling

```go
func (h *Handler) Register(c *gin.Context) {
    var req RegisterRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
        return
    }
    resp, err := h.svc.Register(req, c.ClientIP())
    if err != nil {
        // Handle error...
    }
    httputil.OK(c, http.StatusCreated, resp)
}
```

**Service Layer** (`service.go`)
- Business logic
- Validation
- Cross-engine dependencies
- Error transformation

```go
func (s *Service) Register(req RegisterRequest, ip string) (*RegistrationDTO, error) {
    // Validate input
    if !isValidEmail(req.Email) {
        return nil, ErrInvalidEmail
    }
    // Check duplicates
    existing, err := s.repo.FindByEmail(req.Email)
    if existing != nil {
        return nil, ErrEmailAlreadyRegistered
    }
    // Business logic
    user := &models.User{...}
    if err := s.repo.Create(user); err != nil {
        return nil, err
    }
    return toDTO(user), nil
}
```

**Repository Layer** (`repository.go`)
- Data access
- Database queries
- Caching logic

```go
func (r *Repository) FindByEmail(email string) (*models.User, error) {
    var u models.User
    err := r.db.Collection("users").FindOne(context.Background(), 
        bson.M{"email": email}).Decode(&u)
    if errors.Is(err, mongo.ErrNoDocuments) {
        return nil, nil
    }
    return &u, err
}
```

### 2. Dependency Injection

All dependencies are wired in `main.go`:

```go
// Services depend on repositories
authRepo := authengine.NewRepository(db)
authSvc := authengine.NewService(authRepo, cfg.JWT, authBlacklist, nil, log)
authHandler := authengine.NewHandler(authSvc)

// Cross-service dependencies use interfaces
type DeviceOwnershipReader interface {
    ListOwnedAndAdminDevices(userID uuid.UUID) ([]OwnedDeviceSummaryDTO, error)
}
usersSvc := usersengine.NewService(usersRepo, devicesSvc)
```

### 3. Error Handling

Domain-specific errors for each engine:

```go
// auth/errors.go
var (
    ErrEmailAlreadyRegistered = errors.New("email already registered")
    ErrInvalidCredentials = errors.New("invalid credentials")
    ErrTokenInvalidOrExpired = errors.New("token invalid or expired")
)

// Handlers transform domain errors to HTTP status codes
if errors.Is(err, ErrInvalidCredentials) {
    httputil.Fail(c, http.StatusUnauthorized, httputil.ErrInvalidCredentials, ...)
}
```

### 4. DTOs (Data Transfer Objects)

Request/response types prevent domain model leakage:

```go
// auth/dto.go
type RegisterRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Username string `json:"username" binding:"required,username"`
    Password string `json:"password" binding:"required,min=8"`
    FullName string `json:"fullName"`
}

type RegistrationDTO struct {
    User         UserDTO    `json:"user"`
    AccessToken  string     `json:"accessToken"`
    RefreshToken string     `json:"refreshToken"`
    SessionID    string     `json:"sessionId"`
}
```

### 5. Middleware Pipeline

Request flow through composable middleware:

```
Request
  ↓
Recovery (panic handler)
  ↓
RequestID (correlation)
  ↓
StructuredLogging (log all requests)
  ↓
CORS (origin validation)
  ↓
RateLimit (per IP)
  ↓
RequireAuth (JWT validation)  [conditional]
  ↓
RequireRole (RBAC check)       [conditional]
  ↓
Handler
  ↓
Response
```

---

## Authentication & Authorization

### JWT Flow

```
1. Login (credentials) → Access Token (15 min) + Refresh Token (30 days)
2. Authenticated requests use Access Token in Authorization header
3. Token expires → Use Refresh Token to get new Access Token
4. Logout → Refresh Token marked invalid in cache-backed blacklist
```

### Session Scoping

Sessions are scoped **per phone**, not per user:

```go
type Session struct {
    ID        uuid.UUID
    UserID    uuid.UUID
    PhoneID   uuid.UUID           // Key: per-device sessions
    Token     string              // hashed refresh token
    ExpiresAt time.Time
    CreatedAt time.Time
}
```

This allows:
- Same user logged in on multiple devices independently
- Logout one phone without affecting others
- Per-device push token tracking

### RBAC (Role-Based Access Control)

Three roles: `member`, `admin`, `owner`

```go
// At router level
requireAuth := middleware.RequireAuth(cfg.JWTAccessSecret, cfg.Blacklist)
requireOwner := middleware.RequireRole("owner")

// Owner-only endpoints
adminGroup := root.Group("/admin", requireAuth, requireOwner)
cfg.AdminHandler.RegisterRoutes(adminGroup)

// Device-level access
allowed, err := devicesSvc.CanAccess(deviceID, userID)
```

---

## Database Design

### MongoDB Collections

**Core Collections:**
- `users` - User accounts and profiles
- `user_phones` - Paired devices with push tokens
- `sessions` - Per-phone authentication sessions
- `devices` - Smart home devices
- `device_admins` - Admin grants per device
- `device_history` - Audit trail of device changes

**Firmware Collections:**
- `firmware_releases` - Uploaded firmware binaries
- `firmware_downloads` - Download tracking
- `firmware_deployments` - Rollout campaigns
- `device_deployments` - Per-device deployment status

**Other Collections:**
- `notifications` - User notifications
- `notification_queue` - Delivery queue (FCM/APNs/Email)
- `cloud_sync_records` - Sync state between devices
- `sync_history` - Conflict resolution history
- `backups` - Backup metadata
- `audit_logs` - Administrative actions

### Indexing

Automatic index creation on startup:

```go
// database/indexes.go
func EnsureIndexes(db *mongo.Database) error {
    indexes := map[string][][]mongo.IndexModel{
        "users": {
            {{Key: bson.D{{Key: "email", Value: 1}}, Options: opts.Unique(true)}},
            {{Key: bson.D{{Key: "username", Value: 1}}}},
        },
        "devices": {
            {{Key: bson.D{{Key: "owner_id", Value: 1}}}},
            {{Key: bson.D{{Key: "mac_address", Value: 1}}, Options: opts.Unique(true)}},
        },
        // ... more indexes
    }
    // Create indexes...
}
```

---

## Data Storage

### Firmware & Backup Files

Two storage backends supported:

**Local Filesystem** (default for development)
```
data/
├── firmware/
│   ├── hub/
│   │   ├── 2.1.0/
│   │   │   └── firmware.bin
│   │   └── 2.2.0/
│   │       └── firmware.bin
│   └── sensor/
└── backups/
    └── {userId}/
        ├── {backupId1}.json
        └── {backupId2}.json
```

**Cloud Storage** (production - S3, GCS, etc.)
```go
// storage/storage.go
type StorageProvider interface {
    Save(ctx context.Context, path string, reader io.Reader) (url string, err error)
    Get(ctx context.Context, path string) (io.ReadCloser, error)
    Delete(ctx context.Context, path string) error
}
```

---

## Background Workers

### Long-Running Tasks

```go
// worker/worker.go
func (w *Worker) Run(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            w.tick()
        }
    }
}

func (w *Worker) tick() {
    // Firmware deployment progression
    _ = w.deploymentSvc.Tick(context.Background())
    
    // Notification delivery retries
    _ = w.notificationSvc.Tick(context.Background())
    
    // Automatic daily backups
    _ = w.backupSvc.Tick(context.Background())
}
```

### Deployment Ticker

```go
// Moves deployments through states: scheduled → running → completed
// - Checks scheduled deployments' timestamps
// - Generates device_deployments from percentage-based rollout
// - Monitors device progression and aggregates status
```

### Notification Ticker

```go
// Processes notification queue with exponential backoff
// - Finds pending notifications
// - Attempts delivery via FCM/APNs/Email
// - Retries up to 5 times with backoff
// - Marks as failed or delivered
```

---

## Caching Strategy

### Two-Level Cache

**Level 1: Application Cache**
```go
// Redis or in-memory
cache.Set("rate_limit:192.168.1.100", count)
cache.Set("blacklist:token_hash", true)  // Immediate logout
```

**Level 2: Database**
```go
// MongoDB - source of truth
db.FindOne({"_id": userID})
```

### Rate Limiting

Per-IP bucket using cache:

```go
key := fmt.Sprintf("rate_limit:%s", clientIP)
count, _ := cache.Incr(key)
cache.SetExp(key, count, 1*time.Minute)

if count > 100 {
    return http.StatusTooManyRequests
}
```

### Session Revocation

Immediate revocation via cache (before JWT expiration):

```go
// Logout
cache.Set("blacklist:token_hash", true)
cache.SetExp("blacklist:token_hash", true, 15*time.Minute)  // TTL = token TTL

// Middleware checks
if cache.Get("blacklist:token_hash") != nil {
    return http.StatusUnauthorized  // Token revoked
}
```

---

## Testing Patterns

### Unit Tests

Each service layer has corresponding tests:

```go
// devices/service_test.go
func TestRegisterDevice(t *testing.T) {
    repo := &mockDeviceRepository{}
    svc := NewService(repo, nil, nil)
    
    device, err := svc.Register(userID, req, "192.168.1.100")
    
    assert.NoError(t, err)
    assert.Equal(t, "hub", device.DeviceType)
    assert.Equal(t, 1, repo.CreateCalls)
}
```

### Integration Tests

Test full flow including database:

```bash
# Start MongoDB
docker run -d -p 27017:27017 mongo

# Run integration tests
go test -tags=integration ./...
```

---

## Deployment

### Docker

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o api ./cmd/api

FROM alpine:latest
COPY --from=builder /app/api /app/api
EXPOSE 8090
CMD ["/app/api"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8090:8090"
    environment:
      MONGO_URI: mongodb://mongo:27017/luma
      REDIS_URL: redis://redis:6379
    depends_on:
      - mongo
      - redis
  
  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
```

### Environment Setup

```bash
# Copy example
cp .env.example .env

# Edit with your values
# - MONGO_URI
# - SESSION_SECRET (generate with: openssl rand -base64 32)
# - CORS_ORIGINS
# - MQTT settings

# Run
docker-compose up
```

---

## Adding a New Engine

### 1. Create Engine Directory

```
internal/engines/myengine/
├── handlers.go
├── service.go
├── repository.go
├── dto.go
└── errors.go
```

### 2. Define Domain Model

```go
// internal/models/mymodel.go
type MyModel struct {
    ID        uuid.UUID
    UserID    uuid.UUID
    Data      string
    CreatedAt time.Time
}
```

### 3. Implement Repository

```go
// internal/engines/myengine/repository.go
type Repository struct {
    db *mongo.Database
}

func (r *Repository) Create(m *models.MyModel) error {
    _, err := r.db.Collection("mymodels").InsertOne(context.Background(), m)
    return err
}
```

### 4. Implement Service

```go
// internal/engines/myengine/service.go
type Service struct {
    repo *Repository
}

func (s *Service) Create(m *models.MyModel) error {
    return s.repo.Create(m)
}
```

### 5. Implement Handlers

```go
// internal/engines/myengine/handlers.go
type Handler struct {
    svc *Service
}

func (h *Handler) RegisterRoutes(r gin.IRoutes) {
    r.POST("", h.Create)
    r.GET("/:id", h.Get)
}
```

### 6. Wire in main.go

```go
// cmd/api/main.go
myengineRepo := myengine.NewRepository(db)
myengineSvc := myengine.NewService(myengineRepo)
myengineHandler := myengine.NewHandler(myengineSvc)

router := api.NewRouter(api.Config{
    // ...
    MyEngineHandler: myengineHandler,
    // ...
})
```

### 7. Add Routes to Router

```go
// internal/api/router.go
myengineGroup := root.Group("/myengine", requireAuth)
cfg.MyEngineHandler.RegisterRoutes(myengineGroup)
```

---

## Monitoring & Observability

### Structured Logging

All logs use JSON format with structured fields:

```go
log.Info("user_registered", 
    "userId", userID,
    "email", email,
    "ip", ipAddress)

// Output:
// {"time":"2025-01-20T14:22:00Z","level":"INFO","msg":"user_registered",
//  "userId":"uuid","email":"user@example.com","ip":"192.168.1.100"}
```

### Request Tracing

Request IDs propagated through entire request:

```go
// middleware/requestid.go
requestID := uuid.New().String()
c.Set("requestId", requestID)
c.Header("X-Request-ID", requestID)

// All logs include requestId
log.Info("...", "requestId", requestID)
```

### Health Endpoint

```bash
curl http://localhost:8090/cloud/healthz
{
  "status": "ok",
  "uptime": "48h15m30s",
  "cacheBackend": "redis"
}
```

---

## Security Best Practices

1. **Password Security**
   - Hashed with bcrypt (cost=12)
   - Min 8 characters, complexity validation
   - Never logged or returned

2. **Token Security**
   - Access tokens: 15 minute TTL
   - Refresh tokens: 30 day TTL
   - Tokens revoked immediately in cache

3. **CORS**
   - Configurable allowed origins
   - Credentials require explicit approval

4. **Rate Limiting**
   - Per IP, per minute
   - Burst protection (10 requests/second)

5. **SQL Injection**
   - MongoDB + ORM prevent injection
   - No dynamic query construction

6. **RBAC**
   - Three-level role system
   - Device-level ownership/admin checks
   - Owner-only admin endpoints

---

## Performance Optimization

### Query Optimization

- Indexed lookups on email, username, MAC address
- Pagination (max 100 items/page)
- Projection to exclude unnecessary fields

### Caching

- Rate limit buckets in Redis
- Token blacklist in Redis
- Device access checks cached per session

### File Handling

- Streaming file uploads (no buffering entire file)
- Configurable size limits (default 20MB)
- Cleanup on failure

---

## Troubleshooting Common Issues

| Issue | Solution |
|-------|----------|
| MongoDB connection failed | Check MONGO_URI, network connectivity |
| Redis connection failed | Service uses in-memory fallback, check logs |
| Rate limit errors | Increase RATE_LIMIT_RPM/RATE_LIMIT_BURST or cache Redis |
| Device already exists | MAC address unique constraint, transfer or delete first |
| Token invalid/expired | Use refresh endpoint, check JWT_ACCESS_SECRET |
| MQTT not connecting | Optional - logs warning, service continues |
| Firmware file too large | Increase FIRMWARE_MAX_SIZE env var |

---

For API usage, see **API_REFERENCE.md** or **FULL_API_GUIDE.md**
