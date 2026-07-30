package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/httputil"
	"github.com/luma-smart-home/user-access-management-service/internal/middleware"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/roles/dto"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/roles/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) AssignRole(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	var actorID uuid.UUID
	if actorIDStr != nil {
		actorID, _ = uuid.Parse(actorIDStr.(string))
	}

	var req dto.AssignRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	res, err := h.svc.AssignRole(c.Request.Context(), actorID, req, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrOneOwnerOnly) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusCreated, res)
}

func (h *Handler) UpdateRole(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid role assignment id", nil)
		return
	}

	var req dto.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	res, err := h.svc.UpdateRole(c.Request.Context(), actorID, id, req, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrRoleNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, res)
}

func (h *Handler) RemoveRole(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid role assignment id", nil)
		return
	}

	err = h.svc.RemoveRole(c.Request.Context(), actorID, id, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrRoleNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"id": idStr, "removed": true})
}

func (h *Handler) ListRoles(c *gin.Context) {
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

	res, err := h.svc.ListRoles(c.Request.Context(), userPtr, controllerPtr)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, res)
}
