# Dispute Staging Release

2026-10-31: API and all three frontend builds deployed to a private VPS staging
stack named `fxv-dispute-stage`. No production container, volume or Worker was
replaced. There has been no production promotion or GitHub release commit.

## Review Fixes

- Corrected the dispute API's dashboard-only origin check. Tutor and student
  mutations now require their own valid origins; untrusted origins are rejected.
  Actual HTTP integration tests cover both allowed origins.
- Attendance-log reconciliation failures no longer prevent existing case deadlines
  from being processed in the attendance worker.
- Added `REFUND_TRANSFERS_DISABLED=true` for staging. Mock ticket/trial restoration
  remains testable; live Engine transfer dispatch is blocked.
- Rebuilt the staging server dependency layer from the frozen workspace lockfile.
  Simply copying new source into the older API image lacked a required dependency.
- Added explicit application-wide dispute error handling: expected rejections are
  no longer masked as generic 500s by the parent API handler.
- Corrected the staging fixture's storage verb to PUT and its static file handling.
  The staging health check uses IPv4 explicitly rather than an unavailable IPv6
  localhost listener inherited from the older image.

## Isolation

- New Memgraph, PostgreSQL and encrypted-image storage volumes. No production
  account, payment or classroom records copied.
- An internal Docker network with no production network memberships. No production
  signing, Engine, OAuth or SMTP credentials are provisioned.
- Resource limits on all staging containers. Ports are not public; use private
  SSH forwarding to the isolated container addresses.
- The staging file service is a fixture storage adapter, not the production
  SeaweedFS deployment. Production uses the existing encrypted filer adapter.

## Results

- Staging API health and student/tutor/dashboard HTML checks returned HTTP 200.
- Actual staging HTTP pilot passed: trusted/untrusted origins, tutor-only private
  replies, deadline penalty processing, tutor decision-reply denial, and student
  follow-up to staff. Multipart image upload, encrypted fixture-filer storage,
  authorized JPEG download and student denial also passed. Only synthetic cases
  were used.
- Focused regression suite: 48 passed, two legacy PostgreSQL tests skipped;
  272 assertions. The isolated persistence suite also passed the explicit live
  transfer guard test while allowing controlled mock restoration.
- Local isolated persistence tests additionally cover one-time ticket restoration,
  single replies, simultaneous workers, Other/longer-lesson review, staff behavior
  requests, extensions, trial restoration and SYS-501.
- Follow-up local fixes resolved all 40 initial backend compiler diagnostics.
  Full backend typechecking now passes with zero errors and no allowlist.
  Latest compiler results are retained in
  `output/verification/dispute-staging/typecheck.{json,txt}`.
- Cloud pilot evidence: `output/verification/dispute-staging/cloud-smoke.json`.
- Rechecked on 2026-10-31 during the classroom/readability follow-up: the synthetic
  HTTP smoke passed again and all four health/HTML probes returned 200. The
  controlled-email and two-participant lesson gates below are still outstanding;
  this recheck does not authorize production promotion.

## Access And Recheck

Run `node scripts/open-dispute-staging.mjs` to create private local forwards:

- Student: `http://127.0.0.1:5174`
- Tutor: `http://127.0.0.1:5173`
- Dashboard: `http://127.0.0.1:5175`
- API: `http://127.0.0.1:18865`

Only synthetic staging identities exist. Production credentials are not valid.
The forwarding command does not bypass application authentication or create login
credentials. Stop it with Ctrl+C. Recheck with
`node scripts/verify-dispute-staging.mjs` (creates a synthetic staging case).

## Outstanding Release Gates

- Confirm a controlled email recipient and verify real SMTP reminder delivery.
  Staging deliberately cannot send mail with the current isolated network and no
  SMTP credentials; this is not claimed as tested.
- Provision explicit pilot identities/login access and run an actual lesson with
  people on separate accounts/networks. The synthetic HTTP pilot is not that test.
- Image upload/download against the staged fixture filer passed; verify the
  eventual production Seaweed adapter configuration before promotion.
- Pin and review the exact release source manifest before committing or pushing:
  the workspace contains many unrelated pre-existing changes. The staging snapshot
  is not authorization to publish every dirty file.
- After the gates pass, coordinate API/frontend promotion and monitor refunds and
  deadline backlog. Deferred SMS/additional penalties remain disabled.
