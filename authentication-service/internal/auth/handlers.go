package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/authentication-service/internal/middleware"
	"github.com/luma-smart-home/authentication-service/internal/users"
)

type Handlers struct {
	authService *Service
	userService *users.UserService
}

func NewHandlers(authService *Service, userService *users.UserService) *Handlers {
	return &Handlers{
		authService: authService,
		userService: userService,
	}
}

// 1. POST /auth/register
type RegisterReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Username string `json:"username"`
	Phone    string `json:"phone"`
	DeviceID string `json:"device_id" binding:"required"`
}

func (h *Handlers) Register(c *gin.Context) {
	var req RegisterReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	user, err := h.authService.Register(c.Request.Context(), req.Email, req.Password, req.Username, req.Phone, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		code := "CONFLICT"
		if err == ErrDuplicateEmail || err == ErrDuplicateUsername {
			code = "CONFLICT"
		}
		c.JSON(http.StatusConflict, gin.H{"success": false, "error": gin.H{"code": code, "message": err.Error()}})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"user": user,
			"note": "A verification email has been sent to " + user.Email + ". Please verify your email before logging in.",
		},
	})
}

// 2. POST /auth/login
type LoginReq struct {
	EmailOrUsername string `json:"email_or_username" binding:"required"`
	Password        string `json:"password" binding:"required"`
	DeviceID        string `json:"device_id" binding:"required"`
}

func (h *Handlers) Login(c *gin.Context) {
	var req LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	res, err := h.authService.Login(c.Request.Context(), req.EmailOrUsername, req.Password, req.DeviceID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		status := http.StatusUnauthorized
		code := "UNAUTHORIZED"
		if err.Error() == "account is temporarily locked due to too many failed login attempts" {
			status = http.StatusForbidden
			code = "ACCOUNT_LOCKED"
		}
		c.JSON(status, gin.H{"success": false, "error": gin.H{"code": code, "message": err.Error()}})
		return
	}

	if res.StepUpRequired {
		c.JSON(http.StatusAccepted, gin.H{
			"success": true,
			"data": gin.H{
				"step_up_required": true,
				"step_up_token":    res.StepUpToken,
				"message":          "High risk login detected. An OTP verification code has been dispatched to your email address.",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user":          res.User,
			"access_token":  res.AccessToken,
			"refresh_token": res.RefreshToken,
			"expires_in":    res.ExpiresIn,
			"session_id":    res.Session.ID,
		},
	})
}

// 2b. POST /auth/login/step-up
type StepUpReq struct {
	EmailOrUsername string `json:"email_or_username" binding:"required"`
	Code            string `json:"code" binding:"required"`
	DeviceID        string `json:"device_id" binding:"required"`
}

func (h *Handlers) StepUpVerify(c *gin.Context) {
	var req StepUpReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	res, err := h.authService.FinalizeStepUpLogin(c.Request.Context(), req.EmailOrUsername, req.Code, req.DeviceID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user":          res.User,
			"access_token":  res.AccessToken,
			"refresh_token": res.RefreshToken,
			"expires_in":    res.ExpiresIn,
			"session_id":    res.Session.ID,
		},
	})
}

// 3. POST /auth/logout
func (h *Handlers) Logout(c *gin.Context) {
	sessionIDStr, exists := c.Get(middleware.ContextSessionIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "unauthorized session context"}})
		return
	}

	sessionID, err := uuid.Parse(sessionIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "invalid session uuid"}})
		return
	}

	if err := h.authService.Logout(sessionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": "successfully logged out and session revoked"})
}

// 4. POST /auth/refresh
type RefreshReq struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *Handlers) Refresh(c *gin.Context) {
	var req RefreshReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	res, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"access_token":  res.AccessToken,
			"refresh_token": res.RefreshToken,
			"expires_in":    res.ExpiresIn,
		},
	})
}

// 5. POST /auth/email/send
func (h *Handlers) SendEmailVerify(c *gin.Context) {
	userIDStr, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "missing authorization context"}})
		return
	}

	userID, _ := uuid.Parse(userIDStr.(string))
	if err := h.authService.SendEmailVerification(c.Request.Context(), userID, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": "verification tokens successfully dispatched"})
}

// 6. POST /auth/email/verify
type EmailVerifyReq struct {
	MagicLinkToken string `json:"magic_link_token"`
	OTPCode        string `json:"otp_code"`
}

