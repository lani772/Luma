package admin

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/luma-smart-home/cloud-backend/internal/httputil"
	"github.com/luma-smart-home/cloud-backend/internal/middleware"
	"github.com/luma-smart-home/cloud-backend/internal/models"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts all admin routes. The caller is responsible for
// applying RequireAuth + RequireRole("owner") before this group.
func (h *Handler) RegisterRoutes(r gin.IRoutes) {
	r.GET("/users", h.ListUsers)
	r.GET("/users/:userId", h.GetUser)
	r.PATCH("/users/:userId/role", h.UpdateRole)
	r.PATCH("/users/:userId/status", h.UpdateStatus)
	r.DELETE("/users/:userId", h.ForceDeleteUser)
	r.GET("/audit", h.ListAuditLogs)
}

// actor extracts the acting user's ID and role from the Gin context (set by
// RequireAuth + RequireRole middleware).
func actor(c *gin.Context) (uuid.UUID, string, bool) {
	id, err := uuid.Parse(c.GetString(middleware.ContextUserIDKey))
	if err != nil {
		httputil.Fail(c, http.StatusUnauthorized, httputil.ErrUnauthorized, "invalid user context", nil)
		return uuid.UUID{}, "", false
	}
	role, _ := c.Get("authRole")
	roleStr, _ := role.(string)
	return id, roleStr, true
}

func targetUserID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, "invalid user id", nil)
		return uuid.UUID{}, false
	}
	return id, true
}

func pagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("perPage", "20"))
	return page, perPage
}

// ListUsers godoc
// GET /cloud/admin/users?role=admin&status=active&page=1&perPage=20
func (h *Handler) ListUsers(c *gin.Context) {
	role := c.Query("role")
	status := c.Query("status")
	page, perPage := pagination(c)

	users, total, err := h.svc.ListUsers(c.Request.Context(), role, status, page, perPage)
	if err != nil {
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to list users", nil)
		return
	}
	httputil.OKPaginated(c, users, httputil.Meta{
		Page:       page,
		PerPage:    perPage,
		TotalItems: total,
		TotalPages: httputil.TotalPages(total, perPage),
	})
}

// GetUser godoc
// GET /cloud/admin/users/:userId
func (h *Handler) GetUser(c *gin.Context) {
	targetID, ok := targetUserID(c)
	if !ok {
		return
	}
	user, err := h.svc.GetUser(c.Request.Context(), targetID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "user not found", nil)
			return
		}
		httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to get user", nil)
		return
	}
	httputil.OK(c, http.StatusOK, user)
}

// UpdateRole godoc
// PATCH /cloud/admin/users/:userId/role
// Body: {"role": "admin"}
func (h *Handler) UpdateRole(c *gin.Context) {
	actorID, actorRole, ok := actor(c)
	if !ok {
		return
	}
	targetID, ok := targetUserID(c)
	if !ok {
		return
	}
	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	err := h.svc.UpdateRole(c.Request.Context(), actorID, actorRole, c.ClientIP(), targetID, models.UserRole(req.Role))
	if err != nil {
		switch {
		case errors.Is(err, ErrUserNotFound):
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "user not found", nil)
		case errors.Is(err, ErrCannotTargetSelf):
			httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		case errors.Is(err, ErrCannotDowngradeOwner):
			httputil.Fail(c, http.StatusForbidden, httputil.ErrForbidden, err.Error(), nil)
		default:
			httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to update role", nil)
		}
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"updated": true})
}

// UpdateStatus godoc
// PATCH /cloud/admin/users/:userId/status
// Body: {"status": "suspended"} or {"status": "active"}
func (h *Handler) UpdateStatus(c *gin.Context) {
	actorID, actorRole, ok := actor(c)
	if !ok {
		return
	}
	targetID, ok := targetUserID(c)
	if !ok {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	err := h.svc.UpdateStatus(c.Request.Context(), actorID, actorRole, c.ClientIP(), targetID, models.UserStatus(req.Status))
	if err != nil {
		switch {
		case errors.Is(err, ErrUserNotFound):
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "user not found", nil)
		case errors.Is(err, ErrCannotTargetSelf):
			httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		default:
			httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to update status", nil)
		}
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"updated": true})
}

// ForceDeleteUser godoc
// DELETE /cloud/admin/users/:userId
// Permanently removes the user and all their sessions, phones, and device admin grants.
// The caller should verify device ownership transfer is done before calling this.
func (h *Handler) ForceDeleteUser(c *gin.Context) {
	actorID, actorRole, ok := actor(c)
	if !ok {
		return
	}
	targetID, ok := targetUserID(c)
	if !ok {
		return
	}
	err := h.svc.ForceDelete(c.Request.Context(), actorID, actorRole, c.ClientIP(), targetID)
	if err != nil {
		switch {
		case errors.Is(err, ErrUserNotFound):
			httputil.Fail(c, http.StatusNotFound, httputil.ErrNotFound, "user not found", nil)
		case errors.Is(err, ErrCannotTargetSelf):
			httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		default:
			httputil.Fail(c, http.StatusInternalServerError, httputil.ErrInternal, "failed to delete user", nil)
		}
		return
	}
	httputil.OK(c, http.StatusOK, gin.H{"deleted": true})
}

// ListAuditLogs godoc
// GET /cloud/admin/audit?actor_id=<uuid>&target_id=<uuid>&action=user.role_changed&page=1&perPage=20
func (h *Handler) ListAuditLogs(c *gin.Context) {
	actorFilter := c.Query("actor_id")
	targetFilter := c.Query("target_id")
	action := c.Query("action")
	page, perPage := pagination(c)

	entries, total, err := h.svc.ListAuditLogs(c.Request.Context(), actorFilter, targetFilter, action, page, perPage)
	if err != nil {
		httputil.Fail(c, http.StatusBadRequest, httputil.ErrValidation, err.Error(), nil)
		return
	}
	httputil.OKPaginated(c, entries, httputil.Meta{
		Page:       page,
		PerPage:    perPage,
		TotalItems: total,
		TotalPages: httputil.TotalPages(total, perPage),
	})
}
