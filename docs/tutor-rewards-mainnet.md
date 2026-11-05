# Tutor Rewards on Robinhood Chain

## Deployment

- Chain: Robinhood Chain mainnet, **4663**, not Arbitrum One.
- Contract: `0x90153ced2a37eeba68c68f945653c7959ba0f627`.
- Transaction: `0xaab9d27ad863f93fc231e371aa0195674a911fbd71b149695e1662b6ec1d089d`.
- Canonical deployment block: `105876952`.
- Block hash: `0x744f5234b931c52a9bd36cd7c9b9ce1036b592fe8bc9ea715ddafcd271d07f27`.
- Gas used: `4350912` gas units, not an ETH amount.
- Source verification: Sourcify **match**, job `cbf5e207-0ecb-4dc7-867e-4ddd76dfd5e4`.
- Runtime: 19,040 bytes; OpenZeppelin-based non-upgradeable contract.
- Artifact SHA-256: `22cb06b436e95584952015caff719e0919971d81de60e3f8fce2bff415e034cc`.
- Initial administrator, Engine, relayer and guardian:
  `0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1`.
- Settlement: six-decimal USDG,
  `0x5fc5360d0400a0fd4f2af552add042d716f1d168`.
- Deployed through the existing Engine project/Vault signer and registered as
  an imported contract in project `2a798002-7ed3-4e98-853e-62306479b9da`.

The deployment receipt was independently checked for canonical inclusion and
network finality. Runtime and initial roles match the intended contract. Both
allocations and claims start paused. No periods, reward assets or funded tutor
entitlements were created during deployment. No tutor or student data was
published. No financial rewards have been paid.

This is a separate deployment from the old dispute contract with the same
address on Arbitrum One: CREATE addresses can coincide across different chains.
Always include chain ID 4663 when linking, signing, importing or querying this
rewards deployment. Existing Arbitrum contracts are unchanged.

Explorer:
https://robinhoodchain.blockscout.com/address/0x90153ced2a37eeba68c68f945653c7959ba0f627

## Engine and API

Engine now runs `fluentxverse-cloud/gmr-engine:tutor-rewards-claims-20261104`.
An additive RPC configuration enables Robinhood Chain while retaining all prior
RPC mappings and the existing 32-booking batch worker. A deployment-only
`tutor-rewards-bootstrap` binary runs in a trusted sidecar derived from that
Engine image. A scoped API extension adds managed tutor claim authorization;
the existing workers, RPC mappings and 32-booking batching remain intact.

The bootstrap uses Vault references, an exclusive Engine wallet lock, a private
fsync/rename journal and a strict pinned deployment binding. Signed bytes are
saved before broadcast and all retries reuse them. A canonical mined deployment
releases its signing lock; Engine registration requires finalized inclusion.
Private keys, credentials and signed journal contents are never exported.

The public RPC is not an archive endpoint. Deployment finality is established
using the pinned successful creation receipt, its canonical block, the finalized
chain head and matching live code of this non-upgradeable contract. It does not
substitute a failed historical state lookup with an assertion of finality.

API image: `fluentxverse-cloud/api:tutor-rewards-20261104-r6`.
The initial images were superseded to fix non-archive RPC reads and production
report-query compatibility. Deployment settings:

- `TUTOR_REWARDS_ENABLED=true`: monitor existing reward operations.
- `TUTOR_REWARDS_ENGINE_API_BASE`: existing private Engine service address.
- `TUTOR_REWARDS_ENGINE_API_KEY`: dedicated project key, retained on the VPS.
- `TUTOR_REWARDS_CLAIMS_APPROVED=true` after integration verification.
- `TUTOR_REWARDS_APPROVED_ADAPTERS` contains the pinned deployed Aero adapter.
- Alchemy pricing credentials are private; recurring publication requires a
  nonzero reserved tutor reward balance.

No browser receives the Engine key or Vault reference. Bootstrap, API and
network rollback records live in the private release directory on the VPS;
they include secrets and must never be copied into source control or reports.

## Payments Controls

The administration Payments page has a Tutor Rewards section with Treasury,
Monthly totals, Reward assets and Transactions tabs. Finance access is required
for reads; writes require a current superadmin, trusted Origin and audit reason.
Unauthenticated requests return 403 with private/no-store caching.
The published Cloudflare dashboard version is
`a3bd2b12-4b1f-4ea3-b0b6-3955e419d5b2`; public JavaScript and CSS hashes were
checked against the tested release build.

