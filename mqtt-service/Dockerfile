# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/bin/server ./cmd/server/main.go

# Run Stage
FROM alpine:3.18

WORKDIR /app

# Install ca-certificates for secure EMQX TLS connections
RUN apk --no-cache add ca-certificates

# Copy compiled binary and configs
COPY --from=builder /app/bin/server .
COPY --from=builder /app/configs ./configs

EXPOSE 8091

CMD ["./server"]