func (h *Handlers) EmailVerify(c *gin.Context) {
	userIDStr, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "missing authorization context"}})
		return
	}

	var req EmailVerifyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	userID, _ := uuid.Parse(userIDStr.(string))
	verified, err := h.authService.VerifyEmail(c.Request.Context(), userID, req.MagicLinkToken, req.OTPCode, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"verified": verified}})
}

// 7. POST /auth/password/forgot
type ForgotPasswordReq struct {
	Email string `json:"email" binding:"required,email"`
}

func (h *Handlers) ForgotPassword(c *gin.Context) {
	var req ForgotPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	_ = h.authService.ForgotPassword(c.Request.Context(), req.Email, c.ClientIP(), c.Request.UserAgent())

	// Safe envelope response preventing discovery
	c.JSON(http.StatusOK, gin.H{"success": true, "data": "If a matching profile exists, password reset details have been sent."})
}

// 8. POST /auth/password/reset
type ResetPasswordReq struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

func (h *Handlers) ResetPassword(c *gin.Context) {
	var req ResetPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	if err := h.authService.ResetPassword(c.Request.Context(), req.Token, req.NewPassword, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": "password reset successfully and old sessions invalidated"})
}

// 9. POST /auth/google/login
type GoogleLoginReq struct {
	IDToken  string `json:"id_token" binding:"required"`
	DeviceID string `json:"device_id" binding:"required"`
}

func (h *Handlers) GoogleLogin(c *gin.Context) {
	var req GoogleLoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	res, err := h.authService.LoginWithGoogle(c.Request.Context(), req.IDToken, req.DeviceID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user":          res.User,
			"access_token":  res.AccessToken,
			"refresh_token": res.RefreshToken,
			"expires_in":    res.ExpiresIn,
		},
	})
}

// 10. GET /auth/me
func (h *Handlers) Me(c *gin.Context) {
	userIDStr, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "unauthorized profile query"}})
		return
	}

	userID, _ := uuid.Parse(userIDStr.(string))
	user, err := h.userService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "user profile not found"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": user})
}

// INTERNAL APIS
// 11. POST /internal/token/verify
type TokenVerifyReq struct {
	Token string `json:"token" binding:"required"`
}

func (h *Handlers) InternalTokenVerify(c *gin.Context) {
	var req TokenVerifyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	// Verify JWT cryptographically
	claims, err := h.authService.tokenManager.VerifyUserAccessToken(req.Token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": err.Error()}})
		return
	}

	// Simple check if blacklisted
	if h.authService.blacklist.IsRevoked(claims.SessionID) {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "TOKEN_REVOKED", "message": "token has been revoked"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": claims})
}

// 12. POST /internal/token/introspect
func (h *Handlers) InternalTokenIntrospect(c *gin.Context) {
	h.InternalTokenVerify(c)
}

// 13. POST /internal/service/token
type ServiceTokenReq struct {
	ClientID     string `json:"client_id" binding:"required"`
	ClientSecret string `json:"client_secret" binding:"required"`
}

func (h *Handlers) InternalServiceToken(c *gin.Context) {
	var req ServiceTokenReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	token, expiresAt, err := h.authService.AuthenticateService(req.ClientID, req.ClientSecret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"access_token": token,
			"expires_at":   expiresAt,
			"token_type":   "Bearer",
		},
	})
}

// 14. POST /internal/service/verify
func (h *Handlers) InternalServiceVerify(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "missing authorization header"}})
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := h.authService.tokenManager.VerifyServiceToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": claims})
}

// 15. POST /internal/session/revoke
type RevokeSessionReq struct {
	SessionID string `json:"session_id" binding:"required"`
}

func (h *Handlers) InternalSessionRevoke(c *gin.Context) {
	var req RevokeSessionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	sid, err := uuid.Parse(req.SessionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "invalid session UUID"}})
		return
	}

	if err := h.authService.Logout(sid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": "session revoked successfully"})
}

// 16. GET /internal/users/{id}
func (h *Handlers) InternalGetUserID(c *gin.Context) {
	idStr := c.Param("id")
	uid, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "invalid user UUID"}})
		return
	}

	user, err := h.userService.GetProfile(uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "user not found"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": user})
}
