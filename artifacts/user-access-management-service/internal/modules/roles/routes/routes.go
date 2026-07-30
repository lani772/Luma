package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/roles/handler"
)

func RegisterRoutes(g *gin.RouterGroup, h *handler.Handler) {
	roles := g.Group("/roles")
	{
		roles.POST("/assign", h.AssignRole)
		roles.GET("", h.ListRoles)
		roles.PATCH("/:id", h.UpdateRole)
		roles.DELETE("/:id", h.RemoveRole)
	}
}
