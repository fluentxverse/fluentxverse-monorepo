# Base Sepolia and GMR Engine

FluentXVerse uses Base Sepolia (84532). Student identity still uses Privy.
The separate `../budol/gmr-engine` service owns Alchemy RPC access and queues
contract writes signed by GMR Vault. The API's viem client performs reads
through the authenticated, method-allowlisted `/v1/rpc/read` gateway.
The gateway does not expose signing or broadcasting and enforces project chain
and contract policies. Browser wallets use the public Base Sepolia RPC; neither
the Alchemy key nor the engine API key belongs in a `VITE_*` variable.

## Verified Local Setup

The engine, Vault and their dedicated Memgraph containers are running. A
`FluentXVerse Base Sepolia` project and non-admin server key have been provisioned.
The running API confirmed chain ID 84532, read a live block and contract bytecode,
created/reused an infrastructure-test managed wallet, and rejected Arbitrum access.
The project signing wallet is `0x1762f93f13ba91cdde23e28fabba5307b02474bb`.
At setup its Base Sepolia ETH balance was zero. No ticket contract is configured
and no on-chain deployment, mint, booking transfer or refund has been submitted.
The deployed student Worker uses Base Sepolia and the public browser RPC.

## Local Services

Start only the engine and its dependencies from the Budol repository:

```sh
docker compose up -d --build gmr-engine
```

Configure the ignored `../budol/.env.gmr-engine` with
`GMR_ENGINE_CHAIN_RPC_URLS` mapping `84532` to your Alchemy Base Sepolia URL.
Preserve unrelated chain entries. Provision a dedicated FluentXVerse project
with `allowedChains: [84532]` and a server API key without administrator scope.

In the ignored `fluentxverse-server/.env` configure:

```dotenv
GMR_ENGINE_API_BASE=http://host.docker.internal:8090
GMR_ENGINE_API_KEY=<dedicated engine API key>
TICKET_CHAIN_ID=84532
TICKET_CONTRACT_ADDRESS=
VAULT_WALLET_ADDRESS=<project wallet address>
```

The Compose server maps `host.docker.internal` to the Docker host. When testing
from the host instead of the API container, set the engine URL to
`http://127.0.0.1:8090`.

Run the read-only connectivity check inside the API container:

```sh
docker exec fluentxverse-server bun scripts/check-web3.ts
```

## Tickets Are A Separate Migration

The former ERC-1155 address exists on Arbitrum Sepolia, not necessarily Base.
It is deliberately not the default contract on Base. No balances, tickets, or
pending Arbitrum transfers are moved automatically. Existing mock-ticket data
and the mock purchase setting are unchanged during infrastructure setup.

Before enabling real on-chain tickets, deploy a compatible ERC-1155 contract,
fund the project signing wallet with Base Sepolia ETH, establish mint/transfer
permissions, set matching frontend/backend contract and vault addresses,
restrict the engine project's allowed contracts, and test mint, booking transfer,
receipt verification and refund. Review pending legacy-chain transactions before
changing a previously live payment network. Never describe mock purchases as
real payments or disable mock mode before the new contract workflow is ready.
