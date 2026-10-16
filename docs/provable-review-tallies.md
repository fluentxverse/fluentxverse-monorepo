# Provably Correct Anonymous Review Tallies

October 13 source update: new bridge-only cohorts use platform-managed acceptance
with individual finalized bridge receipts. The old registry census described below
applies only in explicit `legacy_contracts` mode. See
[the new infrastructure runbook](bridge-only-trial-launch.md); neither historical
proofs nor pending deployment receipts have been relabeled.

## Status

Implemented and **deployed in a disabled release state** on October 12, 2026. The updated
API/frontend, isolated prover and dedicated Engine project are running. The existing
anonymous review registry, browser identities, commitments and Groth16 artifacts are
unchanged. `ANONYMOUS_REVIEW_TALLY_ENABLED=false`; no real review records were created,
and historical totals were not relabeled. The only new proof transaction is an explicitly
synthetic verifier integration test, not student activity.

The real five-review synthetic receipt verifies inside the deployed prover with both
cryptographic verifiers. After the wallet received a 0.5 tVFY top-up, the balance preflight
passed (`0.8488614702309375 tVFY` available, `0.72129119701 tVFY` estimated fee). The real
Risc0 V2_3 proof was accepted and finalized on Volta at block `7580420`, extrinsic index
`4`, with matching `ProofVerified`, `NewProof` and `ExtrinsicSuccess` events. Actual
transaction fee: **0.32120763701 tVFY**; aggregation reserves are separate from this fee.

Aggregation `175/1214` was published at finalized Volta block `7580443`. Its single-leaf
Merkle path is saved and independently checked against the exact publication event and
RPC result. The read-only live test checks the complete extrinsic payload against the
approved synthetic proof, image, version, domain, journal and statement; its public report
is stored in the ignored `.deployment/review-tally/volta-verification.json`.

**Horizen relay remains pending:** the root for aggregation 1214 is still zero at both
`latest` and `finalized` during the live checks. The previous review smoke aggregation
`175/1213` also has no finalized bridge root. A completed application cohort, independent
source census and finalized bridge receipt remain required before enabling publication.
This is a real synthetic proof submission/aggregation test, not a completed application
cohort test, real student demand, or a proof of full inclusion on its own.

### Release Pins

