# Booking receipts and Engine integration

Implemented November 4, 2026. This records the original testnet candidate. Production
was subsequently activated through a separately pinned mainnet release; see
[the mainnet deployment and runbook](lesson-registry-mainnet.md). During the testnet
phase, production API/Engine containers and the Arbitrum One deployment were not switched.
No new tutor/student controls are introduced. This work is internal verification,
not an independent security audit.

## Testnet deployment

- Network: Arbitrum Sepolia, chain 421614.
- Combined registry: `0x1b4e8106450e8176730827C47acA9910A931c110`.
- Deployment: `0x37f41662cb092db658615c08a82246fb139e9bcd2930a64643362e5c65d25e52`.
- Policy: `0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144`.
- Pilot operator/admin: the existing FluentXVerse Vault-backed test signer.
- Non-response automation remains disabled on this public testnet deployment.
- The synthetic pilot was paused after its checks. No live users or refunds were used.

The 13 actual application-generated events produced four booking records and two
resolved disputes. Six RPC simulations rejected duplicate registration, unauthorized
caller, unapproved policy, stale revision, orphan dispute and amendment of a disputed
booking, with the exact expected decoded errors. RPC outages do not count as passing
negative tests. Including deployment/configuration/cleanup, 17 transactions were
checked for successful canonical inclusion. Finality is checked separately against
the chain's finalized head; inspect `output/release/lesson-registry-20261104/verification.json`
for current `allFinalized`, block hashes and public transaction references.
At 2026-11-03 16:40:43 UTC, all 17 receipts, including the cleanup pause, were
canonical and finalized. The contract was paused and all pilot nonce locks cleared.

## Application changes

`services/lessonRegistry/outbox.ts` captures a newly confirmed booking in the same
Memgraph transaction that reserves its slot. A failed outbox write rolls back the
booking. Reservation retries return the existing booking and do not publish twice.
Student cancellation and support reschedule/cancellation now capture their receipt
within the authoritative transaction. Automatic attendance-recovery replacement
bookings are captured too. No chain call occurs in an interactive booking request.

Each enrolled booking has a private lookup to a random 256-bit chain key, an immutable
chain/contract binding, a booking revision and a per-lesson event sequence. A locked
global counter gives the feed contiguous commit order. Exact private artifact bytes
and independently random salts remain private in Memgraph; the feed returns only
commitments and permitted public fields. Unique keys/event IDs and transaction
rollback protect against inconsistent publication.

New student disputes on enrolled bookings reuse that booking's key and revision.
They are routed into the v2 feed, including requests, replies, staff decisions and
refund-delivery attestations. They are not also exported as v1 events. Existing
unregistered bookings and their reports retain the old v1 feed and deployment.
Existing bookings are not automatically enrolled when a feature flag changes.

A case freezes the booking facts. Support scheduling cannot silently amend those
facts after a report. If attendance recovery closes an already reported lesson,
the booking receipt stays frozen and the dispute workflow records the outcome.
The existing compensation, entitlement restoration and proof holds remain separate.

The snapshot includes internal participants, booking/slot/payment references, time,
duration and revision in a versioned serialized artifact. The Keccak commitment
binds that artifact's SHA-256, a private salt, evidence type, opaque key, revision,
policy, chain and target contract. Raw artifacts/salts must not enter RPC calls or logs.
Booking event timestamps and inherited dispute timing/outcomes remain public.

## Feed and activation controls

API configuration is opt-in:

```text
LESSON_REGISTRY_CAPTURE=false
LESSON_REGISTRY_CHAIN_ID=421614
LESSON_REGISTRY_CONTRACT=0x1b4e8106450e8176730827c47aca9910a931c110
LESSON_REGISTRY_FEED_KEY=<dedicated random secret of at least 32 characters>
```

`GET /internal/lesson-registry/events?after=N` requires the dedicated feed key in
`X-FXV-Dispute-Feed-Key`, returns no-store responses and exposes at most 100 records.
It returns 404 without authorization or when disabled. The page carries protocol 2,
chain, contract and policy. Its secret must not be the v1 feed or an admin API key.
This original testnet release rejects mainnet. The subsequent production release
admits only the explicitly pinned mainnet binding described in the mainnet runbook.

An enrolled booking fails closed if its configured binding changes or capture is
disabled: a cancellation/reschedule cannot commit without its receipt. Do not
turn flags off or replace an address after enrolling users without a migration.

