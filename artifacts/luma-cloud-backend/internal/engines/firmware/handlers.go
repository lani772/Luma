package firmware

import (
	"errors"
	"io"
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
	// Primary groups:
	// POST /cloud/firmware/upload
	// GET /cloud/firmware
	// GET /cloud/firmware/:id
	// DELETE /cloud/firmware/:id
	// POST /cloud/firmware/:id/publish
	// POST /cloud/firmware/:id/archive
	// GET /cloud/firmware/:id/download
	// GET /cloud/firmware/compare

	// Gateway aliases:
	// Same endpoints under /cloud/api/engines/firmware/...

	for _, g := range []*gin.RouterGroup{primaryGroup, gatewayGroup} {
		g.POST("/upload", requireAuth, h.Upload)
		g.GET("", requireAuth, h.List)
		g.GET("/compare", requireAuth, h.Compare)
		g.GET("/:id", requireAuth, h.Get)
		g.DELETE("/:id", requireAuth, h.Delete)
		g.POST("/:id/publish", requireAuth, h.Publish)
		g.POST("/:id/archive", requireAuth, h.Archive)
		g.GET("/:id/download", h.Download) // Don't enforce token strictly on raw hardware download, or allow optional device query
	}
}

func (h *Handler) Upload(c *gin.Context) {
	userIDStr := c.GetString(middleware.ContextUserIDKey)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}

	var req UploadFirmwareRequest
	if err := c.ShouldBind(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "file is required", nil)
		return
	}
	defer file.Close()

	dto, err := h.svc.Upload(c.Request.Context(), userID, header.Filename, req, file)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidVersion), errors.Is(err, ErrInvalidExtension):
			httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		case errors.Is(err, ErrTooLarge):
			httputil.Fail(c, http.StatusRequestEntityTooLarge, httputil.ErrValidation, err.Error(), nil)
		case errors.Is(err, ErrDuplicateVersion):
			httputil.Fail(c, http.StatusConflict, httputil.ErrValidation, err.Error(), nil)
		default:
			httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		}
		return
	}

	httputil.OK(c, http.StatusCreated, dto)
}

func (h *Handler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid firmware id", nil)
		return
	}

	dto, err := h.svc.Get(id)
	if err != nil {
		httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "firmware release not found", nil)
		return
	}

	httputil.OK(c, http.StatusOK, dto)
}

func (h *Handler) List(c *gin.Context) {
	deviceType := c.Query("deviceType")
	channel := c.Query("channel")
	page, perPage := pagination(c)

	dtoList, total, err := h.svc.List(deviceType, channel, page, perPage)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to list firmware", nil)
		return
	}

	httputil.OKPaginated(c, dtoList, httputil.Meta{
		Page:       page,
		PerPage:    perPage,
		TotalItems: total,
		TotalPages: httputil.TotalPages(total, perPage),
	})
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid firmware id", nil)
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, gin.H{"deleted": true})
}

func (h *Handler) Publish(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid firmware id", nil)
		return
	}

	var req PublishFirmwareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	dto, err := h.svc.Publish(id, req.Channel)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, dto)
}

func (h *Handler) Archive(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid firmware id", nil)
		return
	}

	var req ArchiveFirmwareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	dto, err := h.svc.Archive(id, req.IsRollbackTarget)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, dto)
}

func (h *Handler) Download(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid firmware id", nil)
		return
	}

	var deviceID *uuid.UUID
	if devStr := c.Query("deviceId"); devStr != "" {
		if parsedDev, err := uuid.Parse(devStr); err == nil {
			deviceID = &parsedDev
		}
	}

	ipAddr := c.ClientIP()

	reader, storagePath, err := h.svc.Download(c.Request.Context(), id, deviceID, &ipAddr)
	if err != nil {
		httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "firmware binary not found", nil)
		return
	}
	defer reader.Close()

	c.Header("Content-Disposition", "attachment; filename="+strconv.Quote(storagePath))
	c.Header("Content-Type", "application/octet-stream")
	_, _ = io.Copy(c.Writer, reader)
}

func (h *Handler) Compare(c *gin.Context) {
	deviceType := c.Query("deviceType")
	currentVersion := c.Query("currentVersion")
	channel := c.DefaultQuery("channel", "stable")

	if deviceType == "" || currentVersion == "" {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "deviceType and currentVersion are required", nil)
		return
	}

	dto, err := h.svc.Compare(deviceType, currentVersion, channel)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, dto)
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
