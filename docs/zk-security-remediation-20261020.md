# ZK Security Remediation

## Scope

This is implementation remediation and local verification, not an independent cryptographic audit. No funds were transferred and no proof or contract transactions were submitted for these tests.

## Legacy Retirement

The V1 tutor-certification and student-attendance setup paths exported the initial Groth16 zkey without a circuit-specific phase-two contribution. Offline review reproduced acceptance of witness-free fabricated proofs using the public keys. Phase-one contributions and a successful zkVerify transaction did not establish soundness.

Generation, setup and submission are now unconditionally blocked. Authenticated generation/submission endpoints return HTTP 410; no enable flag bypass exists. Original source snapshots are preserved as non-executable text under `archives/legacy-proofs-20261020`, with a hash manifest. Existing proving volumes are retained for investigation, not reused or reapproved.

Historical credentials and transactions are not deleted or rewritten. Public, tutor-discovery and admin projections report retirement, expiry or revocation, never verification. Local verification flags are false. Proof status GETs do not issue credentials, renew expiry, replace public signals or modify proof journals. Business application approval remains separate, so retiring proofs does not revoke a tutor's onboarding status or change salary policy.

The experimental Go backend had a duplicate V1 prover and direct zkVerify signer. Both are also retired, with read-only historical status and HTTP 410 mutation routes. This backend is not the running production API. The legacy student CLI cannot prove with its old key either.

The legacy tutor circuit source now constrains scores to 0..100. This source correction does not repair its old WASM, R1CS, zkey or verification key.

## Screening And Engine

V2 publication requires tutor sharing consent before submission. Its database claim rechecks consent, revocation, proof-ready state and exact proof/public-signal bytes under the same node write. Share, unshare and revoke update that node too. A withdrawal winning before the claim prevents dispatch; the authorized claim is the linearization point. Withdrawal after it cannot retract an already authorized public submission. Ambiguous submissions remain claimed for explicit reconciliation rather than automatic resending.

Engine source supports a dedicated 15-signal Groth16 screening policy. It requires the exact statement type, native VK hash, issuer key/hash, policy/schema, success output, official network/domain/bridge tuple and reserved agent ID zero. Arbitrary public-input counts and mixed-network bindings remain rejected.

Server artifact checks and the Engine submission worker reject canonical snarkjs keys with equal gamma/delta G2 points, the unsafe initial-setup pattern. Noncanonical point encodings are rejected too. This is a structural safety check, not proof that a different key was securely generated or independently reviewed. Reviewed artifacts, contributor records and independently trusted review approvals are still required. Neither screening nor confidential payout production activation has been enabled.

The shared Engine worktree contains unrelated changes. It was initially left unchanged during the API mitigation. The subsequent Engine release reconstructed the prior source in an isolated snapshot and reproduced the running binary byte-for-byte with Go 1.25.14 before building the scoped security changes. No unrelated checkout changes were deployed.

## Performance

Receipt batches pin one operation-local config/client/finalized snapshot, read only the official bridge at the exact block, and recheck the canonical hash before returning any results. There is no positive-result cache in the receipt reader. Tally collection checks all accepted receipts in one batch rather than repeating chain/finality/code discovery per review.

The development payout circuit constructs six distinct lesson pairs instead of sixteen ordered/self comparisons. Circom 2.1.9 reports 10,208 nonlinear plus five linear constraints, versus 10,226 plus five before the change: 18 constraints removed. Public input order and count are unchanged. Existing compiled payout artifacts are not approved by this change.

## Verification

- Focused server regression suite: 85 tests, 511 assertions, passing.
- Real isolated Memgraph: legacy claim retirement, booking ownership and unchanged proof count.
- Real isolated Memgraph: consent required, withdrawal during preparation blocks dispatch, successful authorized dispatch and idempotent retry. Engine transport was mocked; no chain submission.
- Fresh V2 WASM: valid signatures on every score-boundary case; two valid witnesses accepted and seven invalid witnesses rejected by constraints.
- Real development-only screening Groth16 proofs locally verified, including official-bridge/agent-zero bindings; 18 tampered witnesses rejected. These assets remain unapproved.
- Rebuilt development-only payout Groth16 proof locally verified; 30 tampered witnesses rejected; production use blocked.
- Engine Go package tests and unsafe-key worker test pass. Student/tutor production builds and dashboard build are checked separately from live deployment.
- All 29 student/tutor release checks passed, including desktop/mobile browser suites. Tutor profile integration tests confirm stored legacy verification flags are not advertised as verification.

