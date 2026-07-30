# Stage 1: Build the static binary
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install git and certificates
RUN apk add --no-cache git ca-certificates

# Copy go.mod and go.sum and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source files
COPY . .

# Build clean static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o auth-server cmd/server/main.go

# Stage 2: Final minimal runtime execution container
FROM alpine:3.20

WORKDIR /app

# Import ca-certificates and timezone settings for secure transactions
RUN apk add --no-cache ca-certificates tzdata

# Create and use non-root system user for hardening security
RUN addgroup -S luma && adduser -S luma -G luma
USER luma

# Copy the pre-built binary
COPY --from=builder /app/auth-server .

EXPOSE 8081 50051

ENTRYPOINT ["./auth-server"]
