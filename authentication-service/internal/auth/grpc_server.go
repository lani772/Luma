package auth

import (
	"context"

	"github.com/luma-smart-home/authentication-service/internal/jwt"
	"github.com/luma-smart-home/authentication-service/internal/security"
)

// GRPCServer represents the actual Go gRPC server implementation for LUMA services
type GRPCServer struct {
	authService *Service
	tokenMgr    *jwt.TokenManager
	blacklist   security.TokenBlacklist
}

func NewGRPCServer(authService *Service, tokenMgr *jwt.TokenManager, blacklist security.TokenBlacklist) *GRPCServer {
	return &GRPCServer{
		authService: authService,
		tokenMgr:    tokenMgr,
		blacklist:   blacklist,
	}
}

// Request and Response payload structures mirroring the auth.proto definitions
type VerifyTokenRequest struct {
	Token string
}

type VerifyTokenResponse struct {
	Valid        bool
	UserID       string
	SessionID    string
	ErrorMessage string
}

type IntrospectTokenRequest struct {
	Token string
}

type IntrospectTokenResponse struct {
	Active       bool
	UserID       string
	SessionID    string
	Exp          int64
	ErrorMessage string
}

type CreateServiceTokenRequest struct {
	ClientID     string
	ClientSecret string
}

type CreateServiceTokenResponse struct {
	AccessToken  string
	ExpiresAt    int64
	ErrorMessage string
}

type VerifyServiceTokenRequest struct {
	Token string
}

type VerifyServiceTokenResponse struct {
	Valid        bool
	ServiceID    string
	ServiceName  string
	ErrorMessage string
}

func (s *GRPCServer) VerifyUserToken(ctx context.Context, req *VerifyTokenRequest) (*VerifyTokenResponse, error) {
	claims, err := s.tokenMgr.VerifyUserAccessToken(req.Token)
	if err != nil {
		return &VerifyTokenResponse{Valid: false, ErrorMessage: err.Error()}, nil
	}

	if s.blacklist.IsRevoked(claims.SessionID) {
		return &VerifyTokenResponse{Valid: false, ErrorMessage: "token has been revoked"}, nil
	}

	return &VerifyTokenResponse{
		Valid:     true,
		UserID:    claims.UserID,
		SessionID: claims.SessionID,
	}, nil
}

func (s *GRPCServer) IntrospectUserToken(ctx context.Context, req *IntrospectTokenRequest) (*IntrospectTokenResponse, error) {
	claims, err := s.tokenMgr.VerifyUserAccessToken(req.Token)
	if err != nil {
		return &IntrospectTokenResponse{Active: false, ErrorMessage: err.Error()}, nil
	}

	if s.blacklist.IsRevoked(claims.SessionID) {
		return &IntrospectTokenResponse{Active: false, ErrorMessage: "token has been revoked"}, nil
	}

	exp, _ := claims.GetExpirationTime()
	var expSec int64
	if exp != nil {
		expSec = exp.Unix()
	}

	return &IntrospectTokenResponse{
		Active:    true,
		UserID:    claims.UserID,
		SessionID: claims.SessionID,
		Exp:       expSec,
	}, nil
}

func (s *GRPCServer) CreateServiceToken(ctx context.Context, req *CreateServiceTokenRequest) (*CreateServiceTokenResponse, error) {
	token, expiresAt, err := s.authService.AuthenticateService(req.ClientID, req.ClientSecret)
	if err != nil {
		return &CreateServiceTokenResponse{ErrorMessage: err.Error()}, nil
	}

	return &CreateServiceTokenResponse{
		AccessToken: token,
		ExpiresAt:   expiresAt.Unix(),
	}, nil
}

func (s *GRPCServer) VerifyServiceToken(ctx context.Context, req *VerifyServiceTokenRequest) (*VerifyServiceTokenResponse, error) {
	claims, err := s.tokenMgr.VerifyServiceToken(req.Token)
	if err != nil {
		return &VerifyServiceTokenResponse{Valid: false, ErrorMessage: err.Error()}, nil
	}

	return &VerifyServiceTokenResponse{
		Valid:       true,
		ServiceID:   claims.ServiceID,
		ServiceName: claims.ServiceName,
	}, nil
}
