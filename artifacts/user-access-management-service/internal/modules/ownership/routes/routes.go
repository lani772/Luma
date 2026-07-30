package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/ownership/handler"
)

func RegisterRoutes(g *gin.RouterGroup, h *handler.Handler) {
	owns := g.Group("/ownership")
	{
		owns.POST("/request", h.RequestTransfer)
		owns.POST("/accept", h.AcceptTransfer)
		owns.POST("/reject", h.RejectTransfer)
		owns.POST("/emergency-recovery", h.EmergencyRecovery)
		owns.GET("", h.ListTransfers)
	}
}
