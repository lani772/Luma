package backup

import (
	"net/http"
	"strconv"

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
		g.POST("", requireAuth, h.Create)
		g.GET("", requireAuth, h.List)
		g.POST("/:id/restore", requireAuth, h.Restore)
		g.DELETE("/:id", requireAuth, h.Delete)
	}
}

func (h *Handler) Create(c *gin.Context) {
	userIDStr := c.GetString(middleware.ContextUserIDKey)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}

	dto, err := h.svc.Create(c.Request.Context(), userID)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusCreated, dto)
}

func (h *Handler) List(c *gin.Context) {
	userIDStr := c.GetString(middleware.ContextUserIDKey)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}

	page, perPage := pagination(c)
	dtoList, total, err := h.svc.List(userID, page, perPage)
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

func (h *Handler) Restore(c *gin.Context) {
	userIDStr := c.GetString(middleware.ContextUserIDKey)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}

	backupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid backup id", nil)
		return
	}

	var req RestoreBackupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	if err := h.svc.Restore(c.Request.Context(), userID, backupID, req); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, gin.H{"restored": true})
}

func (h *Handler) Delete(c *gin.Context) {
	userIDStr := c.GetString(middleware.ContextUserIDKey)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid backup id", nil)
		return
	}

	if err := h.svc.Delete(c.Request.Context(), userID, id); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, gin.H{"deleted": true})
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
