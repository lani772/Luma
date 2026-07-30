package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/user-access-management-service/internal/modules/access_requests/handler"
)

func RegisterRoutes(g *gin.RouterGroup, h *handler.Handler) {
	requests := g.Group("/access-requests")
	{
		requests.POST("", h.CreateRequest)
		requests.GET("", h.ListRequests)
		requests.POST("/:id/approve", h.ApproveRequest)
		requests.POST("/:id/reject", h.RejectRequest)
	}
}