- Engine project: `683a093b-10fb-44d9-9ca4-e268f3e0ce5d` (Risc0 V2_3 only, domain 175, 31 words, no contract writes).
- Program image: `0x8d0f9b64c0849b49c06bbf9a741c0ae316d4161fe3b9e14ede1dd141fb0350ed`.
- Prover binary SHA256: `be9daacdabaea02203c569c0c5fce7ac41c0c4debed7306aee097b04f296c9d7`.
- Prover Docker image: `sha256:bd2c857f5b989461daeb57df7bb49316dca5349a91c724c0911837aa4031861f`.
- API image: `sha256:33971877b136fda26d75cda964785de6e3ab42435d1ed034871cb2cefc419feb`.
- Engine image: `sha256:d141082980bfecdf2754c6cfb2d28cafb9b63feb64859e3aa429a8bee2d07ac9`.
- Student Worker version: `507c37ac-6529-4b34-a8e7-e44a98f45e22`.
- Volta submission wallet: `xpisPywVEJgCFauREZz1mF1cRxWBj7MNFx7yq8iRiMsxxSNx4`.
- Synthetic statement: `0x5a3566cf29f0370924100e0271455430e2731f71b5aa6b1d176c703a23f922e8`.
- [Finalized Volta transaction](https://zkverify-testnet.subscan.io/extrinsic/0x7b0d1b11f10562a61e9eca5d59933ac4dcdace621be6d388ffea88400a689842).
- Proof block hash: `0x8aac7e54e5800e2f11ac4c413e985ecd88b0eb1595805be9a7e0a7c7589c72ff`.
- Aggregation publication block hash: `0xa66f059093f0263e1420e1419a870b0a8b1f10d4411b471a5af9a5c784d3ca90`.
- Published Volta aggregation root: `0xf7e0b20b86b6bb712486a2628ea7b9251d8518cd4657f59f8cd115370ad5a906`.

The deployed artifact uses the reviewed native-binary packaging path described below.
The clean container source build was canceled after prolonged native compilation; it
is not claimed as a completed reproducible container build. A locked local rebuild
reconfirmed the unchanged guest image and ELF, and the packaged runtime verified the
existing real proof. The prover is non-root/read-only, has no host ports or app/DB/Engine
credentials, and is limited to two CPUs/12 GiB. Independent audit, provider retention
review, throughput expansion, automatic job processing and mainnet deployment are not
claimed by this release. Current status is inspectable without printing secrets:

```bash
cd fluentxverse-server
bun scripts/deploy-review-tally.ts inspect
bun scripts/deploy-review-tally.ts check
# Read-only validation of the existing submitted proof; no rebroadcast:
bun tests/reviewTally.volta.ts
# Recheck the saved receipt against Horizen finality:
bun scripts/deploy-review-tally.ts receipt --apply
```

This is a RISC Zero 2.3.2 zero-knowledge STARK application intended for zkVerify's
`Risc0/V2_3` verifier, not a TEE or Vela integration. It reproduces the existing v1
salted JSON/Keccak commitment exactly. There is no new application-specific trusted setup.
Guest/binary approval, deployment review and an independent security audit are still
operator responsibilities.

## What Is Proved

For a fixed public acceptance manifest, the guest proves that the operator knows every
accepted commitment's private, canonical structured content. It checks rating range,
topic validity/order/uniqueness, no positive/improvement conflict, no positive engagement
topic, and a lowercase 256-bit salt. It recomputes the existing message hash:

```text
keccak256(uint256(keccak256(canonical_v1_feedback_JSON))) >> 8
```

Every entry must reproduce its Groth16 statement using the original Semaphore native VK,
registered root and cohort scope. Nullifiers are canonical, distinct and numerically
sorted. Entries cannot be duplicated, swapped for different commitments or rebound to a
different cohort/deployment. Exactly one private content record is required per entry.

The guest computes total count, integer rating sum, five rating buckets, six positive
topic counts and six improvement counts. The displayed average is deterministically
rounded from the proven sum/count; it is not an independently supplied decimal.

The public journal is **31 big-endian ABI words / 992 bytes**:

```text
protocolHash, chainId, registry, groupId, scopeHash, root, reviewVk,
closesAt, snapshotBlock, snapshotBlockHash, snapshotTimestamp, manifestHash,
total, ratingSum, distribution[5], positive[6], improvement[6]
```

The manifest hashes the first eleven context words, count, and all ordered triples
`(nullifier,messageHash,statement)`. The journal, program image and version bind the native
zkVerify statement. The exported CBOR has the verifier's `{inner: InnerReceipt}` wrapper;
serializing a bare inner enum is not the correct wire format. Only genuine Composite
receipts are generated. Fake/development receipts are forbidden in the compiled host.
Both the RISC Zero verifier and zkVerify's own pinned v2.3 verifier check the export.

## Full Inclusion Is A Separate Check

The existing registry cannot attest an event-set root or count for a closed cohort.
This upgrade therefore does **not** claim a ZK Ethereum light-client proof of completeness.

The census independently reconstructs **all** `ReviewAccepted` events for the cohort from
the configured source registry. It checks deployment/tutor/period/scope binding, the
frozen public membership root, the registry's cohort window/count, every statement against
the `accepted` mapping, and a canonical finalized checkpoint after the window closes.
Timestamp searches bound scanning to the fixed acceptance window; provider range errors
split requests, never silently skip a range. There is no filtering by local submission
status or positive sentiment. The snapshot cannot be moved earlier than window closure.

Before submission, certification, publication and public verification, the manifest must
match this source census. Successful checks are cached for at most 60 seconds with bounded,
single-flight verification; bridge/trust-root reads remain fresh. Missing, wrong, duplicated,
unavailable or reorged evidence fails closed. Readers can download the manifest and audit
it independently using their own trusted RPC and program pins.

This relies on an honest, complete RPC event history and Horizen finality. A malicious RPC,
compromised platform/device, dishonest enrollment issuer, colluding cohort or refusal to
publish is not solved by the tally proof. It proves arithmetic and commitment openings,
not review honesty, educational quality or fair issuance of eligibility.

If a review is accepted directly onchain without its private content reaching the platform,
or its ciphertext cannot be decrypted, publication is blocked. It is not quietly excluded.

## Publication And Privacy

At least five finalized accepted reviews are required. No live or small-batch tally is
exposed. Snapshot/journal persistence is immutable; private witness copies use the existing
review AES-GCM key with `tally:<groupId>` authenticated context. Neither salts nor individual
ratings/topics are returned by the public evidence endpoint. Public commitments, frozen
membership commitments and nullifiers were already public in the original protocol.

When the upgrade is enabled, new batches cannot use the old platform-only publication
path. Publication requires a matching approved proof, independently checked census and
zkVerify receipt verified through the pinned Horizen bridge at `finalized`. Historical
platform-calculated summaries are retained and labeled separately, never retrospectively
claimed as proven. Changing stored totals/journal or losing verification makes the new
batch unavailable rather than retaining a green badge.

## Prover And Capacity

The proving host uses `LocalProver` directly, with development mode disabled at compile
time. It does not choose Bonsai or another remote provider from inherited environment
variables. Witnesses travel through stdin or an authenticated **local Docker-only** sidecar,
not argv, public URLs or browser requests. Prover child environments do not include app,
database or Engine secrets; the sidecar receives only its binary pin and dedicated token.
No request/witness logging is added. The platform still knows the decrypted reviews.

The guest's logical bound is 256 reviews, matching the original cohort limit. The initial
CPU resource policy is **8 accepted reviews**, with a 30-minute proving timeout, one active
job, two threads, a 12 GiB sidecar limit and bounded input/output sizes. Raising capacity
requires representative benchmarks, suitable resources and checking zkVerify proof-size
and verification-weight limits; the 256 bound is not a throughput claim. Oversized full
sets are blocked, not split into privacy-leaking sub-tallies or reduced to a favorable subset.

A real five-review synthetic proof took about **571 seconds**, with roughly 9 GiB peak
resident memory, producing a **618,255-byte proof** and a **992-byte journal**. Local tests
verified it with both cryptographic verifiers and rejected altered journals/corrupt receipts.
This benchmark is not real student activity or a live zkVerify/bridge transaction test.

Locally tested guest image: `0x8d0f9b64c0849b49c06bbf9a741c0ae316d4161fe3b9e14ede1dd141fb0350ed`.
Local ELF SHA256: `75b8c2ce00d41d3b5bf31347de90ede38a2889c50dffdc381e901ff15a9dfa0d`.
Pin the actual reviewed deployment artifact, not an assumed reproducible hash from a
different build environment. Changing guest code/dependencies/compiler may change the image.

## Activation

1. Review guest, host, both committed lockfiles and privacy boundaries. Build with RISC
   Zero Rust 1.88.0 and the pinned 2.3.2 crates. Build/inspect the sidecar image and obtain
   its program image and binary SHA256. Do not approve artifacts merely because they exist.
2. Configure an ignored mode-0600 `config/anonymous-tally.env` from its example. Generate
   a new random 32-byte prover token. Set the real source registry deployment block (the
   existing testnet registry starts at block `30173321`), approved image/binary pins and
   capacity. Keep the tally flag false until release checks pass.
3. Create a **new** restricted Engine project/key for Risc0 tally submissions. Do not reuse
   the Groth16-only review key or modify its policy. Roll out the scoped Engine changes in
   the neighboring Budol repository: explicit V2_3 support and program/domain/journal pins.
   Its `GMR_ENGINE_ZKVERIFY_POLICY_PATH` entry should be:

```json
{
  "new-tally-project-id": {
    "proofSystem": "risc0",
    "version": "V2_3",
    "domainId": 175,
    "vkHash": "<approved program image ID>",
    "publicInputs": 31,
    "methods": []
  }
}
```

Allow only Horizen testnet; provide the minimal Engine proof-submission/read scopes and
no unrelated signer/contract access. The empty method list denies contract writes.

4. Start the isolated prover and roll out the updated API/frontend explicitly. The overlay
   has no host-published prover port and passes no Engine/DB keys to it:

```bash
cd fluentxverse-server
docker compose --env-file .env --env-file config/anonymous-tally.env \
  -f docker-compose.yml -f docker-compose.review-tally.yml \
  --profile review-tally up -d --no-build --no-deps review-tally-prover fluentxverse-server
```

Use the images inspected in step 1; do not rebuild an image after approving its binary pin.
The alternative `zk/review-tally/Dockerfile.prebuilt` packages a previously reviewed native
release binary and checks its required `APPROVED_BINARY_SHA256` during the image build.
Its minimal build context contains only that binary and the prover service. Build the
binary with both lockfiles locked, inspect its guest/ELF pins, and test a real receipt in
the resulting container before approval. This artifact-packaging path is not a clean
container source build. Its Debian trixie runtime supports the local binary's GLIBC 2.39
and CXXABI 1.3.15 requirements; builds on other hosts still require compatibility checks.

5. Demonstrate actual Volta acceptance and finalized Horizen bridge verification, failure
   paths, authorized operator processing and a completed test cohort before enabling the
   upgrade. No replacement review registry is needed. Independent audit and mainnet
   activation remain separate milestones. The live relayer dependency is not bypassed.

## Operator Flow

### Resumable Release Tooling

The host-only deployment CLI records artifact approval, a dedicated restricted Engine
project, private configuration, synthetic proof submissions and receipt-discovery progress
under the ignored mode-0700 `.deployment/review-tally/` directory. Generated credentials
and proof files are mode 0600. Mutations require `--apply` and an exclusive release lock;
after an interrupted operation, inspect/reconcile its process and journal before removing
a stale lock. An uncertain proof submission is never automatically rebroadcast.

```bash
cd fluentxverse-server
bun scripts/deploy-review-tally.ts approve fluentxverse-review-tally:activation --apply
bun scripts/deploy-review-tally.ts project --apply
bun scripts/deploy-review-tally.ts configure --apply  # always disabled
# Roll out the Engine, isolated prover and API as described above.
bun scripts/deploy-review-tally.ts check
bun scripts/deploy-review-tally.ts smoke-prepare --apply
bun scripts/deploy-review-tally.ts smoke-submit --apply
bun scripts/deploy-review-tally.ts receipt --apply
bun scripts/deploy-review-tally.ts inspect
```

Receipt discovery scans at most 250 finalized Volta blocks per invocation, persists its
cursor, and obtains the Merkle path only at the exact `NewAggregationReceipt` publication
block. Repeat the same receipt phase while pending; it does not submit another proof.
The synthetic fixture is a verifier integration test, not a real review cohort, evidence of
student demand or a completed source-census test. Submission estimates fees first and caps
the synthetic test at ten Volta tokens; these are testnet-only transactions.

Activation requires a separate completed, closed-cohort evidence file. The release tool
checks its program/journal/totals bindings, verifies its real cryptographic proof in the
approved isolated prover, replays the full source census and verifies the finalized Horizen
receipt before changing the configuration flag:

```bash
bun scripts/deploy-review-tally.ts enable <closed-cohort-evidence.json> --apply
# Explicitly recreate only the API after a successful activation check.
```

This is an operator release workflow, not an automatic application job scheduler.
The official domain list describes domain 175 as a Horizen testnet **Bot** relay. Its
runtime `Destination::None` is not by itself a routing error: bridge readiness must be
checked against the actual finalized contract receipt, not inferred from that field.

HTTP mutations retain the operations-admin guard and approved dashboard Origin:

```text
POST /anonymous-reviews/admin/group/:id/tally/prepare
POST /anonymous-reviews/admin/group/:id/tally/prove
POST /anonymous-reviews/admin/group/:id/tally/submit
POST /anonymous-reviews/admin/group/:id/tally/certify   {aggregationId,merklePath,leafCount,index}
POST /anonymous-reviews/admin/group/:id/publish
GET  /anonymous-reviews/public/tally/:id               published evidence only
```

Proving often exceeds proxy timeouts. From the trusted deployment host, execute the CLI
inside the API container so the private sidecar hostname and database resolve without
publishing a prover port or copying credentials into shell arguments:

```bash
docker exec fluentxverse-server bun scripts/review-tally-operator.ts prepare <groupId> --apply
docker exec fluentxverse-server bun scripts/review-tally-operator.ts prove <groupId> --apply
docker exec fluentxverse-server bun scripts/review-tally-operator.ts submit <groupId> --apply
docker exec fluentxverse-server bun scripts/review-tally-operator.ts status <groupId>
# Resolve the exact finalized NewAggregationReceipt publication block/path, then:
docker exec fluentxverse-server bun scripts/review-tally-operator.ts certify <groupId> <container-receipt.json> --apply
docker exec fluentxverse-server bun scripts/review-tally-operator.ts publish <groupId> --apply
```

Copy only the public receipt JSON into the container for certification. A standalone local
CLI is also supported with an approved native binary and authorized local DB configuration.
This CLI requires authorized host/DB access and private configuration, not a public bypass
of HTTP administrator authentication. It prints statuses/public transaction IDs, never
witnesses. Local proof failures are retryable; uncertain network submissions remain
`submitting_zkverify` for manual Engine reconciliation. Do not reset that state to broadcast
again. Certification stores a single immutable receipt atomically, including concurrent calls.
An interrupted `proving` state requires confirming the process outcome before resetting it.
Processing is still manual; no automatic watcher/scheduler is claimed.

The download contains manifest, public cohort context, totals, journal, approved image,
CBOR proof, statement, transaction and receipt. Independent read-only verification uses
trusted local program/registry/bridge/RPC configuration rather than trusting artifact pins:

```bash
bun scripts/verify-review-tally.ts <downloaded-evidence.json>
```

## Tests

```bash
cd zk/review-tally
cargo build --locked -p review-tally-core --example check
cargo test --locked -p review-tally-core
RISC0_BUILD_LOCKED=1 cargo build --locked --release -p review-tally-host -j 2

cd ../../fluentxverse-server
bun test tests/reviewTally.test.ts tests/reviewTally.snapshot.test.ts tests/reviewTally.prover.test.ts \
  tests/anonymousReviews.test.ts tests/anonymousReviews.http.test.ts tests/lessonSurvey.test.ts
bun tests/reviewTally.zkvm.ts  # CPU-intensive, real synthetic proof; no chain submission
# Optional persistence test requires an EMPTY disposable Memgraph on 127.0.0.1:7702.
bun tests/reviewTally.persistence.ts

cd ../fluentxverse-student-solid-prototype
npm run build
node tests/review-tally.cjs  # local Vite server at 5176; API/receipts mocked
```

Tests cover cross-language encoding, commitment/topic/rating/salt tampering, omission,
duplicate entries, window/finality/reorg failures, missing private content, encrypted
persistence, concurrent claims/certification, single submission, immutable publication,
program/binary pins, sidecar authentication, receipt corruption, administrator boundaries
and desktop/mobile light/dark proof downloads. Real student data is never used as a fixture.
The full server typecheck still has unrelated pre-existing lesson-authoring/integration errors.

## References

- [zkVerify Risc0 verifier](https://docs.zkverify.io/architecture/verification_pallets/risc0)
- [Supported proof formats](https://docs.zkverify.io/architecture/supported_proofs)
- [Exact-block receipt paths](https://docs.zkverify.io/architecture/proof-aggregation/overview)
- [System domains and off-chain bot relays](https://docs.zkverify.io/architecture/proof-aggregation/domain-management)
- [Official testnet funding guidance](https://docs.zkverify.io/overview/getting-started/get_testnet_tokens)
- [Pinned zkVerify verifier implementation](https://github.com/zkVerify/risc0-verifier/tree/246268957161b8936cef1c5b9a2940e042916d3c)
- [RISC Zero tooling](https://dev.risczero.com/api/zkvm/install)
