# Tutor Identity Verification

Current credential status (2026-11-03): the separate identity circuit and automatic
TEST-only proof/NFT worker are now implemented and deployed. The finalized Volta/Arbitrum
Sepolia pilot passed. See [the identity credential pilot](tutor-identity-credential-pilot.md).
Production Arbitrum One identity issuance remains disabled. Earlier release notes below
describe the state of those releases, not the current testnet capability.

Tutor home now includes identity-submission status before interview booking and an illustrated
preparation section. `/interview-guide` is a protected applicant guide with setup and speaking
tips, same-ID instructions, staff-review expectations, booking rules and an interactive pre-call
checklist. It uses the existing application artwork and supports light/dark themes. Tutor-only
Cloudflare release: `b66c37da-687e-41aa-af7d-8b8204913824`; backend/Engine/storage are unchanged.

Current storage: [encrypted private SeaweedFS](tutor-identity-storage.md). This supersedes the
historical RAM-storage activation notes below. Images now persist across restarts and are
deleted according to the original deadlines; the RAM-retention mount has been removed.

The applications list also displays separate Profile Submission and Profile Review columns,
derived from the current backend `profileStatus`. Incomplete profiles show Not submitted / Not
started; pending-review, approved and rejected profiles show Submitted and their respective
staff review outcome. Unknown statuses do not imply submission or approval. The dashboard-only
release `9b306994-08c2-4631-a546-adfdb5bff150` passed status-mapping tests, a production build,
and local/published browser checks at 1566, 1440, 1280, 1024, 390 and 320 pixels.

The follow-up dashboard release `87ca037d-62d2-4837-92ad-c94982d724b1` places ID Submission
between Speaking and Interview. Schedule Interview is shown only for accepted ID submissions;
pending ID reviews link to Identity Reviews instead. Profile columns remain separate. No API,
stored application records, identity-storage policy or Engine settings changed in this release.

## Implementation Status

The applicant upload, staff review, interview gate, live comparison, encrypted image storage,
retention worker and resubmission notifications are implemented in the Elysia API, Solid tutor
app and Preact admin dashboard. The code was deployed on 2026-11-02. ID uploads are enabled
using private encrypted SeaweedFS and persistent per-image keys.
Application state and mail jobs are in Memgraph, not Postgres.

New ID submissions mark that applicant as identity-required. Lesson search and booking reject
identity-required tutors until approval, and reject banned tutors. Existing certified tutors
are not silently retrofitted with an ID requirement; decide their migration separately.

Identity approval and teaching approval are distinct. A live ID match now records
`awaiting_interview_pass` without creating an issuance request. Saving a passed interview
creates one durable `TutorIdentityCredential` request per verified submission, with
`expiresAt = 0`, bound to that interview and its passed timestamp. This is not a proof or
NFT. Its explicit status remains `awaiting_configuration` until the issuance pipeline exists.
Correcting a pass to fail cancels the pending request; a later pass reuses the same request.
An eventual issuance worker must recheck the latest interview result, current identity and
wallet binding before proof generation and minting; old pre-policy requests require that
same eligibility check and must not be processed solely by their queued status.

The identity-specific ZK circuit, approved proving release, Engine proof/mint worker and
non-transferable credential contract are **not implemented in this release**. No existing
screening proof is repurposed as identity evidence. There are no chain transactions or token
issuances in the tests or in this change. Do not advertise wallet credentials as live.

## Agreed Policy

- Both exams and email confirmation precede submission. All 16 requested document types are
  accepted; `shared/tutorIdentity.ts` is the shared list.
- Applicants declare their date of birth; the server checks age using the Manila calendar.
  The date is not retained by this service. Staff must independently confirm age 18+ from the
  document before acceptance and again during a successful live comparison.
- Staff acceptance starts an exact 84-hour booking window. It is not an interview-completion
  deadline. No extension is provided, including when there are no slots.
- New interview slots and new bookings are limited to the next rolling 72 hours. Existing
  bookings are not silently deleted by this change.
- Applicant cancellation invalidates acceptance and requires a new upload. Admin cancellation
  before live approval restores acceptance only for the **remaining original** booking window;
  it does not extend that window. Cancellation after live identity approval requires resubmission.
