# Tutor Payout Recovery

## Scope And Activation

October 21, 2026. This adds application-side dispatch journals and finance-only
recovery controls. All financial state is in Memgraph. No production deployment,
real transfer, proof submission or credential rotation was performed.

The default Engine payout port is deliberately unavailable. There is no HTTP
dispatch or "mark paid" route, no enable environment flag and no live settlement
adapter. `transferEnabled` stays false. Internal worker lifecycle tests use an
in-memory Engine fixture against a real, disposable Memgraph database; simulated
settled outcomes are not real payments or proof verification.

## State And Atomicity

`TutorPayoutOperation` has unique operation ID, batch ID and submission key. It
pins an immutable private intent, intent hash, reviewed-release hash, settlement
policy hash, chain and verification network. The intent contains the destination,
USD cents and exact earning/rate versions. It is not a public ZK commitment and
must not be published as a substitute for the reviewed circuit's statement.
Engine transfer operation IDs and chain/settlement transaction keys are unique
too: the current model permits one batch per settlement transaction. Reusing a
payment receipt for another batch rolls back its paid accounting. A future
multi-batch settlement protocol would need a reviewed per-claim receipt model,
not removal of this safeguard without a replacement.

| Operation phase | Meaning | Safe action |
| --- | --- | --- |
| No operation | Versioned reservation, no known dispatch | Explicit finance cancellation if all safety checks pass |
| `prepared` | Immutable intent committed; no dispatch claimed | Recheck evidence before dispatch, or explicit cancellation |
| `dispatching` | Submission may have reached Engine | Lookup only; never resubmit automatically |
| `submitted` | Matching Engine operation observed, not settled | Lookup only |
| `review` | Outcome unavailable, missing or inconsistent | Keep earnings reserved; reconcile |
| `settled` | Trusted Engine adapter reports verified final settlement | Atomically record paid earnings and one settlement event |
| `reverted` | Trusted Engine adapter reports a final failed settlement | Keep held for explicit financial review; no automatic retry |
| `cancelled` | Safely withdrawn before any dispatch claim | Historical record retained; no dispatch |

The worker claims dispatch in a committed database transaction **before** making
an external call. No external call occurs inside a retried transaction callback.
After that claim, every retry/restart uses the same submission key and intent
hash for lookup, not another submission. This provides application-side
at-most-once dispatch, not a claim of globally exactly-once delivery.

The tutor compensation node serializes reservation, cancellation, dispatch and
accounting. Booking writes serialize the last payable/refund check. Earnings,
operation state and financial audit events commit or roll back together.
Uncertain outcomes never clear dispatch markers or release earning ownership.
Late pending observations cannot regress terminal settlement accounting.

Expiry alone does not release a reservation. A payment discovered after expiry
still needs accounting. If a refund/hold was added after dispatch and settlement
is subsequently verified, record the payment and flag `adjustmentRequired`;
never erase the payment or silently recreate the earning.

## Finance API

All endpoints use the existing live finance permission check, trusted dashboard
Origin, authenticated admin cookie and private/no-store responses. Support,
student and tutor roles cannot access this financial recovery interface.

```text
GET  /admin/operations/compensation/:tutorId/payouts
GET  /admin/operations/compensation/:tutorId/payouts/:batchId
POST /admin/operations/compensation/:tutorId/payouts/:batchId/cancel
POST /admin/operations/compensation/:tutorId/payouts/:batchId/reconcile
```

List returns the most recent 100 batches. Detail includes the latest 100
financial events, the journal summary and recovery indicators. Intent JSON and
the full frozen earning snapshot are omitted from these projections.

Cancellation requires `{ "requestId": "<UUID>", "reason": "<nonblank reason>" }`.
An identical retry by the same actor returns the original result. Reuse for a
different request/actor is rejected. A successful cancellation releases only
earnings still owned by that batch; refunded or held lessons move to `held`, not
back to payable. Any mismatch rolls the whole cancellation back. Historical
batches without `recoveryVersion: 1` require review instead of automatic release.
New reservations are versioned; no existing financial record is silently migrated.

Reconciliation accepts exactly `{}`. Caller-provided transaction IDs, outcomes,
proof flags or force options are rejected. It can only use the server's trusted
Engine port and never invokes submission. Missing Engine connectivity produces
a held review state, not a claim that the transfer failed or never occurred.

## Engine Integration Still Required

The `PayoutEnginePort` is a server-only contract, not a completed live adapter.
Before implementing/enabling it:

1. Complete independent circuit/setup review and install the pinned release.
2. Define and review settlement asset, decimal/conversion policy, fees and
   authenticated tutor entitlement/destination approval. USD cents alone do not
   specify which on-chain token or quantity should be sent.
3. Persist idempotency and stable lesson/claim nullifier consumption in Engine
   before signing. The application earning reservation is not a substitute for
   cryptographic nullifier checks. Never use generic contract-write retries as
   a fallback when an outcome is unknown.
4. Bind the exact approved statement and official zkVerify/Horizen receipt to
   this operation. Verify canonical final settlement, asset, recipient, amount
   and approved conversion policy before returning `settled` or `reverted`.
   A transaction-status string or an arbitrary evidence hash is insufficient.
5. Make lookup work by durable submission key even when the original HTTP
   response and Engine transaction ID were lost. Pin project ownership and
   intent identity; reconcile ambiguous transactions before any manual release.
6. Add the monitored worker/queue and finance dashboard controls, then exercise
   the approved integration in a controlled pilot. Keep web3/signing in Engine /
   Vault and salary/earning records in Memgraph.

Ordinary transfers still reveal recipient and amount. This journal does not
implement shielded settlement or independently prove that teaching occurred.

## Verification

October 21 local validation passed 30 Bun regression tests / 241 assertions,
both standalone real-Memgraph fixtures (recovery and existing earnings), full
server TypeScript checking and the financial route bundle. Gitleaks v8.30.1
reported no findings in the eight changed source/test/document files. Engine
outcomes were simulated; no live Engine recovery, signing or settlement was
tested. This is internal QA, not an independent audit or production activation.

```sh
cd fluentxverse-server
bun run typecheck
bun test tests/tutorPayoutRecovery.test.ts tests/tutorEarnings.test.ts tests/tutorCompensation.test.ts tests/adminOperations.test.ts tests/zkSecurity.test.ts tests/bridgeOnlyPrivacy.test.ts
PAYOUT_RECOVERY_TEST_URI=bolt://127.0.0.1:17699 bun tests/tutorPayoutRecovery.persistence.ts
```

The persistence fixture refuses other addresses and requires an empty graph.
Never reuse production storage or an existing developer database. Its scenarios
cover cancellation retries/rollback, historical/expired reservations, held
refunds, preparation interruption, fresh pre-dispatch refund checks, response
loss, restart lookup, post-dispatch expiry/refund accounting, racing workers,
late pending responses, cancellation/dispatch races, denied caller outcomes,
receipt reuse denial, finance revocation and Origin guards. No real signing, chain calls or funds are
used. The separate existing earnings persistence fixture requires another empty
graph on the same disposable port and must not run simultaneously.
