package auth

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

// RegisterRoutes mounts every Authentication Engine route under the given
// router group. Both the plain mobile-facing paths (POST /login, /register,
// ...) and the "/api/engines/auth/*" gateway-style aliases are wired to the
// exact same handlers, so either URL shape from the spec works identically.
func (h *Handler) RegisterRoutes(plain gin.IRoutes, engine gin.IRoutes, requireAuth gin.HandlerFunc) {
	for _, r := range []gin.IRoutes{plain, engine} {
		r.POST("/register", h.Register)
		r.POST("/login", h.Login)
		r.POST("/logout", h.Logout)
		r.POST("/refresh", h.Refresh)
		r.POST("/password-reset/request", h.RequestPasswordReset)
		r.POST("/password-reset/confirm", h.ConfirmPasswordReset)
		r.POST("/email-verification/confirm", h.ConfirmEmailVerification)
		r.GET("/profile", requireAuth, h.Profile)
		r.POST("/email-verification/request", requireAuth, h.RequestEmailVerification)
		r.GET("/sessions", requireAuth, h.ListSessions)
		r.POST("/sessions/revoke-others", requireAuth, h.RevokeOtherSessions)
	}
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	resp, err := h.svc.Register(req, c.ClientIP())
	if err != nil {
		if errors.Is(err, ErrEmailAlreadyRegistered) {
			httputil.Fail(c, http.StatusConflict, httputil.ErrEmailInUse, "an account with this email already exists", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to register", nil)
		return
	}
	httputil.OK(c, http.StatusCreated, resp)
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	resp, err := h.svc.Login(req, c.ClientIP())
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			httputil.Fail(c, http.StatusUnauthorized, httputil.ErrInvalidCredentials, "invalid email or password", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to login", nil)
		return
	}
	httputil.OK(c, http.StatusOK, resp)
}

func (h *Handler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	resp, err := h.svc.Refresh(req)
	if err != nil {
		if errors.Is(err, ErrTokenInvalidOrExpired) {
			httputil.Fail(c, http.StatusUnauthorized, httputil.ErrTokenExpired, "refresh token invalid or expired", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to refresh session", nil)
		return
	}
	httputil.OK(c, http.StatusOK, resp)
}

func (h *Handler) Logout(c *gin.Context) {
	var req LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	if err := h.svc.Logout(req.RefreshToken); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to logout", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"loggedOut": true})
}

func (h *Handler) Profile(c *gin.Context) {
	userID := c.GetString(middleware.ContextUserIDKey)
	profile, err := h.svc.Profile(userID)
	if err != nil {
		httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "user not found", nil)
		return
	}
	httputil.OK(c, http.StatusOK, profile)
}

func (h *Handler) ListSessions(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString(middleware.ContextUserIDKey))
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}
	sessions, err := h.svc.ListSessions(userID, c.GetString(middleware.ContextSessionIDKey))
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to list sessions", nil)
		return
	}
	httputil.OK(c, http.StatusOK, sessions)
}

func (h *Handler) RevokeOtherSessions(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString(middleware.ContextUserIDKey))
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}
	if err := h.svc.RevokeAllOtherSessions(userID, c.GetString(middleware.ContextSessionIDKey)); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to revoke sessions", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"revoked": true})
}

func (h *Handler) RequestPasswordReset(c *gin.Context) {
	var req RequestPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	if _, err := h.svc.RequestPasswordReset(req.Email); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to process request", nil)
		return
	}
	// Always 200 regardless of whether the email exists, to avoid account enumeration.
	httputil.OK(c, http.StatusOK, gin.H{"message": "if that email is registered, a reset link has been sent"})
}

func (h *Handler) ConfirmPasswordReset(c *gin.Context) {
	var req ConfirmPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	if err := h.svc.ConfirmPasswordReset(req); err != nil {
		if errors.Is(err, ErrTokenInvalidOrExpired) {
			httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "reset token invalid or expired", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to reset password", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"passwordReset": true})
}

func (h *Handler) RequestEmailVerification(c *gin.Context) {
	userID, err := uuid.Parse(c.GetString(middleware.ContextUserIDKey))
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return
	}
	if _, err := h.svc.RequestEmailVerification(userID); err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to request verification", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"message": "verification email sent"})
}

func (h *Handler) ConfirmEmailVerification(c *gin.Context) {
	var req ConfirmEmailVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	if err := h.svc.ConfirmEmailVerification(req.Token); err != nil {
		if errors.Is(err, ErrTokenInvalidOrExpired) {
			httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "verification token invalid or expired", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to verify email", nil)
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"emailVerified": true})
}
