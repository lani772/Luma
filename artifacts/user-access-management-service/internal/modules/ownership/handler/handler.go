package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/user-access-management-service/internal/httputil"
	"github.com/luma-smart-home/user-access-management-service/internal/middleware"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/dto"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RequestTransfer(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	var req dto.RequestTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	res, err := h.svc.RequestTransfer(c.Request.Context(), actorID, req, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrDuplicatePendingTransfer) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrUserNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusCreated, res)
}

func (h *Handler) AcceptTransfer(c *gin.Context) {
	actorIDStr, _ := c.Get(middleware.ContextUserIDKey)
	actorID, _ := uuid.Parse(actorIDStr.(string))

	// Get recipient's email from claims or query
	recipientEmail := c.Query("email") // In real flow, this could come from auth token claims or user profile.
	if recipientEmail == "" {
		recipientEmail = "newowner@example.com" // fallback or mock testing
	}

	var req dto.AcceptTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	transferID, err := uuid.Parse(req.TransferID)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid transfer id", nil)
		return
	}

	err = h.svc.AcceptTransfer(c.Request.Context(), actorID, recipientEmail, transferID, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrTransferNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrTransferNotPending) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"transferId": req.TransferID, "accepted": true})
}

func (h *Handler) RejectTransfer(c *gin.Context) {
	recipientEmail := c.Query("email")
	if recipientEmail == "" {
		recipientEmail = "newowner@example.com"
	}

	var req dto.RejectTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	transferID, err := uuid.Parse(req.TransferID)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid transfer id", nil)
		return
	}

	err = h.svc.RejectTransfer(c.Request.Context(), recipientEmail, transferID, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUnauthorized) {
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrTransferNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		if errors.Is(err, service.ErrTransferNotPending) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrConflict, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"transferId": req.TransferID, "rejected": true})
}

func (h *Handler) EmergencyRecovery(c *gin.Context) {
	// Require global admin role (owner or high-level platform administrator override)
	globalRole, _ := c.Get(middleware.ContextUserRoleKey)
	if globalRole != "owner" && globalRole != "admin" {
		httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, "emergency recovery requires admin authority", nil)
		return
	}

	var req struct {
		MicrocontrollerID   string `json:"microcontrollerId" binding:"required"`
		NewOwnerEmail       string `json:"newOwnerEmail" binding:"required,email"`
		VerificationDetails string `json:"verificationDetails" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}

	controllerID, err := uuid.Parse(req.MicrocontrollerID)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid microcontroller id", nil)
		return
	}

	err = h.svc.EmergencyRecovery(c.Request.Context(), controllerID, req.NewOwnerEmail, req.VerificationDetails, c.ClientIP())
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, map[string]any{"microcontrollerId": req.MicrocontrollerID, "recovered": true})
}

func (h *Handler) ListTransfers(c *gin.Context) {
	var mcPtr *uuid.UUID
	mcQuery := c.Query("microcontrollerId")
	if mcQuery != "" {
		mc, err := uuid.Parse(mcQuery)
		if err == nil {
			mcPtr = &mc
		}
	}

	var emailPtr *string
	emailQuery := c.Query("newOwnerEmail")
	if emailQuery != "" {
		emailPtr = &emailQuery
	}

	var statusPtr *string
	statusQuery := c.Query("status")
	if statusQuery != "" {
		statusPtr = &statusQuery
	}

	res, err := h.svc.ListTransfers(c.Request.Context(), mcPtr, emailPtr, statusPtr)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, err.Error(), nil)
		return
	}

	httputil.OK(c, http.StatusOK, res)
}
