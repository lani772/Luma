package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/httputil"
	"github.com/luma-smart-home/user-access-management-service/internal/middleware"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/dto"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GrantPermission(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	var actorID uuid.UUID
	if actorIDStr != nil {
		actorID, _ = uuid.Parse(actorIDStr.(string))
	}

	var req dto.GrantPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	res, err := h.svc.GrantPermission(c.Request.Context(), actorID, req, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusCreated, res)
}

func (h *Handler) BulkGrantPermissions(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	var actorID uuid.UUID
	if actorIDStr != nil {
		actorID, _ = uuid.Parse(actorIDStr.(string))
	}

	var reqs []dto.GrantPermissionRequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	res, err := h.svc.BulkGrantPermissions(c.Request.Context(), actorID, reqs, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusCreated, res)
}

func (h *Handler) EmergencyRevoke(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	targetUserID := c.Query("userId")
	controllerID := c.Query("microcontrollerId")
	if controllerID == "" {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "microcontrollerId query param is required", nil)
		return
	}

	err := h.svc.EmergencyRevoke(c.Request.Context(), actorID, targetUserID, controllerID, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"revoked": true})
}

func (h *Handler) CheckPermission(c *gin.Context) {
	var req dto.CheckPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	res, err := h.svc.CheckPermission(c.Request.Context(), req)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, res)
}

func (h *Handler) RevokePermission(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid permission id", nil)
		return
	}

	err = h.svc.RevokePermission(c.Request.Context(), actorID, id, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrPermissionNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"id": idStr, "removed": true})
}

func (h *Handler) ListPermissions(c *gin.Context) {
	var userPtr, controllerPtr *uuid.UUID

	userQuery := c.Query("userId")
	if userQuery != "" {
		u, err := uuid.Parse(userQuery)
		if err == nil {
			userPtr = &u
		}
	}

	controllerQuery := c.Query("microcontrollerId")
	if controllerQuery != "" {
		mc, err := uuid.Parse(controllerQuery)
		if err == nil {
			controllerPtr = &mc
		}
	}

	var resourceID, resourceType, status *string
	if rQuery := c.Query("resourceId"); rQuery != "" {
		resourceID = &rQuery
	}
	if tQuery := c.Query("resourceType"); tQuery != "" {
		resourceType = &tQuery
	}
	if sQuery := c.Query("status"); sQuery != "" {
		status = &sQuery
	}

	res, err := h.svc.ListPermissions(c.Request.Context(), userPtr, controllerPtr, resourceID, resourceType, status)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, res)
}
