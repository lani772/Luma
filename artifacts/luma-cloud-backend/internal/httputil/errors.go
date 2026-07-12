package httputil

// Error code catalogue. Every non-2xx response uses one of these in
// error.code so mobile clients can branch on stable machine-readable codes
// instead of parsing messages. Document new codes in docs/openapi.yaml
// alongside the endpoint that returns them.
const (
	ErrValidation         = "VALIDATION_ERROR"
	ErrUnauthorized       = "UNAUTHORIZED"
	ErrInvalidCredentials = "INVALID_CREDENTIALS"
	ErrTokenExpired       = "TOKEN_EXPIRED"
	ErrTokenRevoked       = "TOKEN_REVOKED"
	ErrForbidden          = "FORBIDDEN"
	ErrNotFound           = "NOT_FOUND"
	ErrConflict           = "CONFLICT"
	ErrRateLimited        = "RATE_LIMITED"
	ErrInternal           = "INTERNAL_ERROR"
	ErrEmailInUse         = "EMAIL_IN_USE"
	ErrDeviceExists       = "DEVICE_ALREADY_REGISTERED"
)