## Engine candidate

`scripts/prepare-lesson-registry.mjs` overlays the recorded production Engine source
snapshot in a separate release directory. It embeds the tested registry artifact,
adds the v2 protocol and transport, tests/builds the candidate, and packages a separate
image. It does not edit the sibling Engine checkout or restart the live Engine.
Source tests are maintained under `integrations/lesson-registry/engine/`.

The optional `GMR_ENGINE_LESSON_REGISTRY_CONFIG_PATH` starts a second worker alongside
the existing `GMR_ENGINE_DISPUTE_CONFIG_PATH`. A v2 binding includes `lessonRegistry:true`,
Arbitrum Sepolia, a `registry-` epoch, target, project, operator, policy and the v2 feed
URL/secret environment name. Go and signing transport independently enforce the
testnet-only binding. They reject cross-version events and wrong feed destinations.

The existing serialized journal is reused: fixed plans, signed bytes saved before
broadcast, same-byte retries after uncertain sends, project-wallet nonce locks,
canonical finalized receipt gating, and finalized-history audits. Booking revisions
are confirmed before the subsequent linked case is processed. A changed binding,
unexpected revision, missing booking, reorg or failed transaction stops the queue.
Separate v1/v2 workers share the wallet lock when configured with the same wallet.
The current transport expects the owner and operator to share the pilot signer;
separate administrator signing would require its own adapter extension.

The live-worker design still waits for finalized receipts one operation at a time.
The isolated public pilot replay instead confirms inclusion sequentially and checks
all finality separately, allowing the synthetic test to finish without a real finality
wait between every step. This distinction is explicit in its output.

The contract supports batches of up to 32 bookings. This first journal integration
submits individual booking events. It does not yet claim the local batch gas savings
in live operation; batching needs a jointly persisted multi-record transaction plan.

## Verification

- Backend typecheck and 15 focused unit tests passed.
- Real application/graph test: 13 events from booking, reservation retry, support
  reschedule/cancellation, student cancellation and standard/staff-first disputes.
  It reproduces every commitment, checks rollback, legacy routing, private projection
  and authenticated/no-store feed access. SQL-backed services are stubbed in this
  graph/outbox test, with trial mode configured through test environment variables;
  no runtime SQL database is contacted.
- Concurrent graph commits preserve cursor order. Disabled capture, changed target
  and disputed-booking mutations roll back rather than lose their receipts.
- Existing attendance/replacement integration passed with capture enabled, using a
  second disposable database, including trial restoration and legacy exclusion.
- Engine Go and transport typechecks passed. New Go checks cover deployment/version
  separation and durable signed-byte recovery after a lost broadcast response.
- The actual Memgraph journal test passed with configuration pinning, lease ownership,
  cursor-gap rejection, persisted signed bytes across restart, receipt recovery and
  finalized-history halt behavior, using a third disposable database.
- The real application HTTP feed and actual Engine worker were connected on
  loopback in observe-only mode. All 13 events were ingested into the disposable
  persistent journal; the second poll was idempotent, with zero signed transactions.
- Real transport on disposable Anvil passed booking/dispute/refund lifecycle,
  cancellation, separate non-response signing, replay of identical signed bytes,
  journal tamper rejection, finalized-receipt checks and mainnet prohibition.
- Public Sepolia replay and six exact-error simulations passed as described above.
  The source contract's earlier 156 Foundry tests and gas results are recorded in
  `smart-contracts/contracts/lesson-disputes/solidity/LESSON_REGISTRY.md`.

Reproduce with the owned disposable graph on 17739, a separate attendance fixture
graph on 7721, and Foundry/Bun/Go dependencies already installed. The persistence
tests refuse other graph addresses and nonempty initial fixtures. Never point them
at production. `lesson-registry-testnet.mjs` uses a private durable remote journal;
do not export its raw signatures or Vault references. Public fixture/report files
contain only synthetic event commitments, chain state and transaction references.

## Production boundary

The original testnet work did not activate mainnet. The subsequent coordinated
mainnet release preserves old per-case routing, uses a separate authenticated feed,
retains finality/restart checks and preserves refund deduplication by original booking.
Contract receipts do not independently verify attendance,
teaching quality or truthful complaints, and do not replace the database.
