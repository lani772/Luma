package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/invitations/handler"
)

func RegisterRoutes(g *gin.RouterGroup, h *handler.Handler) {
	invs := g.Group("/invitations")
	{
		invs.POST("", h.CreateInvitation)
		invs.GET("", h.ListInvitations)
		invs.POST("/:id/accept", h.AcceptInvitation)
		invs.POST("/:id/reject", h.RejectInvitation)
	}
}