Available contract operations include future-period creation, release-date
changes before finalization, tutor wallet registration, staged lesson counts,
finalization, released-balance unlocking, exact treasury approval/funding,
approved asset configuration, asset disabling and allocation pause controls.
Thresholds and USD rates are snapshotted before each period begins. No actual
rate or pay date has been selected for the launch period.

Monthly counts come from finalized completed booked lessons. SYS-501 and student
no-shows count; TA-301 is excluded even when other attendance flags disagree.
Unresolved or unassessed reports hold monthly reconciliation. SQL report reads
cover both tutor and student sources. A client cannot submit arbitrary lesson
counts: Engine arguments are constructed from a fresh server-side snapshot.
The PostgreSQL query uses Bun's typed text-array binding. Legacy report schemas
without a structured completion decision return a null decision via `to_jsonb`;
resolved legacy reports still require an explicit decision before qualifying.
Staging supports batches of 128 tutors. The limit is unrelated to the booking
registry's 32-booking batch size. The release dialog supports selecting each
128-tutor unlock batch, including the final partial batch.

Snapshot digests are internal stale-data checks, **not Merkle roots or ZK
proofs**. Corrected zero counts remain stageable, and historically staged tutors
stay in the roster even after source bookings disappear. After a period is
finalized, displayed awards follow its immutable onchain allocations rather than
silently rewriting previously earned rewards from later database changes.

Operation IDs and arguments are durable before Engine enqueue. Retries retain
the same scoped idempotency key, including after an uncertain response. A
transaction is shown as finalized only after its chain, sender, target, exact
calldata, zero ETH value, canonical success receipt and finality are checked.
Submission or a transaction hash alone does not mean payment succeeded.

## Managed Tutor Claims

The Aero adapter, NVDA Alchemy-backed feed, price publisher and tutor claim flow
are deployed. See [Aero integration](tutor-rewards-aero.md) for exact contracts,
release versions and trust assumptions. The tutor Rewards page reviews quotes
and uses Engine/Vault wallet authorization with sponsored transaction execution.
Only NVDA is enabled initially. Treasury and reserves remain zero, so no tutor
can withdraw nonexistent awards. No real stock purchase or tutor payout was made.

The planned stock selection is NVDA, TSLA, AAPL, MSFT, AMZN, GOOGL, META, AMD,
COIN, MSTR, PLTR and SPCX. ARB is excluded. Symbols are not canonical addresses;
each production token, feed and route requires independent validation on the
deployment chain. Executable liquidity and source freshness are checked for
NVDA. Additional assets still need route, multiplier and corporate-action review.
Issuer eligibility, ongoing gas budgets and operational monitoring remain the
operator's responsibility; enabling the claim UI is not securities clearance.

Engine/payroll must close the final lesson roster before financially finalizing
a period. The system trusts the backend's reconciled counts; it is not an
independent attendance oracle. Stablecoin USD accounting assumes the USDG peg.
No independent security audit has been performed.

## Verification

- All 197 Solidity tests passed, including 40 focused reward tests and reward
  stateful invariants over 8,192 randomized calls.
- 14 backend policy/gateway tests and two HTTP authorization/error tests passed.
- A real, isolated Memgraph test passed for lesson counting, complaints,
  registration, idempotent retry, zero-count corrections and historical awards.
- Live production summary and October monthly preview succeeded; both reporting
  sources and legacy/current decision formats were checked directly against
  PostgreSQL without modifying report data or issuing reward transactions.
- Playwright reward controls passed at 1440, 390 and 320 pixels, including
  confirmation forms, retry IDs, role gating, errors, finality restrictions and
  selecting the second unlock batch in a synthetic 129-tutor roster. Browser
  test financial writes are intercepted, not sent to mainnet.
- The existing general operations browser test still fails its outdated
  expectation that completion-outcome requests must not exist. The identical
  failure was reproduced on the untouched production baseline; it was not
  changed as part of rewards work.
- Existing booking/dispute artifacts and the 32-booking batch configuration
  remain unchanged; original relay records remain finalized.

Operational scripts:

```sh
node scripts/tutor-rewards-engine.mjs --verify
node scripts/configure-tutor-rewards-engine.mjs
node scripts/tutor-rewards-apps.mjs --prepare-dashboard
```

Activation scripts deliberately reject changed deployment baselines or previously
started private activation records. Inspect the saved release records before
retrying deployment operations; do not delete journals to force a fresh nonce.
