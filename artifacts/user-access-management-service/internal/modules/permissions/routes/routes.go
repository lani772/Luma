package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/permissions/handler"
)

func RegisterRoutes(g *gin.RouterGroup, h *handler.Handler) {
	perms := g.Group("/permissions")
	{
		perms.POST("/grant", h.GrantPermission)
		perms.POST("/bulk-grant", h.BulkGrantPermissions)
		perms.POST("/emergency-revoke", h.EmergencyRevoke)
		perms.POST("/check", h.CheckPermission)
		perms.GET("", h.ListPermissions)
		perms.DELETE("/:id", h.RevokePermission)
	}
}