Dashboard production build passes. Its separate full TypeScript check still reports an unrelated pre-existing `Skill`/`review` type mismatch at `src/components/AIContentGenerator.tsx:349`; that file was not changed here. Browser profile-media fixtures also log rejected production-WebSocket attempts from local preview origins; those tests are not live signaling or classroom certification.

Examples from `fluentxverse-server`:

```sh
bun test tests/zkSecurity.test.ts tests/bridgeOnlyPrivacy.test.ts
bun tests/screening.bounds.circuit.ts /path/to/fresh-screening-build
TEST_MEMGRAPH_URI=bolt://127.0.0.1:32768 bun tests/studentLessonProof.integration.ts
TEST_MEMGRAPH_URI=bolt://127.0.0.1:32769 bun tests/screening.consent.integration.ts
```

Each integration test requires its own empty disposable database. Never point these tests at production.

## API Deployment

`scripts/deploy-zk-security-api.mjs` builds a 17-file overlay on the reviewed bridge-only API image, without dependency changes. Deployment refuses active classroom connections, preserves recording keys, lesson-evidence issuer, paid/trial booking mode, mounts and network bindings, and keeps disabled privacy pilots disabled.

Live verification confirmed three legacy proof mutation routes return HTTP 410 and the existing public historical credential reports non-verifying retirement status. Its database properties were unchanged. The API is healthy on `fluentxverse-server:zk-security-20261020`. Frontend/Engine deployment is separate; a successful local build does not mean those deployments occurred.

After all 29 app release checks passed, the tested tutor and dashboard assets were published separately to their Cloudflare Workers. Tutor version: `86dd8333-e3a3-43b6-aaa5-29c284a6890e`. Dashboard version: `3415792b-75ce-4b5a-999e-18380e72b0a0`. Student changes are type declarations only and require no new runtime asset.

## Engine Deployment

The follow-up request deployed `budol-gmr-engine:zk-security-20261020`. Preparation and deployment helpers are `scripts/prepare-engine-zk-release.mjs` and `scripts/deploy-engine-zk-security.mjs`.

The prior binary was reproduced exactly before preparing the new binary. Runtime dependencies were inherited unchanged from the existing image. The release updates the native-VK safety guard, pinned 15-signal policy support, archived screening handlers/workers and development payout circuit source. Both the obsolete provisioning script and provisioning executable reject execution without opening an RPC connection or signing a transaction.

Matching-toolchain Go package tests pass, as do 11 focused worker/network/receipt tests. The final image rejected an unsafe key with networking disabled. Deployment checked idle workers/classrooms, preserved environment values, ports, storage mounts and project-policy file hashes, and verified unchanged financial/proof record counts. FluentXVerse's existing Engine authentication works after restart. Rollback credentials/configuration are retained outside the repository in owner-only local state.

Four historical proof journals still carry the pre-fix `submitted` label, despite stored finalized transaction results. They predate the prior running process and have no running workers; deployment preserved those records unchanged. This observation concerns restart safety, not the soundness of their proof keys, and does not restore legacy certifications.

## Remaining Release Gates

Obtain independent circuit/setup review and a reviewed multi-party proving release; do not promote the retired or development keys. Pin reviewed V2 trust roots in a dedicated restricted Engine project and run a consented pilot through zkVerify and the official Horizen receipt bridge. Screening and production confidential settlement remain disabled; deployment of security fixes does not approve proving artifacts or activate payments.

## Review Preparation Follow-Up

GMR Engine now has shared, circuit-specific ceremony and signed-release checks for screening and payout authorization. Frozen October 20 review bundles were reproduced twice with the exact pinned Circom binary: screening has 5,771 constraints / 15 public signals; payout has 10,213 / 22. Their build hashes are respectively `6dda6e2dd5de1b795ced8909bb18fa2e75bd644e7c3321a558e1934088294adc` and `fdcce13a2fd228178fe7cb897d729ef68c46ec4072eca9a5ab80336384864106`.

The workflow and reviewer checklist are in the separate Engine checkout at `gmr-engine/docs/proving-release-review.md`. Review bundles are not approved proving releases. Full verification checks signed approvals, setup contributions and native network/VK identity; metadata inspection alone does not claim full verification. No live modules were activated. Bridge-only Engine proving integration and payout claim/settlement lifecycle remain separate application gates after independent review.

Review tooling QA passed 32 focused Bun tests (114 assertions), both real-circuit ceremony integration tests (24 assertions), payout authorization/publication regressions and five CLI bundle checks. Each ceremony used fresh development-only contributions tied to its own phase-one file; a key from another phase-one setup was correctly rejected during testing. Portable handoff archives and their transport hashes are recorded in the Engine workflow. This is internal release preparation, not independent approval.
