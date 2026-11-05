# Aero Purchases and Alchemy Pricing

## Current Status

Deployed on Robinhood mainnet (4663), with finalized creation receipts,
exact-runtime/binding checks, Sourcify matches and imported Engine ABIs:

- Adapter: `0x6f7f6dd424ac5ed441808288fb094eb0574bf6f2`.
- Adapter creation: `0xed5ca8dd3c01333653a17e396c5fd7370f1698171e5fbf1653ec723535f05056`.
- NVDA feed: `0x25cbb57f2dccc478889a232a64fcee210fffd972`.
- Feed creation: `0x258eace9d34579dc3ead58eb2303c183721cb8660824df7dc6bc6e6b0769c01d`.

Only NVDA is configured initially, through the direct USDG/NVDA route with tick
spacing 10, 1% maximum slippage and 300-second source freshness. Discovery of
other tokens is not approval. Both contracts are unpaused and the parent asset
is enabled. Managed tutor claim authorization and the tutor `/rewards` page are
deployed. The parent rewards bytecode is unchanged. Treasury and reserved
rewards are zero: no tutor reward funds or real stock tokens have moved.

Production API: `fluentxverse-cloud/api:tutor-rewards-20261104-r6`.
Engine: `fluentxverse-cloud/gmr-engine:tutor-rewards-claims-20261104`.
Tutor Cloudflare version: `229bf017-1508-4510-83dd-d1b07c186fd0`.

## Purchase Path

The existing TutorRewards contract checks a tutor's signed claim, nonce, released
USD balance and configured price limit. AeroTutorRewardAdapter then pulls exactly
the authorized USDG amount, buys through the fixed Aero Slipstream router and
sends output directly to the signed tutor wallet. Both contracts check actual
recipient balance changes. Neither a quote response nor a router return value
alone establishes successful delivery.

Adapter protections:

- Only the pinned rewards contract can execute purchases.
- Immutable settlement token, router and factory; no arbitrary external call.
- Owner-approved, cycle-free paths with one to three hops. Paths use int24 tick
  spacing, not Uniswap fee tiers. Every hop must exist in the canonical factory.
- A signed path must exactly match the approved path. Route changes require the
  adapter to be paused; old signatures cannot silently select a replacement path.
- Exact input consumption, bounded deadlines, minimum output and non-reentrancy.
- Exact temporary router approval and zero residual allowance after execution.
- No fee-on-transfer, rebasing or otherwise nonstandard balance semantics are
  supported. The adapter is not a custody or arbitrary token-sweep service.

Robinhood Chain (4663) addresses verified against Aero's published deployment
file and onchain router/factory bindings:

- Factory: `0xc63d7338c178e805c544b8f897066bd3bbcbe136`.
- Router: `0x9ee35bf1bd69a03c6f0393582030fce8bb93d418`.
- Metaquoter: `0x1ddfec5058180c207f55bb77d95acdd0d8227868`.

The deployed metaquoter uses
`quoteExactInput(address[] pools,address tokenIn,uint256 amountIn)`. It does **not**
use the older `quoteExactInput(bytes,uint256)` QuoterV2 interface. Our quote call
uses the pool-array interface; the router receives the canonical packed path.

Sources:

- https://github.com/dromos-labs/metadex-slipstream-public/blob/main/deployment-addresses/cl-robinhood.json
- https://github.com/dromos-labs/metadex-slipstream-public/blob/main/contracts/periphery/interfaces/ISwapRouter.sol
- https://app.aero.xyz/
- https://www.alchemy.com/docs/reference/prices-api-quickstart

## Alchemy Price Feed

AlchemyRewardPrices requests exact network/address pairs from Alchemy's Prices
API. It does not substitute a ticker, another network, underlying company share
price, last-known database value or an assumed stock price. API errors, missing
prices, duplicates, zero values and stale/future timestamps fail closed. Price
math uses bigint with 18 decimals, not JavaScript floating point.

AlchemyTutorRewardFeed exposes the `decimals` and `latestRoundData` interface
required by the deployed rewards contract. Only its configured publisher may
publish positive observations. Original source timestamps are preserved; replay
cannot make an old observation appear fresh. Identical retries are idempotent;
older or conflicting same-timestamp observations are rejected. Publisher
rotation pauses the feed, and stale or paused feeds cannot supply usable prices.

This is a **FluentXVerse-operated, Alchemy-backed feed**, not an official Alchemy
oracle or cryptographic verification of Alchemy's HTTPS response. It trusts
Alchemy's data and our backend/Vault publisher. API prices do not guarantee
executable liquidity or exact $1 USDG redemption.

The publisher has a separate durable Memgraph outbox. An observation is recorded
before Engine enqueue; uncertain responses reuse the same idempotency key and
source timestamp. Transaction binding, canonical receipts and chain finality are
checked before publication is labeled finalized. Publishing prices never submits
a purchase or claim. One failing feed does not stop updates to other feeds.
Canonical mined updates do not block the next fresh observation while awaiting
finality, which can take longer than price freshness. Finality is tracked
separately. Recurring publications stop when reserved tutor rewards are zero;
operator activation explicitly bootstraps one observation. A stale feed always
blocks quotes and claims, even if the UI says claims are open.

## Tutor Authorization

Authenticated tutors request a quote, review the receiving wallet, USD amount,
minimum output and sponsored fee, then confirm only the saved quote ID. The
server loads the managed wallet and released onchain balance; browser-supplied
wallets or claim arguments are never used. Engine checks project policy and
managed-wallet ownership before Vault signs the fixed-domain EIP-712 claim.
The exact signed claim is simulated before its signature is returned.

