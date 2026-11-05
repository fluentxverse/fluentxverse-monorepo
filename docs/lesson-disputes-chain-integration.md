# Lesson Disputes: Engine Integration

**Production update, November 3:** the subsequent [Arbitrum One activation](dispute-mainnet-production.md)
supersedes the staging-only boundary below. This document retains the earlier pilot record.

## Activation Boundary

This is an application-attested audit integration, not trustless arbitration.
Memgraph remains authoritative for reports, inboxes, staff authorization, earnings,
and exactly-once credit restoration. The contract neither reads classroom logs nor
independently verifies that a tutor taught or a refund was delivered. Existing
zkVerify proof generation and receipt destinations are unchanged.

The production application still uses its previous dispute implementation. The
newer workflow and its event capture are deployed only in isolated dispute staging.
Engine can observe that staging feed without sending mainnet transactions. Mainnet
writes are rejected in both the Go configuration and the signing transport.

## Bindings

- Arbitrum One (42161): `0x90153ced2a37eeba68c68f945653c7959ba0f627`.
  Keep paused, automatic non-response disabled, no reconciler configured.
- Arbitrum Sepolia (421614): `0x90153ced2a37eeba68c68f945653c7959ba0f627`.
  This is a **different deployment on a different chain**, despite the identical
  address. It was used only for synthetic tests and paused again afterward.
- Operator/administrator: `0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1`.
- Sepolia-only reconciler: `0xe197eb331268c37921b9c78c305e8abb93ba4784`.
  A separate Vault key tests role separation; it is self-operated, not an
  independently operated auditor or proof of absence.
- Policy hash: `0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144`.
  This is SHA-256 of `JSON.stringify(shared/disputeChainPolicy.json)` with the
  manifest's committed property order. Policy approval was sent only on Sepolia.

## Application Outbox

`DISPUTE_CHAIN_CAPTURE=true` enrolls newly created student cases. Enrollment is
not retroactive; old cases do not silently acquire commitments or new deadlines.
All case transitions and their outbox events commit in the same Memgraph
transaction. A locked global counter makes feed order match commit order; each
subject also has a monotonic case sequence. Rollback removes both the event and
the counter increment.

Events cover opening, staff authorization, durable inbox creation, the single tutor
reply, deadline extensions, staff decisions/reconsideration, duration penalties,
non-response checkpoints, associated full-lesson no-show closures, cancellation,
and confirmed refund delivery. No-report attendance penalties and legacy SQL cases
remain backend-only; they are not falsely represented as synchronized cases.

Each case gets a random 256-bit public key and a private 256-bit salt. Commitments
bind the event, private message/evidence snapshot, and domain separator. Image
replies include a server-computed SHA-256 of the sanitized image bytes. The hash
is part of the salted commitment, not a publicly exposed unsalted image fingerprint.
Read access checks image integrity. Salts and evidence snapshots are not in the
Engine feed or participant responses. On-chain outcomes and timestamps are still
public; commitments do not hide the existence or outcome of a dispute.

Enrolled inbox timestamps/deadlines use whole Unix seconds, matching the contract.
The API captures one authoritative acceptance time while holding the case lock;
late replies are rejected regardless of when a worker runs. A request cannot be
created before lesson end. Deadlines do not restart when Engine catches up.

The private GET feed is `/internal/dispute-chain/events?after=N`. It requires a
dedicated `DISPUTE_CHAIN_FEED_KEY` of at least 32 characters, uses constant-time
comparison, returns no-store responses, and exposes no raw evidence. Keep it on a
private network/TLS and do not reuse an admin credential. Batches are capped at 100.

## Engine Journal

`GMR_ENGINE_DISPUTE_CONFIG_PATH` opts into the worker. With no path, it is disabled.
The JSON binding pins project, chain, address, operator, policy, epoch, feed URL,
and feed-secret environment name. Changing a binding in place is rejected; a
reviewed migration/epoch is required. `observe` cannot sign. `pilot` can sign only
on Arbitrum Sepolia. There is deliberately no mainnet-active mode.

`DisputeSyncCursor`, `DisputeSyncCase`, `DisputeSyncRecord`, and
`DisputeSyncReceipt` live in Engine Memgraph. Import, per-case order, and feed cursor
advance are atomic. A renewable worker lease prevents two consumers from planning
the same operation. Engine also acquires the existing project-wallet nonce lock.
Private keys remain in Vault.

Engine persists a fixed operation plan and exact signed transaction **before**
broadcast. Unknown send outcomes retry those bytes, not a new nonce/signature.
Chain ID, runtime bytecode, roles, policy approval, target, zero value, calldata,
and recovered signer are checked. Only the pinned contract ABI is used.

