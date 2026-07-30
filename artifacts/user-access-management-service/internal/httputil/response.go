package httputil

import "github.com/gin-gonic/gin"

type Envelope struct {
	Success bool        `json:"success"`
	Data    any         `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

type Meta struct {
	Page       int   `json:"page"`
	PerPage    int   `json:"perPage"`
	TotalItems int64 `json:"totalItems"`
	TotalPages int   `json:"totalPages"`
}

type APIError struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

const (
	ErrUnauthorized = "UNAUTHORIZED"
	ErrForbidden    = "FORBIDDEN"
	ErrValidation   = "VALIDATION_FAILED"
	ErrNotFound     = "NOT_FOUND"
	ErrInternal     = "INTERNAL_ERROR"
	ErrConflict     = "CONFLICT"
)

func OK(c *gin.Context, status int, data any) {
	c.JSON(status, Envelope{Success: true, Data: data})
}

func OKPaginated(c *gin.Context, data any, meta Meta) {
	c.JSON(200, Envelope{Success: true, Data: data, Meta: &meta})
}

func Fail(c *gin.Context, status int, code, message string, details map[string]any) {
	c.AbortWithStatusJSON(status, Envelope{
		Success: false,
		Error:   &APIError{Code: code, Message: message, Details: details},
	})
}

func Paginate(page, perPage int) (int, int) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	return page, perPage
}

func TotalPages(totalItems int64, perPage int) int {
	if perPage <= 0 {
		return 0
	}
	pages := int(totalItems) / perPage
	if int(totalItems)%perPage != 0 {
		pages++
	}
	return pages
}