- A booked 30-minute interview with no tutor room-entry record is a no-show after its end.
  Entry records are server-generated; each new booking clears prior occupant entry/check data.
  When this feature is enabled, room entry is limited to 15 minutes before start through the
  30-minute scheduled end. A room entry proves presence in signaling, not genuine attendance
  for the whole interview or successful video delivery.
- If no booking is made by the deadline, acceptance expires, access to the image closes,
  the worker deletes it, and a resubmission email is queued.
- Blurry, unreadable or unsuitable documents result in resubmission, not a ban. Rejected images
  are deleted at the next Asia/Manila midnight.
- Live mismatch closes the interview and requires a new upload and booking. Existing exam
  passes are not erased. Image access ends immediately; physical deletion is worker-driven.
- A successful live match is independent of the teaching result. After the final teaching
  decision, the uploaded image is scheduled for the next Manila midnight. Only minimal
  verification, access, decision and credential-request records remain.
- Fraud requires an explicit staff action and reason, with a separate confirmation in the UI.
  It bans the account, closes booked interviews and revokes queued credentials. Login and
  existing tutor JWT authentication reject banned accounts when the feature is enabled.
- Identity credentials have no automatic expiry but must support revocation, duplicate-safe
  issuance and wallet recovery. This does not mean that a document can never expire or that
  FluentXVerse independently guarantees government document authenticity.

## Storage And Operations

Enable only after configuring and reviewing the following:

```text
TUTOR_IDENTITY_ENABLED=true
TUTOR_IDENTITY_PRIVATE_DIR=/var/lib/fluentxverse-private/tutor-identity
```

Use a dedicated private volume, never a static/public directory, a repository folder, or a
SeaweedFS public media prefix. Restrict the volume root to the API service account, mode 0700.
Each submission has one sanitized JPEG encrypted with AES-256-GCM, a fresh random 256-bit key,
a 96-bit IV, and authenticated submission context. Keys and ciphertext are separate files with
mode 0600. Keys are not derived from a master secret and are not persisted in Memgraph.
Deletion removes the key first, then the encrypted image directory. Repeated deletion is safe.

**Exclude both this volume and its keys from backups and VPS snapshots.** A snapshot containing
both can recover an image after live deletion. Configure provider snapshots accordingly before
collecting real IDs, or do not enable collection. Volume exclusion cannot be enforced by this
application. No claim of secure erasure from an SSD or provider backups is made.

Image decoding uses `/dev/shm`, verifies that it is tmpfs, strips metadata and deletes temporary
files after processing. Disable swap and core dumps for the service; tmpfs alone does not
prevent swapping. Originals, extra image copies and thumbnails are not intentionally retained.
The maintenance worker sweeps abandoned identity-specific tmpfs directories older than five
minutes to recover from interrupted image decoding.
Restrict debug tooling and request-body logging; no ID is submitted to an AI service or chain.
Memory buffers and browser displays are not an absolute no-traces guarantee.

Install ffmpeg/ffprobe. The API accepts PNG/JPEG/WebP up to 5 MiB, bounds the multipart body to
6 MiB including chunked bodies, and allows at most two concurrent image decodes per process.
Applicant submissions have a one-minute cooldown. Staff-only image reads are authenticated,
audited, owner-independent, and `private, no-store`. No public storage URLs are returned.
Reviewers need the existing `operations` capability. Issuer links distinguish verification
tools from issuer contact/guidance; school IDs require independently established school contacts.

The retention worker starts after Memgraph initialization, polls every minute, and processes
bounded batches. It serializes lifecycle changes with booking/cancellation via the applicant
write lock. Filesystem deletion precedes the deletion marker, so interruption retries safely.
Unreferenced uploads older than an hour are swept after checking Memgraph (including uploads
whose transaction acknowledgement was lost). Do not delete an upload merely on an uncertain
commit outcome. Monitor `Tutor identity maintenance requires attention` errors.

Mail jobs use a two-minute Memgraph lease and five-minute retry on failure. They send from
`tutor@fluentxverse.com` with a stable Message-ID and no document attachments. SMTP delivery is
at-least-once: a crash after SMTP acceptance can result in a duplicate email, not a duplicate
identity decision. No delivery deadline or inbox guarantee is implied.

