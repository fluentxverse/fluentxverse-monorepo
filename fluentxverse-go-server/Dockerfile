FROM golang:1.25-alpine AS build

WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/fluentxverse-api ./cmd/api

FROM node:22-alpine AS proof-deps

WORKDIR /proof
COPY package.json ./
RUN npm install --omit=dev

FROM alpine:3.22

RUN apk add --no-cache nodejs \
    && adduser -D -H -u 10001 appuser
WORKDIR /app
COPY --from=build /out/fluentxverse-api /app/fluentxverse-api
COPY --from=proof-deps /proof/node_modules /app/node_modules
COPY package.json /app/package.json
COPY internal/proof/bridge /app/internal/proof/bridge
COPY circuits /app/circuits
RUN mkdir -p /app/zk-artifacts/tutor-certification \
    && chown -R appuser:appuser /app/zk-artifacts

USER appuser
EXPOSE 8765
ENTRYPOINT ["/app/fluentxverse-api"]
