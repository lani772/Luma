package users

import (
	"errors"
	"net/http"

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

func (h *Handler) RegisterRoutes(r gin.IRoutes) {
	r.GET("/me", h.GetAccount)
	r.PATCH("/me", h.UpdateProfile)
	r.DELETE("/me", h.DeleteAccount)
	r.PATCH("/me/preferences", h.UpdatePreferences)
	r.GET("/me/phones", h.ListPhones)
	r.DELETE("/me/phones/:phoneId", h.RemovePhone)
	r.GET("/me/devices", h.ListOwnedDevices)
}

func userID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.GetString(middleware.ContextUserIDKey))
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return uuid.UUID{}, false
	}
	return id, true
}

func (h *Handler) GetAccount(c *gin.Context) {
	id, ok := userID(c)
	if !ok {
		return
	}
	account, err := h.svc.GetAccount(id)
	if err != nil {
		httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "account not found", nil)
		return
	}
	httputil.OK(c, http.StatusOK, account)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	id, ok := userID(c)
	if !ok {
		return
	}
	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	account, err := h.svc.UpdateProfile(id, req)
	if err != nil {
		if errors.Is(err, ErrUsernameTaken) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrUsernameInUse, "that username is already taken", nil)
			return
		}
		if errors.Is(err, ErrInvalidUsername) {
			httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to update profile", nil)
		return
	}
	httputil.OK(c, http.StatusOK, account)
}

func (h *Handler) DeleteAccount(c *gin.Context) {
	id, ok := userID(c)
	if !ok {
		return
	}
	var req DeleteAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	if err := h.svc.DeleteAccount(id, req.Password); err != nil {
		if errors.Is(err, ErrWrongPassword) {
			httputil.Fail(c, http.StatusUnauthorized, httputil.ErrInvalidCredentials, "incorrect password", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to delete account", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"deleted": true})
}

func (h *Handler) UpdatePreferences(c *gin.Context) {
	id, ok := userID(c)
	if !ok {
		return
	}
	var req UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	account, err := h.svc.UpdatePreferences(id, req.Preferences)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to update preferences", nil)
		return
	}
	httputil.OK(c, http.StatusOK, account)
}

func (h *Handler) ListPhones(c *gin.Context) {
	id, ok := userID(c)
	if !ok {
		return
	}
	phones, err := h.svc.ListPhones(id)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to list phones", nil)
		return
	}
	httputil.OK(c, http.StatusOK, phones)
}

func (h *Handler) RemovePhone(c *gin.Context) {
	id, ok := userID(c)
	if !ok {
		return
	}
	phoneID, err := uuid.Parse(c.Param("phoneId"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid phone id", nil)
		return
	}
	if err := h.svc.RemovePhone(id, phoneID); err != nil {
		if errors.Is(err, ErrPhoneNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "phone not found", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to remove phone", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"removed": true})
}

func (h *Handler) ListOwnedDevices(c *gin.Context) {
	id, ok := userID(c)
	if !ok {
		return
	}
	devices, err := h.svc.ListOwnedDevices(id)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to list devices", nil)
		return
	}
	httputil.OK(c, http.StatusOK, devices)
}
