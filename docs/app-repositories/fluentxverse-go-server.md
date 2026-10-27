# FluentXVerse Go Server

A Go Fiber backend migration workstream for FluentXVerse. This repository makes the migration code independently inspectable; it does not claim that the Go service has replaced the active Bun/Elysia application API.

## Scope

- Fiber bootstrap, CORS, request IDs, security headers, panic recovery, and structured logging.
- Memgraph, PostgreSQL, and Redis clients.
- Authentication helpers and route groups intended to mirror application contracts.
- Scheduling, tutor/student operations, content, notifications, and native WebSocket signaling.
- AI assessment/transcription adapters and proof bridge experiments.
- GMR Engine integration for externally managed Web3 operations.

Implementation presence does not establish full behavioral parity. Compare routes, authentication, booking/refund atomicity, classroom protocols, data ownership, and security controls against the active [Bun server](https://github.com/fluentxverse/fluentxverse-server) before promoting any route group.

## Local Development

Use Go 1.25.1+ and an isolated development environment. From the repository root:

```bash
cd fluentxverse-go-server
cp .env.example .env
go mod download
go test ./...
go build ./cmd/api
go run ./cmd/api
```

The default HTTP port is 8765; choose a different port if the Bun server is already using it. Configure a dedicated development database and secrets in `.env`. Do not run both backends against mutable production data to test parity.

The legacy proof bridge and its direct zkVerify signer are retired. Generation and submission fail unconditionally; historical status reads cannot issue or renew credentials. Generated Circom build files and development proving/setup artifacts are not exported. New proof integration must use reviewed V2 artifacts and GMR Engine, not the retired bridge.

## Migration and Security Boundaries

The retained nested guide describes the original migration intention, not the current production routing. Historical fallback paths to sibling Bun-server configuration/assets refer to the monorepo; configure this service explicitly when running it independently. The standalone repository does not contain a production deployment pipeline.

New custody, signing, verification-network credentials, and chain writes belong in GMR Engine/GMR Vault. Legacy proof bridge code that can read a verification-network seed phrase is migration debt, not the target architecture. Do not configure mainnet credentials in this service to bypass that boundary. Keep primary marketplace and compensation records in Memgraph, with PostgreSQL primarily supporting logs and operational records.