## UI

- Tutor: `/interview`, identity section before the calendar; booking buttons remain disabled
  until staff acceptance and while identity status cannot be checked.
- Dashboard: `/identity-reviews`, with a sidebar entry, private document viewer, issuer resources,
  age confirmation, acceptance/resubmission and explicit fraud action.
- Interview room: identity comparison in the review panel. Start the unrecorded ID check only
  after stopping/saving recording. Both participants must be connected. Recording controls are
  disabled during this step. Staff records Match or Mismatch independently of teaching scores.
  These controls cannot prevent external screen recording by a participant or device.

## Verification

Use synthetic images only. Persistence tests refuse any database other than the dedicated
empty localhost graph and refuse to run on a populated graph:

```sh
cd fluentxverse-server
bun test tests/tutorIdentity.test.ts tests/tutorIdentity.http.test.ts
IDENTITY_TEST_URI=bolt://127.0.0.1:17741 bun test ./tests/tutorIdentity.persistence.ts
```

Browser tests need the local dashboard on port 5191 and tutor app on port 5192. All application
API requests are mocked; the test sends no real applicant data or mail:

```sh
node scripts/tests/tutor-identity-ui.cjs
```

## Remaining Credential Work

1. Define a new identity attestation circuit and policy. It must prove a trusted issuer approved
   an adult, same-document live comparison, not pretend to validate ID images or AI face matching.
2. Pin a separately verified proving release and issuer key under an accurately disclosed setup
   policy. Keep raw ID images/numbers, DOB and unsalted image hashes out of witnesses and public inputs.
3. Require destination-wallet control and explicit acknowledgement of the public wallet link.
4. Implement durable Engine proof submission and official receipt verification for the project's
   selected destination. Bind the claim to chain, credential contract, holder and policy.
5. Implement and test non-transferable issuance, permanent validity, revocation and recovery.
   Recovery must revoke the old credential and prove control of the new wallet before replacement.
6. Test timeout reconciliation, tampering, wrong holder/chain/policy, duplicate minting and revoked
   identities before enabling issuance. Do not infer completion from `awaiting_configuration`.

## Deployment: 2026-11-02

- API image: `fluentxverse-cloud/api:tutor-identity-20261102`, built as a scoped overlay on
  `notification-resolution-legacy-20261031`. The global API error handler explicitly preserves
  identity authentication/validation status codes. Initial verification caught a wrong status
  and rolled back; the corrected image passed and is the running image.
- Tutor Cloudflare version: `200bbab0-87cf-493e-b0e6-f123369a6b9a`.
- Dashboard Cloudflare version: `129253ea-545e-479b-812c-4834ac9272c6`.
- `TUTOR_IDENTITY_ENABLED=false` is explicitly pinned in the API Compose override. No real
  documents, keys, bans or identity records were created by deployment verification.
- Exact scoped builds passed six desktop/mobile browser checks before publishing and six
  checks against published assets with mocked API data. The VPS image passed seven focused
  policy/storage/auth tests and an application bundle build.
- Existing student frontend, staging-only dispute workflow, Engine and wallets were unchanged.
- Release manifests and verification records are in `output/release/tutor-identity-20261102/`.

### Admin Follow-Up

- API: `fluentxverse-cloud/api:tutor-identity-admin-20261102`.
- Dashboard: `a2ea595f-4cc4-433a-aa86-f5529ed1cf7f`.
- `/tutors` includes profile approval and identity status; `/applications` distinguishes ID
  submission, acceptance, pending review and fraud from interview readiness.
- Three derived-certified tutors were reset to written-pass status at the operator's request.
  Speaking attempts and interviews were archived, not deleted. Profile review is required
  again. The separate salary-test waiver was not reset. Live queries confirmed zero remaining
  certified tutors and three applications at `pending_speaking`. A private rollback snapshot
  was saved outside the repository before mutation. Existing lessons/finance were untouched.
- Correction: the operator clarified that completed speaking assessments must also remain passed.
  All three original speaking pass records were restored from the protected pre-reset snapshot;
  interview/profile approval remains reset. The intended next step is ID submission, not a
  speaking retake. The erroneous reset script is retired to prevent accidental reuse.
