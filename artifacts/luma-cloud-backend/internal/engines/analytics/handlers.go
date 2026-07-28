package analytics

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
		g.POST("/events", h.Ingest)
		g.GET("/dashboard", requireAuth, h.Dashboard)
	}
}

func (h *Handler) Ingest(c *gin.Context) {
	var userID *uuid.UUID
	if userIDStr := c.GetString(middleware.ContextUserIDKey); userIDStr != "" {
		if parsed, err := uuid.Parse(userIDStr); err == nil {
			userID = &parsed
		}
	}

	var req IngestEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	event, err := h.svc.Ingest(c.Request.Context(), userID, req)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusCreated, event)
}

func (h *Handler) Dashboard(c *gin.Context) {
	deviceIDStr := c.Query("deviceId")
	period := c.DefaultQuery("period", "weekly")

	if deviceIDStr == "" {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "deviceId is required", nil)
		return
	}

	deviceID, err := uuid.Parse(deviceIDStr)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid deviceId", nil)
		return
	}

	dto, err := h.svc.QueryDashboard(c.Request.Context(), deviceID, period)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, dto)
}
