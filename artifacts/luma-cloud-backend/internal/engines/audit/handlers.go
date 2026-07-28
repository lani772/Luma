package audit

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"time"

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
		g.GET("", requireAuth, h.List)
	}
}

func (h *Handler) List(c *gin.Context) {
	filters := QueryFilters{}

	if uStr := c.Query("userId"); uStr != "" {
		if parsed, err := uuid.Parse(uStr); err == nil {
			filters.UserID = &parsed
		}
	}
	if dID := c.Query("deviceId"); dID != "" {
		filters.DeviceID = &dID
	}
	if action := c.Query("action"); action != "" {
		filters.Action = &action
	}
	if resType := c.Query("resourceType"); resType != "" {
		filters.ResourceType = &resType
	}
	if startStr := c.Query("startDate"); startStr != "" {
		if parsed, err := time.Parse(time.RFC3339, startStr); err == nil {
			filters.StartDate = &parsed
		}
	}
	if endStr := c.Query("endDate"); endStr != "" {
		if parsed, err := time.Parse(time.RFC3339, endStr); err == nil {
			filters.EndDate = &parsed
		}
	}
	if result := c.Query("result"); result != "" {
		filters.Result = &result
	}
	if ip := c.Query("ipAddress"); ip != "" {
		filters.IPAddress = &ip
	}

	page, perPage := pagination(c)
	dtoList, total, err := h.svc.List(c.Request.Context(), filters, page, perPage)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OKPaginated(c, dtoList, httputil.Meta{
		Page:       page,
		PerPage:    perPage,
		TotalItems: total,
		TotalPages: httputil.TotalPages(total, perPage),
	})
}

func (h *Handler) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			c.Next()
			return
		}

		var bodyBytes []byte
		if c.Request.Body != nil {
			bodyBytes, _ = io.ReadAll(c.Request.Body)
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		c.Next()

		var actorID *string
		if userIDStr := c.GetString(middleware.ContextUserIDKey); userIDStr != "" {
			actorID = &userIDStr
		}

		status := "success"
		if c.Writer.Status() >= 400 {
			status = "failure"
		}

		ip := c.ClientIP()

		meta := map[string]any{
			"method": method,
			"path":   c.Request.URL.Path,
			"status": c.Writer.Status(),
			"result": status,
		}

		if len(bodyBytes) > 0 && len(bodyBytes) < 2048 {
			var bodyJSON map[string]any
			if err := c.ShouldBindJSON(&bodyJSON); err == nil {
				meta["payload"] = bodyJSON
			}
		}

		_, _ = h.svc.Record(c.Request.Context(), CreateAuditLogRequest{
			ActorUserID:  actorID,
			Action:       method + " " + c.Request.URL.Path,
			ResourceType: "api_gateway",
			Metadata:     meta,
			IPAddress:    &ip,
		})
	}
}

func pagination(c *gin.Context) (page, perPage int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ = strconv.Atoi(c.DefaultQuery("perPage", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	return page, perPage
}
