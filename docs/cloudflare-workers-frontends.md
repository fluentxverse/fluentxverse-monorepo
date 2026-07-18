# Cloudflare Workers Frontend Deployment

The student and tutor apps are Vite single-page applications configured for Cloudflare Workers static asset hosting.

## Student App

Directory:

```bash
fluentxverse-student
```

Cloudflare settings:

```text
Build command: bun run build
Output directory: dist
Wrangler config: wrangler.jsonc
Node version: 24.10.0
```

Deploy from the app directory:

```bash
bun run cf:deploy
```

Required build variables:

```text
VITE_API_URL=https://api.fluentxverse.xyz
VITE_SOCKET_URL=https://ws.fluentxverse.xyz
VITE_TICKET_CHAIN_ID=421614
VITE_TICKET_CONTRACT_ADDRESS=<ticket contract>
VITE_TICKET_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
VITE_VAULT_WALLET_ADDRESS=<vault wallet>
```

## Tutor App

Directory:

```bash
fluentxverse-tutor
```

Cloudflare settings:

```text
Build command: bun run build
Output directory: dist
Wrangler config: wrangler.jsonc
Node version: 24.10.0
```

Deploy from the app directory:

```bash
bun run cf:deploy
```

Required build variables:

```text
VITE_API_URL=https://api.fluentxverse.xyz
VITE_SOCKET_URL=https://ws.fluentxverse.xyz
VITE_ENABLE_NOTIFICATION_SOCKET=true
```

## Notes

- Both `wrangler.jsonc` files use `not_found_handling: "single-page-application"` so browser refreshes on nested routes work.
- `VITE_*` values are build-time variables. Set them in Cloudflare build environment variables before building.
- Keep the API and WebSocket services deployed separately. These frontend Workers only serve static assets.
- Vite 8 requires Node `20.19+` or `22.12+`. Both apps include `.node-version` and `.nvmrc` set to `24.10.0`.