- ID collection is still disabled. VPS Docker rejected the `noswap` tmpfs option; host storage
  configuration requires sudo, which the deployment account does not possess noninteractively.
  Do not enable uploads on swappable tmpfs while promising that images cannot enter disk snapshots.
- Engine's current ERC-1155 template is transferable and has no ZK receipt verification.
  No contract was deployed in this follow-up. Operator selection of a non-transferable credential
  implementation versus a standard collection with disabled issuance is pending.

### ID Upload Activation

The provisioned SSH key supports direct root access; no sudo password was needed. The runtime
now sets `TUTOR_IDENTITY_ENABLED=true` and uses `/run/tutor-identity`, bound from a dedicated host
tmpfs at `/run/fluentxverse-tutor-identity`. The 128 MiB mount is `noswap`, private to UID 100/GID 101,
and configured in fstab. Docker's systemd unit requires this mount before future startup.
The unused `/swap.img` swap was disabled persistently. zram has no disk backing/writeback.
API core dumps are disabled. The original Go-server key file was restricted from mode 0644 to
0600; access used the already-provisioned working key, without exporting private key material.

This is **ephemeral closed-testing storage**, not durable object storage. Pending images and
keys are not backed up and are lost if the host restarts or this mount is lost. The startup
recovery worker invalidates missing pending submissions and requests resubmission; identity
approval records already completed remain separate. Ordinary disk snapshots do not capture
this mount's files; this is not a defense against a privileged provider capturing RAM or an
administrator copying documents elsewhere. Reassess storage durability before wider rollout.

The real HTTP upload, AES-GCM readback and unauthorized image-access rejection passed using a
synthetic applicant and one-pixel synthetic image. Test records/files were removed afterward.
No real ID, mail, token mint or ZK submission was used. Release verification is recorded under
`output/release/tutor-identity-activation-20261102/`.

### Pending Review and Outcome Emails

- The pending-review screen now acknowledges receipt, asks applicants to allow 24-48 hours,
  and explains that they can return to check their account and will receive an outcome email.
  It includes a status refresh and a link to interview preparation. The timeframe is guidance,
  not an automatic review decision or a guaranteed staff-response deadline.
- Every review action queues an email in the same Memgraph transaction as the decision:
  acceptance, resubmission, live match, mismatch, revocation and explicit fraud rejection.
  Acceptance includes the exact Manila booking deadline; resubmission explains deletion and
  when another image can be uploaded. Identity approval is separate from teaching approval
  and does not claim that a wallet credential has been issued.
- The worker sends through the configured `tutor@fluentxverse.com` SMTP account. Failed sends
  retry after five minutes; a storage-cleanup error does not block queued review emails.
  SMTP acceptance is not a guarantee of inbox delivery. Stable notice/message IDs prevent
  routine repeat sends, but a crash after SMTP acceptance can still cause an at-least-once resend.
- Validation: seven focused tests, a disposable-graph lifecycle test with 87 assertions
  (including all review outcomes and a simulated SMTP failure/retry), and six desktop/mobile
  tutor/admin browser checks. Test mail delivery was mocked; no applicant received test mail.
- Release: `output/release/id-review-status-20261102/`. Encrypted SeaweedFS storage and
  disk-backed private keys remain as described in `tutor-identity-storage.md`; that current
  storage design supersedes the historical tmpfs activation notes above.
- Deployed API image: `fluentxverse-cloud/api:id-review-status-20261102` (healthy).
  Tutor Cloudflare version: `8efafa93-7a99-4798-983b-0e23aa8cb82f`. All six browser checks
  also passed against published assets with synthetic API data. Runtime checks confirmed
  identity collection remains enabled, the review-mail sender is configured, and the private
  key directory setting is unchanged. No applicant records were modified by verification.

### Immediate Resubmission

