package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/httputil"
	"github.com/luma-smart-home/user-access-management-service/internal/middleware"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/dto"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) CreateInvitation(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	var req dto.CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	res, err := h.svc.CreateInvitation(c.Request.Context(), actorID, req, c.ClientIP())
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

func (h *Handler) AcceptInvitation(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid invitation id", nil)
		return
	}

	err = h.svc.AcceptInvitation(c.Request.Context(), actorID, id, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrInvitationNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrInvitationNotPending) || errors.Is(err, service.ErrInvitationExpired) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"id": idStr, "accepted": true})
}

func (h *Handler) RejectInvitation(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid invitation id", nil)
		return
	}

	err = h.svc.RejectInvitation(c.Request.Context(), actorID, id, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrInvitationNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrInvitationNotPending) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"id": idStr, "rejected": true})
}

func (h *Handler) ListInvitations(c *gin.Context) {
	var senderPtr *uuid.UUID
	senderQuery := c.Query("senderId")
	if senderQuery != "" {
		u, err := uuid.Parse(senderQuery)
		if err == nil {
			senderPtr = &u
		}
	}

	var emailPtr *string
	emailQuery := c.Query("recipientEmail")
	if emailQuery != "" {
		emailPtr = &emailQuery
	}

	var statusPtr *string
	statusQuery := c.Query("status")
	if statusQuery != "" {
		statusPtr = &statusQuery
	}

	res, err := h.svc.ListInvitations(c.Request.Context(), senderPtr, emailPtr, statusPtr)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, res)
}
