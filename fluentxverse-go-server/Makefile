.PHONY: run build test tidy fmt

run:
	go run ./cmd/api

build:
	go build -o bin/fluentxverse-api ./cmd/api

test:
	go test ./...

tidy:
	go mod tidy

fmt:
	gofmt -w .
