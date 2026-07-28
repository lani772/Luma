package remote

type RemoteCommandRequest struct {
	Command string         `json:"command" binding:"required"`
	Params  map[string]any `json:"params,omitempty"`
}

type RemoteCommandResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	MessageID string `json:"messageId,omitempty"`
}