Rejected/resubmission-required and expired applicants can upload a replacement immediately,
without waiting for deletion or midnight. The new encrypted image is persisted first; the
applicant-locked transaction switches the current submission and marks the old image due for
deletion. After commit, the old image/key is removed. Failed deletion is retried by maintenance
and does not discard the replacement. Concurrent replacements still allow only one current
pending submission. If no replacement is submitted, the original deletion deadline remains.
Review emails and the tutor form reflect this rule. Historical instructions above that require
waiting for deletion are superseded. Lifecycle coverage includes replacement before midnight,
new pending status and deletion of the rejected image (94 assertions total).
Deployed API: `fluentxverse-cloud/api:id-resubmission-20261102`; tutor version:
`6a0591e2-488b-44ec-9573-fc003d5d7705`. Scoped frontend/server typechecks and seven focused
tests passed. Release artifacts: `output/release/id-resubmission-20261102/`.

### Interview Booking Layout

The booking screen summarizes ID acceptance and its deadline above an unframed availability
workspace. Future available times are grouped by date, without filtering out morning or
afternoon slots based on the current clock. Empty availability shows a single message and
working refresh action instead of an empty calendar. Interview preparation remains alongside
the desktop list and stacks below it on mobile. Existing booking confirmation, scheduled
appointment and cancellation flows are preserved. No backend/policy changes are included.
Scoped typecheck/build and twelve browser combinations (1440/390/320, light/dark,
empty/available), including refresh and booking confirmation, passed. Release artifacts:
`output/release/booking-layout-20261102/`.
Published tutor version: `d4388ffb-7762-47d4-89a6-8abacac64360`. The same twelve browser
checks passed against published assets using synthetic API responses, without real bookings.

### Application Column Alignment

Dashboard headers and application rows share one column-size definition; status text no longer
changes each row's track sizes. All four application steps have equal-width tracks, and action
buttons align to the Actions heading. Responsive stacked layouts remain. CSS-only release:
`output/release/application-alignment-20261102/`, dashboard version
`fccdabba-d9d1-463e-8037-bf3ff8844975`. Build and six viewport checks passed, including exact
header/row and icon alignment assertions. Application behavior and API are unchanged.

Follow-up: all step labels now occupy a single 15px line, with extra width for ID Submission.
Connectors align to icon centers, and tests assert equal label top positions and no wrapping
at all six widths. Dashboard version: `492a18c7-b6c2-4dec-b34c-72baf8f08565`; release:
`output/release/application-label-alignment-20261102/`.
The Application steps heading is centered over the full four-step group. Center-position
assertions were added to the six-viewport browser checks. Dashboard version:
`f68ede6b-d917-476d-88f1-e2a0cc20ad7a`; release: `output/release/application-step-centering-20261102/`.

### Tutor Identity Screen Redesign

The upload and pending-review views share a three-stage submission/review/booking progress
indicator. The form has a keyboard-accessible image picker, local object-URL preview and
removal, client-side file-type/5 MB validation, a submission checklist, and expandable
retention details. Preview URLs are revoked when replaced, removed, submitted or unmounted;
no localStorage/cache persistence was added. Server validation and encryption are unchanged.

The review screen separates the expected 24-48 hour timeframe and status refresh from email
notification details. Pending applicants see an application heading rather than an invitation
to book before acceptance. Mobile layouts stack the form/checklist and review/email sections.
Existing 84-hour deadline, all sixteen IDs, adult/consent checks, immediate resubmission,
email workflow and booking eligibility remain unchanged.

Release: `output/release/tutor-identity-design-20261102/`. Tutor typecheck/build passed;
browser coverage includes file validation, real PNG preview/removal, replacement submission,
pending review and all twelve booking viewport/theme cases. No real documents were used.
Published tutor version: `d392ade3-169a-4fdc-bb11-13f79fbd550d`. API and admin dashboard
unchanged by this release.

### Interview-Pass Credential Gate

Deployed API image: `fluentxverse-cloud/api:identity-interview-pass-20261102`.
Live ID matching now leaves the credential awaiting interview pass. A passed interview
creates the pending credential request; correcting the result to fail cancels an unissued
request. Proof generation and NFT issuance remain unconnected, not enabled by this release.

Server typechecking passed, the persistence lifecycle test passed with 100 assertions,
and the image's focused identity tests passed (7 tests, 36 assertions). The API was healthy
after activation. Existing unissued requests were reconciled; a read-only check confirmed
the single pending request has both a verified identity and a passed, bound interview.
No chain transactions were submitted.
