# Automatic booking receipt batching

Enabled November 4, 2026, Asia/Manila. This is a relay update, not a new contract
deployment or a change to booking, attendance, dispute or refund policies.

## Production Settings

- Same Arbitrum One registry: `0x21e09faf72db719cbf9a801d8878a850823d10d1`.
- Engine: `fluentxverse-cloud/gmr-engine:lesson-registry-batching-20261104`.
- `GMR_ENGINE_LESSON_REGISTRY_BATCH_SIZE=32`.
- Existing contract, policy, epoch, private feed secret and configuration hash unchanged.
- API not restarted; no frontend changes or student/tutor actions.
- Legacy v1 dispute worker retained.

At each healthy relay pass, the worker groups consecutive untouched new-booking
events at the head of its durable queue, up to 32. Two through 32 entries use
`recordBookings`; a lone booking uses the existing `recordBooking` path. There is
no requirement to fill a batch before sending it. The normal poll interval is five
seconds, but chain finality, outages and the shared-wallet lock can delay publication.

Forty consecutive new bookings can form batches of 32 and eight. A cancellation,
reschedule, dispute, previously planned transaction or other ordering boundary stops
the group. The worker never jumps over such an event to fill a batch. Bookings still
confirm immediately in the application; grouping is only for background publication.

## Durable Grouping And Recovery

Candidate membership is claimed atomically in Engine's Memgraph journal. The group
contains frozen record IDs, exact events and one transaction plan. Only new queued,
unplanned records can join. The first record is the leader; followers are held behind
it. Group size, event types, revisions, policy, sequence, IDs and unique keys are
validated independently before signing.

The existing wallet lock, Vault signing, fee cap, runtime/role checks and saved-byte
broadcast recovery are retained. The relay also validates that persisted signed bytes
encode precisely the frozen group before accepting their receipt. A lost send response
retries identical bytes, not fresh per-booking transactions or a differently sized group.

A canonical finalized receipt is required to finish the group. All member records,
their shared receipt and deletion of the exact nonce lock commit in one database
transaction. A missing/changed member or conflicting receipt rolls the operation back.
Lost commit responses are idempotent. Refund issuance remains separate and deduplicated
by the actual application booking; grouping cannot deliver a refund or move funds.

Unfinished batch records use a raw journal `review` state as a compatibility guard,
with `batchState` carrying their real queued/signed/submitted/blocked status. This is
not a lesson complaint or a request for support approval. The batch-aware status tool
reports the logical state. Old binaries stop at these records rather than publishing
followers individually. An actual reverted batch sets an error and needs operator
review; it is never automatically split and resent.

Setting the batch size to one prevents new groups but lets the upgraded binary finish
already frozen batches unchanged. Do not downgrade the Engine binary or delete group
metadata while a group is pending. Preserve both worker bindings and signed journals.
Capture should remain enabled during relay outages so application changes stay durable.

Batching amortizes gas overhead and one finality wait over several bookings; it does
not eliminate finality or the shared project-wallet bottleneck. No mainnet percentage
saving is claimed from the earlier local eight-booking gas comparison. This is not
zkVerify aggregation or a new ZK proof system: these are issuer-attested booking
commitments, and their underlying private artifacts remain off-chain.

## Verification

- Existing Engine Go tests, legacy/v2 production-binding checks and TypeScript checks passed.
- New worker tests cover a 40-booking queue split into 32 and eight, immutable restart
  recovery with batching disabled, no broadcast after persistence failure, ordering
  boundaries, planned-single exclusion, observer behavior and bounded settings.
- Real Memgraph verification covers all-or-nothing membership claims, changed/missing
  members, durable bytes across a second connection, atomic finality/nonce release,
  one shared receipt, and idempotence after a lost commit response. Two concurrent
  membership claims have exactly one winner; these tests also passed Go's race detector.
- Disposable Anvil verified signed groups of eight and 32, the 40-booking split,
  identical-byte rebroadcast, exact signed-membership checks, wrong sizes/policies,
  duplicate keys, ordering gaps and atomic contract rejection. Its deterministic
  local fee advice keeps the production fee cap intact; it is not a mainnet fee quote.
- The exact pinned mainnet binding also signed and finalized a two-booking group on
  disposable Anvil. Existing single-booking/dispute/refund transport tests passed.
- Production binaries and signing transport matched the prepared release hashes.
- Eight synthetic booking events were created in one application transaction for a
  live relay check. They have no real users, slots, payments or refunds. Temporary
  Booking labels are removed before commit so attendance jobs cannot see them.

The live check recorded exactly eight entries through `recordBookings` in one
successful canonical transaction:
[`0x8c8f95f7e6d1f2ac736123dfa4dc04b634ed4ebb0885f76c3d1d09ca2727b03f`](https://arbiscan.io/tx/0x8c8f95f7e6d1f2ac736123dfa4dc04b634ed4ebb0885f76c3d1d09ca2727b03f).
At 2026-11-04 04:44:47 UTC, all eight on-chain commitments matched their outbox
events. Gas used was 593,731; this is a usage measurement, not an ETH fee quote or
percentage-savings claim. Finality and atomic member completion are tracked separately.

The authoritative live result is
`output/release/lesson-registry-batching-20261104/verification.json`. Check both
`finalized` and `allMembersFinalized`; a transaction hash alone is not a finality claim.
The synthetic fixture is idempotent and must not be replaced to create more mainnet
receipts. Its public export contains only synthetic opaque keys and commitments.

```sh
node scripts/lesson-registry-batching.mjs --status
node scripts/lesson-registry-batching.mjs --verify
node scripts/lesson-registry-batching.mjs --monitor
```

The existing cursor lease can take up to five minutes to expire after a restart.
Do not bypass that guard just to accelerate the first publication. Private rollback
metadata is retained under the server release's private directory. Never publish
that directory, configuration secrets, Vault references or signed transaction bytes.

These checks are internal engineering verification, not an independent security audit.
