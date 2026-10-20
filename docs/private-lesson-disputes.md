# Private Lesson Dispute Evidence

Dispute evidence activated in production on October 18, 2026. These
application-layer privacy workflows do not claim ZK verification,
confidential AI execution, shielded transfers, or proof that teaching occurred.

## Dispute Evidence

Student and tutor lesson pages can create private snapshots after a lesson ends,
or after cancellation. Each participant selects attendance, overlap and/or
cancellation claims. Evidence is private by default and never resolves a report,
changes attendance, pays a tutor or issues a refund automatically.

Attendance is derived from `session_participants` records for the exact booked
student/tutor, clipped to the scheduled lesson. Intervals end at the last stored
observation or earlier recorded departure. Concurrent/reconnected intervals are
unioned rather than added twice. The threshold is fixed to 15 minutes (or the
scheduled duration for shorter lessons), not a caller-selected value. Missing
heartbeats establish neither absence nor a full-duration connection. Shared room
presence is not proof of media connection, attention, identity/liveness or useful
teaching. Historical records without last-seen observations may be insufficient.

Cancellation claims disclose only whether cancellation occurred, and whether it
was at least one hour before the scheduled start. Missing timestamps remain
unknown; no historical provenance is invented. A fresh snapshot is needed after
corrections; an old signed snapshot describes its issuance-time records only.

Exported JSON contains selected claims, an opaque snapshot ID, a randomized booking
commitment, issuance time, threshold, signature and issuer key information. No raw
participant IDs, booking ID, exact connection intervals, scores or lesson content
are exported. The private database maps a snapshot to its booking/report. This
does not make records anonymous from FluentXVerse or hide network metadata.

Support sharing is a separate opt-in. It requires the owner's existing issue
report for the same booking, is revocable and expires after 30 days. Only an admin
with the live `support` capability can read consented evidence for that report's
author. Evidence from the other participant or another booking is not returned.
Reads and consent changes are audited. The support view clears on close and closes
after one minute. Existing support powers to inspect underlying operational
records remain separate; this feature does not remove them.

## Keys, Storage And Verification

See `fluentxverse-server/config/lesson-privacy.env.example`. The encryption key must
be a dedicated 32-byte random hex key. The signing key must be an Ed25519 PKCS8 DER
private key encoded as base64. Provision them through the deployment secret store,
not a browser build variable or committed environment file. Missing/malformed keys
disable the relevant feature; no temporary production key is generated.

Payloads use AES-256-GCM with random nonces and authenticated context binding kind,
owner, role, booking and evidence ID. Ownership,
field names and lifecycle metadata remain in the restricted
database. Authorized platform services can decrypt payloads. Audit rows contain
record ID, actor, action and timestamp, not the private payload. Payload storage and
its corresponding audit mutation share a PostgreSQL transaction. Schema creation
is idempotent and lazy; the production tables and indexes were initialized during
activation.

Ed25519 signatures cover canonical JSON of the evidence payload. The API serves
the configured public key at `GET /lesson-privacy/issuer`. Independently pin the
issuer key through a trusted channel; a key included in an arbitrary downloaded
file is not a trust anchor. `verifyLessonEvidence` checks signature integrity and
the expected issuer, not real-world correctness, current consent or current
attendance status. No chain transaction, zkVerify submission or custom contract
is introduced. Keep this distinction in grant descriptions.

Back up encryption/signing keys separately from the database. In-place rotation
is not implemented: replacing the encryption key makes old payloads unreadable.
Plan reviewed re-encryption and historical issuer-key retention before rotating.
Expiry immediately restricts support access. A startup/hourly cleanup deletes
expired evidence ciphertext after its 30-day lifetime and audit events older than
90 days. Failed cleanup retries on the next run; access checks do not depend on
cleanup succeeding. This does not delete downloaded exports or database backups.
Backup retention must be managed separately. Revocation cannot recall copies
already read or downloaded. Logging must not capture decrypted evidence or private
request bodies.

## API

All responses, including authentication failures, use `Cache-Control: no-store`.
Student/tutor routes require the correct role-specific authenticated cookie.
Mutations require an allowed browser `Origin`; configure staging/development
origins through `FRONTEND_URLS`. Validation errors are sanitized rather than
logging or reflecting private request bodies through the global error handler.

