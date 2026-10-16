# Anonymous Verified Tutor Reviews

## Status

Deployed as an isolated Horizen testnet pilot on October 12, 2026 (Asia/Manila).
The registry is `0x71611f8971a31B78a281FD2a32Ed6c09bFA1Aa6B`, with a dedicated
restricted Engine project and pinned proving artifacts on the student host. See
[the deployment record](anonymous-reviews-deployment.md) for activation, live verification
and privacy limitations. Use `config/anonymous-reviews.env.example` for a fresh disabled
environment; the private generated runtime file is excluded from Git. The pilot uses Semaphore
4.14.3, its depth-8 verifier and official 4.13.0 proving artifacts used by that release.
It does not use Vela, TEEs or a custom trusted setup.

## Policy And User Flow

One eligible student can enroll once per tutor per UTC calendar month. Eligibility
requires an owned completed lesson whose scheduled end has passed, with tutor and
student both marked present. A lesson already reviewed in the legacy flow cannot
qualify enrollment. Registration closes at the beginning of the following UTC month.
Existing attendance is an authorized platform attestation, not independently proved
call duration, educational quality, payment, liveness or anti-collusion evidence.

The browser creates an independent random Semaphore identity for each account/cohort,
stores its private key on the device, and sends ONLY its commitment during authenticated
enrollment. Account-keyed local storage avoids mixing keys on shared devices. Enrollment
is immutable; losing a key requires restoring its private downloaded backup, not issuing
a second entitlement. Backups must be kept private. No server recovery escrow exists.

An operator freezes and activates a single root after the month ends. At least five
distinct eligible students must have enrolled; at most 256 fit the depth-8 pilot.
Membership cannot grow, shrink or be republished under a new root for that scope.
Reviews open for the first seven days of the following month. Students return through
`/reviews`, available as Feedback in the desktop sidebar or My feedback in an enrolled
lesson's panel. Legacy surveys stay unchanged when
the feature flag is off; while it is on, new identity-linked survey submissions are
blocked. Historical reviews are neither relabeled anonymous nor migrated.

Only structured ratings and six predefined topics are supported. No comments, names,
recording references or booking IDs are accepted. A random 256-bit salt hides the
low-entropy feedback in its public commitment. The proof binds the exact normalized
feedback commitment, frozen root and deployment/tutor/period scope. Browser proof
generation runs in a worker with explicitly supplied, SHA256-checked WASM and zkey
assets. Private keys and membership witnesses never enter the API or Engine.

The pure policy module lives in the server and is synchronized to a committed browser
copy by the student `pretypecheck` script. A parity test prevents drift; standalone
frontend Docker builds can use that copy without importing outside their build context.

Submission bypasses authenticated Axios, omits cookies and authorization, and strips
the referrer. The API rejects identity-bearing POSTs. A deterministic scope/nullifier
key makes retries idempotent and rejects changed feedback or duplicate entitlement
use. The client persists its exact pending payload before submission; retries do not
generate a different salt or secretly change the feedback.

## Trust And Privacy Boundary

Enrollment records link accounts to commitments. Submission records contain cohort,
nullifier, proof and AES-256-GCM-encrypted structured feedback with context-bound AAD.
They contain no student ID, booking ID, IP, cookie, exact timestamp or enrollment link.
Protect database access and the dedicated encryption key; encryption does not hide
feedback from the platform operator who processes it.

This is unlinkability of proof submissions within an eligible cohort, not a guarantee
of anonymity against a malicious platform, compromised device, traffic observer or
colluding cohort. Five members is a minimum safeguard, not five honest strangers.
Browser/XSS security, enrollment integrity, issuer honesty and server-delivered code
remain trusted. The operator can censor or inject eligibility; ZK does not fix that.

App request/error logs skip `/anonymous-reviews/`. The deployment review found no
frontend analytics integration, explicitly disabled Worker observability, and confirmed
that the Engine receives only server-to-server requests without student headers.
Cloudflare still sees source IPs; provider-side CDN/WAF retention could not be independently
verified with the available token. This pilot does not claim infrastructure-wide zero
retention or network anonymity. Deploy a privacy-aware relay/separate origin if stronger
network unlinkability is required. Do not claim privacy from FluentXVerse merely because
a student ID is absent from a table.

## Verification And Publication

The server first verifies the actual Semaphore proof locally against the packaged
depth-8 key, using a bounded Node subprocess to isolate crypto workers from Bun. Only
public proof inputs enter this subprocess. Node is already in the server image.
An operator submits its unpacked Groth16 proof through a dedicated Engine
project to zkVerify Volta. The exact native statement is checked on return; finalized
zkVerify submissions remain pending until the Horizen contract accepts their receipt.
There is no mainnet switch in this pilot: the current generic Engine API supports Volta.

`AnonymousReviewRegistry.sol` pins bridge/domain/native VK hash, accepts only the
registered root and scope during its fixed window, and consumes a scope-bound nullifier
only after receipt verification. Its four public inputs are:

```text
merkleTreeRoot, nullifier, keccak256(uint256(message)) >> 8, keccak256(uint256(scope)) >> 8
```

Semaphore's exposed message/scope are NOT the actual SNARK public signal hashes.
The zkVerify leaf uses canonical 32-byte little-endian scalar encoding. Contract tests
check matching backend encoding, wrong roots/scopes, invalid receipts and duplicate
claims. No raw rating is emitted onchain, only its salted commitment hash.

