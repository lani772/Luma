package devices

import (
	"errors"
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

func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	r.POST("", h.Register)
	r.GET("", h.List)
	r.GET("/:deviceId", h.access(), h.Get)
	r.PATCH("/:deviceId", h.access(), h.Update)
	r.DELETE("/:deviceId", h.ownerOnly(), h.Remove)
	r.POST("/:deviceId/transfer-ownership", h.ownerOnly(), h.TransferOwnership)
	r.POST("/:deviceId/admins", h.ownerOnly(), h.GrantAdmin)
	r.DELETE("/:deviceId/admins/:userId", h.ownerOnly(), h.RevokeAdmin)
	r.GET("/:deviceId/history", h.access(), h.History)
}

func actor(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.GetString(middleware.ContextUserIDKey))
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return uuid.UUID{}, false
	}
	return id, true
}

func deviceIDParam(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("deviceId"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid device id", nil)
		return uuid.UUID{}, false
	}
	return id, true
}

// access requires the caller to be the device's owner or an admin.
func (h *Handler) access() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := actor(c)
		if !ok {
			return
		}
		deviceID, ok := deviceIDParam(c)
		if !ok {
			return
		}
		allowed, err := h.svc.CanAccess(deviceID, userID)
		if err != nil {
			httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to check access", nil)
			return
		}
		if !allowed {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, "you do not have access to this device", nil)
			return
		}
		c.Next()
	}
}

// ownerOnly requires the caller to be the device's registered owner.
func (h *Handler) ownerOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := actor(c)
		if !ok {
			return
		}
		deviceID, ok := deviceIDParam(c)
		if !ok {
			return
		}
		device, err := h.svc.Get(deviceID)
		if err != nil {
			if errors.Is(err, ErrDeviceNotFound) {
				httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "device not found", nil)
				return
			}
			httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to load device", nil)
			return
		}
		if device.OwnerID != userID.String() {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, "only the device owner can perform this action", nil)
			return
		}
		c.Next()
	}
}

func (h *Handler) Register(c *gin.Context) {
	userID, ok := actor(c)
	if !ok {
		return
	}
	var req RegisterDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	device, err := h.svc.Register(userID, req, c.ClientIP())
	if err != nil {
		if errors.Is(err, ErrDeviceAlreadyRegistered) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrDeviceExists, "a device with this MAC address is already registered", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to register device", nil)
		return
	}
	httputil.OK(c, http.StatusCreated, device)
}

func (h *Handler) List(c *gin.Context) {
	userID, ok := actor(c)
	if !ok {
		return
	}
	page, perPage := pagination(c)
	deviceList, total, err := h.svc.List(userID, page, perPage)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to list devices", nil)
		return
	}
	httputil.OKPaginated(c, deviceList, httputil.Meta{Page: page, PerPage: perPage, TotalItems: total, TotalPages: httputil.TotalPages(total, perPage)})
}

func (h *Handler) Get(c *gin.Context) {
	deviceID, ok := deviceIDParam(c)
	if !ok {
		return
	}
	device, err := h.svc.Get(deviceID)
	if err != nil {
		httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "device not found", nil)
		return
	}
	httputil.OK(c, http.StatusOK, device)
}

func (h *Handler) Update(c *gin.Context) {
	userID, ok := actor(c)
	if !ok {
		return
	}
	deviceID, ok := deviceIDParam(c)
	if !ok {
		return
	}
	var req UpdateDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	device, err := h.svc.Update(deviceID, userID, req, c.ClientIP())
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to update device", nil)
		return
	}
	httputil.OK(c, http.StatusOK, device)
}

func (h *Handler) Remove(c *gin.Context) {
	userID, ok := actor(c)
	if !ok {
		return
	}
	deviceID, ok := deviceIDParam(c)
	if !ok {
		return
	}
	if err := h.svc.Remove(deviceID, userID, c.ClientIP()); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to remove device", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"removed": true})
}

func (h *Handler) TransferOwnership(c *gin.Context) {
	userID, ok := actor(c)
	if !ok {
		return
	}
	deviceID, ok := deviceIDParam(c)
	if !ok {
		return
	}
	var req TransferOwnershipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	device, err := h.svc.TransferOwnership(deviceID, userID, req.NewOwnerEmail, c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, ErrUserNotFound):
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "no account found for that email", nil)
		case errors.Is(err, ErrNotOwner):
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, "only the device owner can transfer ownership", nil)
		case errors.Is(err, ErrDeviceNotFound):
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "device not found", nil)
		default:
			httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to transfer ownership", nil)
		}
		return
	}
	httputil.OK(c, http.StatusOK, device)
}

func (h *Handler) GrantAdmin(c *gin.Context) {
	userID, ok := actor(c)
	if !ok {
		return
	}
	deviceID, ok := deviceIDParam(c)
	if !ok {
		return
	}
	var req GrantAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	if err := h.svc.GrantAdmin(deviceID, userID, req.UserEmail, c.ClientIP()); err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "no account found for that email", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to grant admin", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"granted": true})
}

func (h *Handler) RevokeAdmin(c *gin.Context) {
	userID, ok := actor(c)
	if !ok {
		return
	}
	deviceID, ok := deviceIDParam(c)
	if !ok {
		return
	}
	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid user id", nil)
		return
	}
	if err := h.svc.RevokeAdmin(deviceID, userID, targetID, c.ClientIP()); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to revoke admin", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"revoked": true})
}

func (h *Handler) History(c *gin.Context) {
	deviceID, ok := deviceIDParam(c)
	if !ok {
		return
	}
	page, perPage := pagination(c)
	entries, total, err := h.svc.History(deviceID, page, perPage)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to load history", nil)
		return
	}
	httputil.OKPaginated(c, entries, httputil.Meta{Page: page, PerPage: perPage, TotalItems: total, TotalPages: httputil.TotalPages(total, perPage)})
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
