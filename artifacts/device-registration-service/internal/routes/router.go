package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/luma-smart-home/device-registration-service/internal/handlers"
	"github.com/luma-smart-home/device-registration-service/internal/security"
)

func RegisterControllerRoutes(r *gin.Engine, h *handlers.ControllerHandler, jwt *security.JWTMiddleware) {
	api := r.Group("/api/v1")

	// Protected routes (requires valid owner/user JWT)
	protected := api.Group("/controllers")
	protected.Use(jwt.AuthRequired())
	{
		protected.POST("/register/start", h.StartSimulation)
		protected.GET("/register/firmware/:simulation_id", h.DownloadFirmware)
		protected.GET("", h.ListControllers)
		protected.GET("/:id", h.GetController)
		protected.PATCH("/:id/hardware-config", h.UpdateHardwareConfig)
	}

	// Microcontroller claim webhook (unauthenticated, first-boot secure token-based verification)
	api.POST("/controllers/register/complete", h.CompleteRegistration)
}
