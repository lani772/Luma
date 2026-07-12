# Portable build for running this backend outside Replit (e.g. another
# cloud provider, a self-hosted box). On Replit itself, the artifact is
# deployed as a compiled Go binary directly (see .replit-artifact/artifact.toml)
# — this Dockerfile is not part of that path, but is kept so the service can
# be picked up and run anywhere Docker exists.
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/api ./api
COPY migrations ./migrations
ENV CLOUD_API_PORT=8090
EXPOSE 8090
ENTRYPOINT ["./api"]
