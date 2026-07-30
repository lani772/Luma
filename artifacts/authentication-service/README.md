# LUMA Authentication Service

Advanced JWT-based authentication service with multi-factor authentication, OAuth2 integration, and session management.

## Features

- JWT token generation and validation
- Refresh token rotation
- Multi-factor authentication (MFA)
- OAuth2 integration (Google, GitHub, Microsoft)
- Session management
- Rate limiting and brute-force protection
- Audit logging
- Token blacklisting

## Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `POST /auth/verify` - Verify token

### Multi-Factor Authentication
- `POST /auth/mfa/setup` - Setup MFA
- `POST /auth/mfa/verify` - Verify MFA code
- `POST /auth/mfa/disable` - Disable MFA

### OAuth2
- `GET /auth/oauth2/authorize` - OAuth2 authorization
- `POST /auth/oauth2/callback` - OAuth2 callback
- `POST /auth/oauth2/link` - Link OAuth2 account

## Configuration

```env
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
MFA_ISSUER=LUMA
OAUTH2_PROVIDERS=google,github,microsoft
```

## Security Features

- Password hashing with bcrypt
- HMAC signature validation
- CORS protection
- CSRF token validation
- Rate limiting (100 requests/minute per IP)
- Brute-force protection (5 failed attempts = 15min lockout)
- Session timeout (30 minutes)
- Token revocation

## Database Schema

### Users Table
- user_id (UUID)
- email (VARCHAR)
- password_hash (VARCHAR)
- mfa_enabled (BOOLEAN)
- mfa_secret (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Sessions Table
- session_id (UUID)
- user_id (UUID)
- refresh_token (VARCHAR)
- ip_address (VARCHAR)
- user_agent (VARCHAR)
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP)

### Audit Log Table
- audit_id (UUID)
- user_id (UUID)
- action (VARCHAR)
- status (VARCHAR)
- ip_address (VARCHAR)
- timestamp (TIMESTAMP)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Build for production
npm run build
```

## API Examples

### Register
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

### Verify MFA
```bash
curl -X POST http://localhost:3001/auth/mfa/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "code": "123456"
  }'
```

## Deployment

### Docker
```bash
docker build -t luma-auth-service .
docker run -p 3001:3001 luma-auth-service
```

### Kubernetes
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/configmap.yaml
```

## Monitoring

- Health check: `GET /health`
- Metrics: `GET /metrics` (Prometheus format)
- Logs: Structured JSON logging

## License

MIT
