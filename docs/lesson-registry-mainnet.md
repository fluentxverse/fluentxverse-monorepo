# Combined Lesson Registry: Arbitrum One

Activated November 4, 2026, Asia/Manila, after explicit production deployment approval.
Internal verification is not an independent security audit. Source verification is
not a security audit either.

## Deployment

- Chain: Arbitrum One, 42161.
- Contract: `0x21e09faf72db719cbf9a801d8878a850823d10d1`.
- Deployment transaction: `0x00516348ddae1aadecacbd9147db8ea2aa6309ebe5f08e7964eee8fa2fb6a0ec`.
- Owner and Engine operator: `0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1`.
- Independent reconciler address: `0xd7e41ce20d69914164856e9e37b79e6bcd2773e3`.
- Policy: `0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144`.
- Artifact SHA-256: `5949381fde24c8f1a8fbe9b6fab300cf54e41ef3172705fd904fed1d4b6a05d4`.
- Runtime: 16,044 bytes, identical to the tested Sepolia build.
- Sourcify verification: `match`, job `f4417443-7e6b-442f-9403-7842cc981f0a`.
- Policy approved, contract unpaused, reconciler accepted and non-response capability enabled.

[Explorer](https://arbiscan.io/address/0x21e09faf72db719cbf9a801d8878a850823d10d1)
and [source verification](https://sourcify.dev/server/verify-ui/jobs/f4417443-7e6b-442f-9403-7842cc981f0a).
These are public contract and transaction references, not links to private evidence.
The two addresses represent separate permissions, not independent organizations.
The owner remains a single Vault-backed project wallet, not a multisig.

## Live Routing

The API image is `fluentxverse-cloud/api:lesson-registry-mainnet-20261104`, built on
the then-live `learning-terminology-20261104` image with scoped booking/outbox changes.
The Engine image is `fluentxverse-cloud/gmr-engine:lesson-registry-mainnet-20261104`,
built on `dispute-mainnet-20261103` and the tested separate registry worker.
That initial image was subsequently replaced by
`fluentxverse-cloud/gmr-engine:lesson-registry-batching-20261104` to enable
[automatic booking batches](lesson-registry-batching.md) without changing the contract or binding.
No frontend deployment, new student/tutor controls or consent step was added.

New confirmed bookings are enrolled transactionally. Their cancellations, reschedules,
replacement bookings and subsequent student disputes use the same opaque booking key.
Enrollment does not wait for a chain transaction; the outbox is durable and publication
is asynchronous. Chain receipts do not replace the booking database or prevent
double-booking by themselves. They are issuer-attested commitments, not ZK proofs
or independent evidence that a lesson happened.

Historical bookings are not retroactively enrolled. Existing and new disputes on
unenrolled bookings retain the legacy v1 feed and contract:
`0x90153ced2a37eeba68c68f945653c7959ba0f627`. The old worker, configuration mount,
cursor, receipt journal and refund-deduplication rules remain in place. Old outbox
events are not replayed into the new contract.

## Production Controls

`shared/lessonRegistryDeployment.json` pins the chain, address, policy, Engine project,
operator, artifact digest, feed and epoch. API enrollment requires both capture enabled
and `LESSON_REGISTRY_PRODUCTION=registry-production-20261104-v1`; arbitrary mainnet
addresses remain rejected. Engine Go validation and signing transport independently
enforce the v2 production binding and reject cross-version feeds/events.

The new worker uses `GMR_ENGINE_LESSON_REGISTRY_CONFIG_PATH` alongside the legacy
`GMR_ENGINE_DISPUTE_CONFIG_PATH`. A separately generated feed secret is held only in
private server configuration. The HTTPS feed rejects unauthenticated requests with
404 and uses no-store responses. It never exports the artifact bytes or salts.
Do not copy private compose overrides, configuration, Vault references or signed journals
into documentation, git, logs or public metadata.

Deployment/configuration used a private durable journal and Engine wallet locks.
The bootstrap refuses unexpected deployment nonces, different bytecode, destinations,
calldata, signers or chains, and caps each configuration/deployment transaction at
0.0002 ETH maximum estimated gas cost. No funds were transferred by the registry.
The existing reconciler role was reused; no new signing key was exported or funded.

The live worker saves signed bytes before broadcast and retries identical bytes after
ambiguous sends. It waits for canonical finalized receipts before advancing the next
event or releasing its wallet lock. Pending inclusion must not be labeled finalized.
The initial release submitted individual receipts; the later batching release shares
one receipt across multiple new bookings. Throughput is still bounded by serial
finality and the shared project wallet. Bookings remain immediately usable in
the application, but other project-wallet submissions can wait behind a pending receipt.
The original release submitted individual receipts. The subsequent batching release
groups up to 32 consecutive new bookings and retains these finality guarantees.

## Verification

- Foundry suite passed, including booking/dispute lifecycle, fuzz and stateful invariants.
  Artifact checks confirmed unchanged legacy executable/ABI and the combined runtime size.
- Backend typecheck and 15 focused local tests passed. The actual candidate API image
  also passed its focused tests and entry-point bundling.
- A disposable graph verified 13 events from actual booking, cancellation, reschedule
  and dispute service flows, retries, commitment reproduction, private feed access and
  legacy routing. Concurrent ordering and rollback checks passed locally and against
  the exact candidate API image on a separate disposable server graph.
- Engine Go and TypeScript checks passed. Both Sepolia-mode and pinned production-mode
  transport lifecycles passed on disposable Anvil; no fixture keys were used on mainnet.
- The production HTTP feed and actual running Engine published one synthetic booking:
  `0x7b7cf4356451485d0eca03909e6aa4e36cf76cdd541078d5257ec1912409c9ac`.
  Its on-chain commitment matches the privately reproduced application artifact.
  The fixture has no real participant, slot, payment or refund. Its temporary Booking
  label is removed inside the same transaction, before attendance jobs can see it.
- Mainnet simulations rejected duplicate registration, unauthorized writers, unapproved
  policies and orphan disputes with the exact expected errors. No rejection transaction
  was sent or charged gas.
- Receipt canonicality is checked on the official RPC. Finalized block hashes are
  cross-checked against a second RPC, and finality uses the lower finalized height.
  Both RPCs also independently match the runtime. The second free RPC can reject
  historical receipts; its finalized head check is not mislabeled a receipt lookup.

At initial verification, the six setup transactions and live relay transaction had
successful canonical inclusion, with finality still pending. The current machine-readable
record is `output/release/lesson-registry-mainnet-20261104/verification.json`; check its
`allFinalized` and relay state rather than inferring finality from a transaction hash.
At 2026-11-04 03:48:09 UTC (11:48 Manila), all seven transactions were finalized on
both cross-checked finalized heads. The production worker marked the synthetic
booking `finalized`, recorded its receipt and released its nonce reservation.

Read-only operational checks:

```sh
node scripts/verify-lesson-registry-mainnet.mjs --status
node scripts/verify-lesson-registry-mainnet.mjs --verify
node scripts/verify-lesson-registry-mainnet.mjs --monitor
node scripts/dispute-mainnet-operations.mjs --status
```

The last command is scoped to the legacy v1 epoch. Re-running the explicit production
smoke command is idempotent and must not create another synthetic receipt.

## Recovery Boundary

Private rollback metadata and compose overrides are retained on the production server
under the release's `private` directory. Activation refuses to overwrite a started
activation journal or silently change its target. Configuration changes must preserve
both workers' deployment bindings and previously saved signed bytes.

Once a booking is enrolled, do not disable capture, change its target address or roll
back the API to a version without its transactional outbox. Those changes either break
safe booking amendments or lose receipt coverage. A relay outage should leave the
capture-aware API running and its events queued. Stop/recover the worker using the
same journal; do not replay a different deployment, clear a nonce reservation blindly,
or sign replacement business actions. A failed finality/reorg check requires review.
On-chain pause is a separate operator action, not deletion or cancellation of bookings.

This release does not change attendance, TA-301, completion-proof eligibility,
reporting deadlines, refund policy or tutor compensation. Personal identities, schedules,
complaint messages and supporting artifacts remain off-chain under application access controls.
