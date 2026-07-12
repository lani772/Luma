package mqtt

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts engine-level routes (health) plus per-device
// credential/topic routes nested under the devices router group, since
// credential issuance is authorized the same way device access is (owner or
// admin — enforced by the caller-supplied accessMiddleware).
func (h *Handler) RegisterRoutes(engine gin.IRoutes) {
	engine.GET("/health", h.Health)
}

func (h *Handler) RegisterDeviceRoutes(deviceGroup *gin.RouterGroup, accessMiddleware gin.HandlerFunc) {
	deviceGroup.POST("/:deviceId/mqtt-credentials", accessMiddleware, h.IssueCredentials)
	deviceGroup.DELETE("/:deviceId/mqtt-credentials", accessMiddleware, h.RevokeCredentials)
	deviceGroup.GET("/:deviceId/mqtt-topics", accessMiddleware, h.Topics)
}

func (h *Handler) Health(c *gin.Context) {
	httputil.OK(c, http.StatusOK, h.svc.Health())
}

func (h *Handler) IssueCredentials(c *gin.Context) {
	deviceID, err := uuid.Parse(c.Param("deviceId"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid device id", nil)
		return
	}
	creds, err := h.svc.IssueCredentials(deviceID)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to issue mqtt credentials", nil)
		return
	}
	httputil.OK(c, http.StatusCreated, creds)
}

func (h *Handler) RevokeCredentials(c *gin.Context) {
	deviceID, err := uuid.Parse(c.Param("deviceId"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid device id", nil)
		return
	}
	if err := h.svc.RevokeCredentials(deviceID); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to revoke mqtt credentials", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"revoked": true})
}

func (h *Handler) Topics(c *gin.Context) {
	deviceID, err := uuid.Parse(c.Param("deviceId"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid device id", nil)
		return
	}
	httputil.OK(c, http.StatusOK, h.svc.TopicsFor(deviceID))
}
