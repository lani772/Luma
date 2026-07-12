package deployment

import (
	"net/http"
	"strconv"

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

func (h *Handler) RegisterRoutes(primaryGroup, gatewayGroup *gin.RouterGroup, requireAuth gin.HandlerFunc) {
	for _, g := range []*gin.RouterGroup{primaryGroup, gatewayGroup} {
		g.POST("", requireAuth, h.Create)
		g.GET("", requireAuth, h.List)
		g.GET("/:id", requireAuth, h.Get)
		g.POST("/:id/rollback", requireAuth, h.Rollback)
		g.POST("/:id/devices/:deviceId/retry", requireAuth, h.RetryDevice)
	}
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	dto, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusCreated, dto)
}

func (h *Handler) List(c *gin.Context) {
	page, perPage := pagination(c)
	dtoList, total, err := h.svc.List(page, perPage)
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

func (h *Handler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid campaign id", nil)
		return
	}

	dto, err := h.svc.Get(id)
	if err != nil {
		httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "deployment not found", nil)
		return
	}

	httputil.OK(c, http.StatusOK, dto)
}

func (h *Handler) Rollback(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid campaign id", nil)
		return
	}

	if err := h.svc.Rollback(id); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, gin.H{"rolledBack": true})
}

func (h *Handler) RetryDevice(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid campaign id", nil)
		return
	}

	deviceID, err := uuid.Parse(c.Param("deviceId"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid device id", nil)
		return
	}

	if err := h.svc.RetryDevice(id, deviceID); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, gin.H{"retrying": true})
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
