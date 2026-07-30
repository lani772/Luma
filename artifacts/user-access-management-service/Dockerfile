# Build stage
FROM golang:1.25.5-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o uams ./cmd/server/main.go

# Run stage
FROM alpine:3.19

WORKDIR /app

COPY --from=builder /app/uams .

EXPOSE 8095

CMD ["./uams"]
