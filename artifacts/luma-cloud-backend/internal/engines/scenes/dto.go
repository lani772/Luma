package scenes

import "time"

type CreateSceneRequest struct {
	Name    string   `json:"name" binding:"required"`
	Actions []any    `json:"actions" binding:"required"`
}

type UpdateSceneRequest struct {
	Name    *string  `json:"name,omitempty"`
	Actions []any    `json:"actions,omitempty"`
}

type SceneDTO struct {
	ID        string    `json:"id"`
	OwnerID   string    `json:"ownerId"`
	Name      string    `json:"name"`
	Actions   []any     `json:"actions"`
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