- `GET/POST /lesson-privacy/:role/:bookingId/evidence`
- `PUT /lesson-privacy/:role/:bookingId/evidence/:id/support`
- `GET /lesson-privacy/admin/reports/:role/:id/evidence`

The API was deployed before the three frontends. Dedicated keys are stored in a
git-ignored, mode-0600 server configuration file and a protected operator backup,
not frontend variables. No Git push was performed. This activation is not an
independent security audit.

## Production Release

The release overlays only dispute-evidence changes onto the existing API image
and committed frontend baseline. Unrelated workspace changes were not published;
student ticketing remains disabled and learning handover remains removed.

- API image: `fluentxverse-server:lesson-disputes-20261018`
- Student Worker: `93549cc3-8657-47df-a0a4-7dda3e2af1f7`
- Tutor Worker: `fddf06d4-873a-404c-aca6-2d753160c352`
- Dashboard Worker: `c33ba994-a06d-4b15-a7ef-e81293679121`
- Public issuer: `https://api.fluentxverse.com/lesson-privacy/issuer`
- Issuer fingerprint: `a5dd19058a23cc8bcdf46f7f5df600ff9202af9e44d46491d928981871882952`

Public release metadata is under the ignored
`output/release/lesson-dispute-20261018/` directory. API rollback configuration and
key backups are under the protected operator state directory referenced by
`api-release.json`. Do not publish those protected files. Frontend rollback
versions are recorded in `frontend-release.json`.

The deployment scripts pin their expected previous versions and are one-release
tools, not safe-to-repeat generic deployment commands. Review current versions
before adapting them for another deployment.

## Verification

Unit checks:

```sh
cd fluentxverse-server
bun test tests/lessonPrivacy.test.ts
bun run typecheck
```

The integration script hard-pins disposable databases on ports 5546 and 7796. It
does not use the running application databases. Start dedicated containers:

```sh
docker run -d --rm --name fxv-lesson-privacy-test-pg -e POSTGRES_USER=privacy_test -e POSTGRES_PASSWORD=privacy-test -e POSTGRES_DB=privacy_test -p 127.0.0.1:5546:5432 postgres:16-alpine
docker run -d --rm --name fxv-lesson-privacy-test-graph -p 127.0.0.1:7796:7687 memgraph/memgraph:latest --also-log-to-stderr
cd fluentxverse-server
LESSON_PRIVACY_TEST=1 bun tests/lessonPrivacy.integration.ts
docker stop fxv-lesson-privacy-test-pg fxv-lesson-privacy-test-graph
```

With student/tutor/dashboard dev servers on 5196/5197/5198:

```sh
node scripts/test-lesson-privacy.cjs
```

Browser fixtures intercept API requests, not real users' records. Screenshots go
to `output/lesson-privacy/`. Run each application's production build as well.

Learning handover has been removed from the student/tutor UI and APIs. The tutor
note-history and assessment behavior changed for that feature has been restored.
Existing records are not deleted by this source change.

Release verification: 8 unit tests, 29 isolated database/API checks (including expiry
cleanup and 404
responses from the removed endpoints), and 10 desktop/mobile browser scenarios
passed. All three staged production builds and server typechecking passed.
Additionally, 41 live HTTPS API checks passed using temporary synthetic identities
and attendance records, including independent Ed25519 verification, role/ownership
denial, explicit consent and revocation. Temporary fixtures are removed in a
`finally` block.

`node scripts/test-live-lesson-evidence.mjs --browser` additionally exercises the
public student, tutor and dashboard deployments at desktop/mobile sizes. It mocks
unrelated profile, certification and report-list responses but sends all
`/lesson-privacy/` requests to the actual production API. This is not a real-user
OAuth, certification or complete booking-lifecycle test. Screenshots are stored in
`output/lesson-privacy/live/`.

The public frontend run passed 53 live HTTPS/API assertions plus the desktop and
mobile UI workflows. Post-test checks confirmed no synthetic graph identities or
student issue reports remained. Disposable integration-test databases were stopped.
