package sync

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/httputil"
	"github.com/luma-smart-home/cloud-backend/internal/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(primaryGroup, gatewayGroup *gin.RouterGroup, requireAuth gin.HandlerFunc) {
	for _, g := range []*gin.RouterGroup{primaryGroup, gatewayGroup} {
		g.POST("/push", requireAuth, h.Push)
		g.POST("/pull", requireAuth, h.Pull)
	}
}

func (h *Handler) Push(c *gin.Context) {
	userIDStr := c.GetString(middleware.ContextUserIDKey)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}

	var req PushSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	resp, err := h.svc.Push(c.Request.Context(), userID, req)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, resp)
}

func (h *Handler) Pull(c *gin.Context) {
	userIDStr := c.GetString(middleware.ContextUserIDKey)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}

	var req PullSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	resp, err := h.svc.Pull(c.Request.Context(), userID, req)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, resp)
}
