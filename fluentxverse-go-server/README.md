# FluentXVerse Go Fiber Server

This is the Go Fiber backend for FluentXVerse. The existing Bun/Elysia server remains in `../fluentxverse-server` as a reference while the Go service takes over route groups.

## Current Status

- Fiber app bootstrap
- CORS, request IDs, security headers, panic recovery, structured request logging
- PostgreSQL, Redis, and Memgraph clients
- `/health` and `/health/detailed`
- JWT signing/verification helpers and cookie guard middleware
- GMR Engine client for managed wallets and contract writes
- Route groups that mirror the current Elysia API surface
- Native WebSocket realtime endpoint at `/ws` for classroom chat/video signaling, highlights, activity logs, and notification actions
- OpenAI-backed `/ai` generation routes when `OPENAI_API_KEY` is configured
- OpenAI Whisper-compatible speaking exam transcription when `OPENAI_API_KEY` is configured
- Local Groth16 tutor-certification proof generation using the bundled circuit artifacts
- zkVerify proof submission through the bundled proof bridge when `ZKVERIFY_SEED_PHRASE` is configured

## Run Locally

```bash
cp .env.example .env
go mod tidy
npm install
go run ./cmd/api
```

Default port: `8765`.

For local proof generation, `node`, `snarkjs`, and `circom` must be available. The checked-in circuit build artifacts are used when present, so normal proof generation only needs Node plus `snarkjs`; if artifacts are deleted, `circom` is required to rebuild them.

Set these for production proof workflows:

```bash
OPENAI_API_KEY=...
TUTOR_CERT_ISSUER_SECRET=...
TUTOR_CERT_COMMITMENT_SALT=...
ZKVERIFY_SEED_PHRASE=...
ZKVERIFY_DOMAIN_ID=0
```

## Migration Approach

Keep endpoints and response envelopes compatible with the frontend while retiring the Bun service. The old service is still useful as a behavior reference for edge cases.
