package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/httputil"
	"github.com/luma-smart-home/user-access-management-service/internal/middleware"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/dto"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) CreateRequest(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	var req dto.CreateAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	res, err := h.svc.CreateRequest(c.Request.Context(), actorID, req, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrOwnerAlreadyHasAccess) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusCreated, res)
}

func (h *Handler) ApproveRequest(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid request id", nil)
		return
	}

	err = h.svc.ApproveRequest(c.Request.Context(), actorID, id, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrRequestNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrRequestNotPending) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"id": idStr, "approved": true})
}

func (h *Handler) RejectRequest(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid request id", nil)
		return
	}

	err = h.svc.RejectRequest(c.Request.Context(), actorID, id, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrRequestNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrRequestNotPending) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"id": idStr, "rejected": true})
}

func (h *Handler) ListRequests(c *gin.Context) {
	var requesterPtr *uuid.UUID
	requesterQuery := c.Query("requesterId")
	if requesterQuery != "" {
		u, err := uuid.Parse(requesterQuery)
		if err == nil {
			requesterPtr = &u
		}
	}

	var ownerPtr *uuid.UUID
	ownerQuery := c.Query("ownerId")
	if ownerQuery != "" {
		u, err := uuid.Parse(ownerQuery)
		if err == nil {
			ownerPtr = &u
		}
	}

	var statusPtr *string
	statusQuery := c.Query("status")
	if statusQuery != "" {
		statusPtr = &statusQuery
	}

	res, err := h.svc.ListRequests(c.Request.Context(), requesterPtr, ownerPtr, statusPtr)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, res)
}
