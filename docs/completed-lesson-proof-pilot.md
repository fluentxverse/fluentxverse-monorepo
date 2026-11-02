# Completed-lesson proof pilot

Date: 2026-10-30. This is an internal test, not a real tutor payment.

Result: **zkVerify verification and the official Arbitrum receipt both finalized.**
The Engine and a separate application RPC reader accepted the receipt at the same
canonical finalized Arbitrum block at 08:56:00 UTC.

## Scope

The active completed-lesson path proves a **payout authorization** using GMR
Engine's approved Groth16 payout circuit and persistent Rust prover. It is not
the retired standalone student attendance circuit, and does not independently
prove that teaching physically occurred.

A synthetic completed, attended lesson was created in a separate Memgraph
database on the VPS. The existing financial services posted one USD 1.23 earning,
reserved it, generated an authorization, and submitted exactly one proof through
the live Engine. No records were added to the application's production financial
database. No payout transfer was requested, and transfers remain disabled.

The proving release uses the documented **self-operated** setup policy. Its
setup is cryptographically verified; it has not been independently audited.

## Evidence

- Engine submission: `cfa01406-dab8-4ee3-bf39-0612e6b46f72`.
- Verification network: zkVerify mainnet.
- Destination: Arbitrum One, chain 42161, system domain 10.
- Aggregation: 9.
- Native transaction: `0x1f21d6ff935b63c6cc8fe839e5ae889bdc4ab9ffa1f32bbcc087bceaa923e8e8`.
- Statement: `0xc4279a27daa31b5c082eee627914452e10a3cfdf42e974fb430f8c89bc0523da`.
- Official bridge: `0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69`.
- Native aggregation publication block: 5769371.
- Official Arbitrum relay transaction: `0x3afa0a6f6aa285deb54b5d18e970c341188c7abd4e48f2b646a33099821f7411`.
- Relay block: 519626428.
- Aggregation root: `0x247b25ccf20cbc9ea6f17e19b15c01c10944480863a12273349aa0a963d4af9c`.
- Independently verified finalized Arbitrum block: 519626582.
- Finalized block hash: `0x5e745457ce75efc6107ee136294386e21dfaa372418a3c1bb972dc6674f982f2`.

The locally verified proof-generation service call took 11,443 ms for this run,
including database and Engine work. This is one cold end-to-end observation,
not an isolated Rust kernel benchmark or a throughput guarantee.

Confirmed checks:

- Production verification key accepts the generated proof using snarkjs.
- Changing the public destination-chain signal invalidates the proof.
- Changing a proof point is rejected.
- Application validation rejects an expired authorization.
- Non-finance administrators cannot generate the authorization.
- A second application submission attempt is rejected before another chain call.
- Refunded and cancelled lessons cannot post earnings.
- zkVerify native transaction is canonical and finalized.
- Native aggregation publication and Merkle receipt path are available.
- Arbitrum relay transaction succeeded and emitted the exact domain/aggregation/root event.
- The official bridge accepts the statement's Merkle path at the latest canonical block.
- Engine receipt reconciliation returned `arbitrum_finalized` and `verifiedOnArbitrum: true`.
- A separate RPC reader verified the same statement/path at the canonical finalized block.
- The compensation, earnings, and recovery unit suites passed: 11 tests,
  120 assertions, zero failures.

Arbitrum acceptance requires `verifiedOnArbitrum: true` at a canonical finalized
block, not simply a successful native transaction, a latest-block root, or an
elapsed timeout. The current checkpoint is recorded in the generated report;
do not treat an `awaiting_*` status as completed destination verification.

Local reports are in `output/release/completed-lesson-arbitrum-20261030/`:
`journal.json` contains application-test progress; `receipt-check.json` contains
the newest finalized destination check; `arbitrum-relay.json` records the relay
transaction and independent latest-block Merkle verification. The remote journal and isolated graph volume are
retained for resumption, with automatic container restart disabled.

## Repeatable Checks

Read-only inventory and account readiness:

```bash
node scripts/check-completed-lesson-proof.mjs
```

Reconcile the existing submission, without generating or paying for a new one:

```bash
node scripts/watch-completed-lesson-arbitrum-receipt.mjs --once
node scripts/verify-completed-lesson-arbitrum-relay.mjs
node scripts/run-completed-lesson-arbitrum-pilot.mjs --reconcile
```

`--live` is deliberately single-use: the saved journals prevent blind resubmission.
`--resume-preflight` only permits startup recovery before any remote journal or
test records exist. Never delete journals to bypass submission guards.

The isolated runner and graph are stopped after each test invocation. Only the
official zkVerify aggregation/relay service can publish incomplete collections
for the current domain's `OnlyOwnerUncompleted` policy. Waiting for publication
or destination finality is not a reason to submit the proof again. See the
[official domain rules](https://docs.zkverify.io/architecture/proof-aggregation/core-concepts)
and [supported system domains](https://docs.zkverify.io/architecture/proof-aggregation/domain-management).
