# Multi-Stage Build Dockerfile
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o drdms ./cmd/server/main.go

FROM alpine:latest

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /app/drdms .

EXPOSE 8095

ENV PORT=8095
ENV GIN_MODE=release

ENTRYPOINT ["./drdms"]