An operation advances only after a successful canonical receipt is behind the
RPC's `finalized` head. A bounded recent receipt audit stops writes if finalized
history changes. Reverts, invalid bindings, missing independent reconciler, or
ambiguous nonce state stop progress rather than inventing success. Retry backoff
is bounded; schema initialization also retries. Database queries have identity
constraints and feed/queue indexes. No per-case timers are created.

This conservative worker is serialized and waits for Arbitrum finality. It is not
a high-throughput relayer. A stuck signed transaction intentionally reserves the
wallet: inspect its hash/nonce before any manual recovery. Never delete a journal
or release a nonce reservation simply to make an error disappear.

## Refunds And Staff Decisions

The existing refund ledger remains responsible for restoring the original trial
allowance or ticket once. A refund-delivery event is appended in the same
transaction as local credit restoration/finalization, with a per-case deduplication
marker. A staff reversal does not withdraw a refund already approved or deliver
it twice. The on-chain receipt is an Engine attestation, not a token transfer.

Staff identity, reasons, messages, and private evidence remain in Memgraph. The
exporter writes privileged events only after existing staff authorization and
revision checks. Standard cases map to staff resolution or override as appropriate;
later staff decisions map to reconsideration. Refund and compensation decisions
remain separate. Reversing TA-301 does not automatically excuse a historical
non-response flag; that requires an explicitly authorized policy/UI decision.

Non-response events can only be emitted while the authoritative thread is locked,
after its deadline and without a saved timely reply. Ordered export drains prior
events before the separate role attests. This is a trusted reconciliation
assertion, not a ZK proof. Mainnet non-response automation remains disabled.

## Verification And Release

Local tests exercise actual Memgraph transactions, concurrent replies/deadline
workers, rollback, duplicate refunds, projections, authenticated feed access,
cursor gaps, leases, process restart, save-before-broadcast, lost broadcast
responses, reorg halts, and mainnet write prohibition. Anvil tests deploy the exact
pinned artifact and replay an actual application case through refund and staff
reconsideration.

The live Sepolia pilot used 26 synthetic business events and six contract-revert
checks. It included one actual disposable-application outbox lifecycle, staff-first
behavior, deadline extension, non-response attestation, no-show, cancellation,
duplicate submissions/refunds, expired replies, unauthorized sender, and unapproved
policy rejection. Historical test inbox timestamps avoid waiting 24 real hours;
this is not evidence of a real teaching session. The test bootstrap progresses on
canonical inclusion and verifies finality separately; the persistent application
worker uses the stricter finalized-only rule above. Do not confuse these guarantees.

The test bootstrap journal, signed bytes, and Vault references stay in Engine's
private persistent deployment directory. Do not commit or export that journal.
Public evidence consists only of synthetic event commitments, transaction hashes,
contract state, and summarized verification results.

Verified November 2, 2026:

- All 36 Sepolia transactions (deployment, configuration, 26 business events
  including the two-call non-response transition, and cleanup) were successful,
  canonical, and finalized at the checked head. Six negative checks decoded actual
  contract reverts; RPC outages are not counted as rejection successes.
- Seven synthetic on-chain subjects were checked against their expected outcomes.
  Both deployments matched the pinned runtime bytecode and were paused, with
  automatic non-response disabled. Mainnet still has no reconciler configured.
- Engine imported 15 staging events. The three trial-refund cases each emitted
  exactly one delivery event despite repeated refund processing. Encrypted-image
  upload, content digest validation, corruption rejection, and private feed access
  were exercised on the VPS using synthetic accounts only.
- Engine image: `fluentxverse-cloud/gmr-engine:dispute-sync-20261102-r2`.
  Staging API: `fluentxverse-cloud/api:dispute-sync-20261102-stage-r2`.
  Public production API remains `fluentxverse-cloud/api:notification-resolution-legacy-20261031`.
  No proving artifacts, zkVerify submission settings, or ZK receipt destinations
  were changed. Pilot nonce reservations were cleared after confirmed receipts.
- Local records: `output/verification/dispute-chain-20261102/summary.json` and
  `finality.json`. The latter contains only public test transaction hashes and
  finalized block information, not the private signed-transaction journal.

Before mainnet activation: approve the complete policy and scope, complete live
worker/finality and operational recovery review, cover backend-only legacy/no-report
paths if they are intended to be on-chain, settle evidence retention, review an
independently operated reconciler, and promote the application API/frontends
together. No independent contract/security audit is claimed by these tests.