After the window closes, publication requires at least five onchain-accepted reviews.
Only one immutable aggregate snapshot (average, distribution, topic counts) is served
per cohort. There are no individual-review, live count or rolling tally endpoints.
The student tutor-profile Reviews tab shows published anonymous batches separately
from historical ratings. They are not silently merged into legacy tutor scores.

Each included review is proof-backed; the PLATFORM computes the aggregate. This is
not a ZK proof of tally correctness, full inclusion, review honesty or sentiment.
An opt-in [provable tally upgrade](provable-review-tallies.md) now implements ZK-proven
arithmetic and separately auditable full-inclusion checks. It is disabled until its
approved prover and dedicated Engine project are deployed. It does not relabel old batches.
Chain/public endpoints fail closed when the registry or verification is unavailable.
RPC reads use the `finalized` block tag. The selected RPC must implement it; a receipt
on an unfinalized block is not yet reported verified.

## Deployment Checklist

1. Run `node scripts/prepare-anonymous-review-artifacts.mjs` from the server. Review
   the downloaded artifacts, their upstream ceremony/audit provenance and printed pins.
   The script checks the zkey's exported VK against the packaged Semaphore verifier.
   Provision generated public assets on the student host before building/deploying it.
2. Obtain the native VK hash and working receipt bridge/domain for Horizen testnet.
   Deploy the reviewed registry with the depth-8 VK hash and trusted governance;
   enable it explicitly. No addresses or hashes are guessed.
3. Create a dedicated Engine project with chain, destination, proof/domain and signer
   restrictions. The generic contract-write API must support JSON-encoded array
   arguments. Confirm its actual allowlist/ABI behavior before enabling the pilot.
4. Set artifact pins, RPC/contract/bridge/domain/native-VK configuration and a dedicated
   random storage key. Restrict and back up keys, establish retention/erasure and review
   access policies, and verify infrastructure logging. Turn the flag on for a small pilot.
5. Enroll five real test students from qualifying lessons. Freeze the cohort at month
   end, confirm root activation, submit real browser proofs, obtain aggregation receipts,
   certify, wait for chain confirmations, then publish after the review window closes.
6. Review expiry, wrong-network, duplicate, altered-message, unavailable-chain, lost-key,
   uncertain-transaction and small-cohort cases before any production/mainnet expansion.

## Operator API

Mutations require an operations administrator, approved dashboard Origin and rate limits.

```text
GET  /anonymous-reviews/me                       authenticated enrollments only
GET  /anonymous-reviews/lesson/:bookingId          owned eligibility
POST /anonymous-reviews/enroll/:bookingId          {commitment}, authenticated
GET  /anonymous-reviews/public/group/:id           frozen anonymous commitments
POST /anonymous-reviews/public/submit              {groupId, content, proof}, no cookies
POST /anonymous-reviews/public/status              {id}, no cookies
GET  /anonymous-reviews/public/summary/:id          immutable aggregate or unpublished
GET  /anonymous-reviews/public/tutor/:tutorId       published batches only
POST /anonymous-reviews/admin/group/:id/activate
POST /anonymous-reviews/admin/review/:id/submit
POST /anonymous-reviews/admin/review/:id/certify    {aggregationId, merklePath, leafCount, index}
POST /anonymous-reviews/admin/group/:id/publish
```

Use a single pilot operator. Database uniqueness/CAS guards prevent simple duplicate
submissions, but automatic aggregation watching, durable work scheduling and uncertain
Engine transaction reconciliation are NOT implemented. A timed-out proof remains
`submitting_zkverify`; investigate its Engine/chain outcome rather than resubmitting.
Activation and certification also claim their database state before queuing; uncertain
`queuing`/`certifying` outcomes require operator reconciliation, not blind retries.
Operators query pending proof records through restricted database tooling; there is
no public enumeration API or new administrator console. The pilot deployment is not an
independent security audit. Obtain that review before expanding beyond the pilot.

Aggregation paths must be resolved at the exact zkVerify block emitting the matching
`NewAggregationReceipt` event, not an arbitrary later finalized block. Backfill finalized
events after the proof's submission block so a restarted operator does not miss the
publication. The deployment smoke utility demonstrates this lookup without writing
synthetic feedback into the application's database.

## Verification

```bash
cd fluentxverse-server
node scripts/prepare-anonymous-review-artifacts.mjs
bun test tests/anonymousReviews.test.ts tests/anonymousReviews.http.test.ts tests/lessonSurvey.test.ts

cd ../contracts/anonymous-reviews
npm ci --workspaces=false --ignore-scripts
npm test

cd ../../fluentxverse-student-solid-prototype
npm run build
# Run with a local Vite server; API and chain receipts are mocked.
node tests/anonymous-reviews.cjs
```

The real proof test explicitly skips if public proving assets have not been provisioned;
unit tests do not download them implicitly in CI. Browser and contract tests require
those assets and Node 24. The isolated persistence script additionally requires an
EMPTY disposable Memgraph container at `127.0.0.1:7701`; never use the live database.
Local tests verify real proof math but simulate receipt bridges/Engine actions. The
separate deployment smoke uses actual Volta/Horizen transactions and a synthetic cohort;
it is not evidence of real student usage or a completed monthly publication cycle.

## References

- https://docs.semaphore.pse.dev/guides/proofs
- https://docs.semaphore.pse.dev/guides/groups
- https://docs.semaphore.pse.dev/guides/identities
- https://docs.zkverify.io/architecture/proof-verification-smart-contract
