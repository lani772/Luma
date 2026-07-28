.PHONY: build test run clean docker-up docker-down

build:
	go build -o bin/server ./cmd/server/main.go

test:
	go test -v ./...

run:
	go run ./cmd/server/main.go

clean:
	rm -rf bin/

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down