Authorization is durable before enqueue. Concurrent confirmations retain the
first persisted signature; uncertain responses reuse its exact arguments and
idempotency key. Unattempted expired authorizations release the pending hold.
Nonces, asset versions, execution epochs, deadlines and approved path hashes are
checked onchain. A pending transaction is never displayed as completed until a
canonical success receipt is finalized. Engine/Vault credentials never reach
the browser, and tutors do not pay gas or connect a separate wallet.

## Quote Endpoint

`GET /admin/tutor-rewards/aero/quote?token=0x...&amountUsd=12`

This is a finance-authorized, private/no-store preview. It does not spend funds.
It verifies chain, executable adapter/feed code, immutable bindings, configured
route, reward-asset version, active pool liquidity and fresh reference prices.
The minimum output is the strongest of the live contract oracle limit, fresh
Alchemy reference limit and slippage-adjusted Aero quote. Poor execution is
rejected, not hidden by increasing slippage. Quote expiry is capped by both
Alchemy's source age and the onchain observation's remaining validity.

## Read-Only Discovery

On November 4, 2026, read-only checks found Alchemy prices for all 12 requested
token addresses. Eleven had discoverable direct USDG CL routes; MSFT did not have
a direct USDG route in the sampled registry. Several small pools had unacceptable
price impact at a $12 trade size. A pool listing or a successful quote alone is
not a promise that the reward qualifies under the selected slippage limit.

Discovery reports are generated under
`output/verification/tutor-rewards-aero/`. They contain public addresses, prices,
pool observations and source hashes, never credentials. They are snapshots, not
production allowlists. Issuer eligibility, token identity and trading conditions
still need review before enabling an asset. Routes can be multihop where verified.

```sh
bun scripts/probe-tutor-rewards-aero.ts
```

The optional `TUTOR_REWARDS_ALCHEMY_API_KEY` enables price coverage checks. Do not
put a key in CLI arguments, public JSON or frontend configuration. Discovery
parses the frontend registry as data using Acorn; it never executes downloaded
JavaScript. The registry asset URL may require updating after an Aero release.

## Production Rollout

1. Deploy the adapter and a feed per reviewed token through the approved
   Engine/Vault workflow. `DeployAeroTutorRewards.s.sol` provides a pinned dry-run
   deployment specification. Never export Vault keys to use a CLI broadcaster.
2. Verify each deployment's canonical finalized receipt, exact compiled code,
   owner, publisher and immutable bindings. Both new contract types start paused.
3. Import their ABIs into Engine and add only these exact addresses to any
   restricted project contract allowlist. Preserve all existing permissions.
4. Record the finalized adapter/feed addresses and reviewed paths in
   `shared/tutorRewardsAero.json`; publish the scoped API release with the new
   modules and compiled adapter/feed artifacts. An asset entry has `token`,
   `feed`, `tokens` (USDG first, reward last) and `tickSpacings` (one per hop).
5. Set `TUTOR_REWARDS_ALCHEMY_API_KEY` privately and enable
   `TUTOR_REWARDS_PRICE_PUBLISHING_ENABLED=true`. The publisher runs once per
   minute when the existing rewards monitor is enabled. Budget for provider
   requests and onchain updates per feed; confirm the account's rate limits.
6. While the adapter is paused, set each approved route. Confirm canonical
   inclusion of a fresh feed update, then unpause that feed and adapter. Add the adapter to
   `TUTOR_REWARDS_APPROVED_ADAPTERS`, and configure the reward asset using the
   existing superadmin operation with a reviewed slippage/freshness policy.
7. Verify read-only quotes and failed/stale-price behavior. Integrate authenticated
   tutor claim authorization and sponsored Engine execution; test on a fork before
   enabling `TUTOR_REWARDS_CLAIMS_APPROVED` or unpausing real claims. Do not weaken
   the existing signature requirement or turn on automatic purchases.

The initial NVDA deployment and integration completed these steps. Payroll
still needs tutor registration, future-period thresholds/rates and a release
date, reconciled counts and USDG treasury funding. Allocations remain paused
until the operator intentionally opens them. ETH funds gas, not tutor awards.
No paid mainnet tutor claim has been performed; the purchase/delivery test uses
an isolated fork. Initial configuration transactions have their own canonical
and finalized status, separate from deployment finality.

## Verification

- 20 new Solidity tests cover adapter controls, source timestamps and a signed
  released-reward purchase through the adapter and feed using synthetic tokens.
- An additional isolated mainnet-fork test bought NVDA through the actual Aero
  router and checked tutor-wallet delivery, exact USDG spending and zero residual
  allowance. Only local fork balances changed.
- Backend tests cover exact price parsing, coverage failures, redaction, route
  integrity, code mismatch, price limits, expiry and finance authorization.
- An isolated real Memgraph test checks durable publication before enqueue,
  same-observation retry and finalized tracking. No actual Engine transaction is
  submitted by this test.
- Real Memgraph claim tests cover tutor binding, balance limits, signature
  verification, same-ID retry, durable authorization and abandoned quote expiry.
- Engine Go and EIP-712 signing tests pass; production rejects mismatched managed
  wallet ownership. Authenticated HTTP tests run in isolated Bun processes to
  avoid global mock-module collisions between the admin and tutor guards.
- Browser claim tests pass on the exact published assets at 1440, 390 and 320
  pixels; all financial writes are mocked. Public JS/CSS hashes match the build.
- Existing TutorRewards deployment bytecode and runtime are unchanged.

These checks are internal testing, not an independent security audit.
