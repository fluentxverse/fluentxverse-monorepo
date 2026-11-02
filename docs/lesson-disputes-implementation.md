# Lesson Disputes: Implementation And Verification

Updated: 2026-10-31. Local implementation only; no VPS or Worker deployment,
production database mutation, live refund or real email delivery was performed.

## Implemented

- Student reporting opens at scheduled start plus two minutes. During a lesson,
  only the three attendance complaints are offered. Afterward, the existing
  categories and attendance complaints remain available for 48 hours.
- A student sends one immutable report per lesson. New cases, private tutor
  explanations, follow-ups, decisions, deadlines and financial holds are owned by
  Memgraph. PostgreSQL continues to supply legacy reports and classroom logs.
- Ongoing missing/late reports queue an email reminder. A dispute response request
  is not sent until scheduled lesson end. Its durable creation starts the full
  24-hour response window. SMS remains unimplemented by product decision.
- Behavior complaints go to staff first. Only an explicit staff explanation
  request notifies the tutor and starts a response deadline.
- A tutor sends one reply, including a short or image-only reply if desired.
  It cannot be edited. The UI closes at the deadline and the API rejects late
  replies independently of background worker progress.
- Ten minutes or less plus a listed tutor-side cause schedules TA-301 at the
  deadline. More than ten minutes, Other, and unstructured replies go to staff.
  Behavior replies always go to staff. Nonresponse applies TA-301 and is labeled
  separately; additional nonresponse penalties are not enabled.
- Confirmed full-lesson tutor no-entry closes an associated case without requiring
  a reply or generating a nonresponse incident. The five-minute no-entry record is
  a separate punctuality statistic, not the final slot status.
- Students cannot read tutor replies or evidence. Tutors cannot reply to decisions
  or see student/staff follow-ups. Students can privately follow up with staff on
  the decision without reopening it, changing deadlines or triggering another refund.
- Staff can choose TA-301, No penalty or PAST, request a behavior explanation,
  extend pending deadlines, approve a separate refund, and record SYS-501 with
  No penalty. Reasons and decision revisions are audited. No penalty retains tutor
  earnings; a student refund can be absorbed by FluentXVerse independently.
- Tutor evidence reuses encrypted private image storage, signature/codec checks,
  metadata-stripping re-encoding, access auditing and owner/staff authorization.
  PNG/JPEG/WebP only, three images maximum, 5 MiB each. The existing recording
  encryption key must be configured; there is no plaintext fallback.
- Unresolved cases block payable earnings and completion-proof requests. Earnings
  also wait for the 48-hour student reporting window. Financial operations and
  report acceptance serialize on the booking record. Existing payout evidence is
  revalidated rather than trusting an earlier unclaimed-earning snapshot.
- TA-301 and separate staff refund approvals create durable refund instructions.
  The existing refund processor restores trial allowance or the original ticket
  once. Unknown/archived payment evidence goes to review, not fabricated success.
  Archived private passes still require manual recovery, not a newly invented token.

## Verification

- Focused policy, reporting, earnings, performance, legacy follow-up and
  request-defense suite: 47 tests passed, 268 assertions; two legacy PostgreSQL
  tests skipped because no disposable PostgreSQL was configured for this run.
- Disposable Memgraph integration: timing, routing, single submissions, privacy,
  automatic/no-response penalties, staff decisions, stale revisions, extensions,
  full-no-show closure, SYS-501, trial restoration and consumed mock-ticket
  restoration exactly once. Concurrent replies/workers are also exercised.
- Playwright: six desktop/mobile inbox scenarios (student, tutor, staff) and four
  reporting scenarios (ongoing/post-lesson). Screenshots are under
  `output/screenshots/student-disputes/`.
- Student, tutor and dashboard production builds passed.
- Follow-up: all 40 original backend compiler diagnostics have been fixed locally.
  Full backend typechecking passes with zero diagnostics; the release gate no
  longer accepts a known-error baseline. No paid proof pilot was rerun for these fixes.

## Release Checks And Limits

- Deploy the API and three frontends together. Do not deploy only the UI against
  the old API. New endpoints are under `/inbox/disputes`.
- Verify real SMTP delivery from the configured tutor mailbox with a controlled
  recipient before rollout. Ambiguous SMTP outcomes are marked for review rather
  than blindly resent. The inbox deadline is independent of email read/delivery.
- Perform a controlled real classroom check across separate accounts/networks.
  Connection logs establish presence, not teaching quality or misconduct.
- Existing SQL reports remain available through legacy review tools. They do not
  acquire retrospective 24-hour deadlines. A legacy tutor follow-up superseded by
  a new student case is retained as an archived graph record.
- Automatic refund authorization for no-report TA-301 lessons is bounded by a
  durable `DisputePolicyActivation` timestamp. Do not retroactively transfer funds
  for historical penalties without reconciling their payment history.
- Deadline worker batches are persistent and bounded; more-than-five-minute overdue
  work generates a staff notification. Email failures also generate a staff notice.
- Staff turnaround targets, appeal-window policy, SMS, and additional nonresponse
  penalties remain deferred. Existing support channels handle reconsideration;
  this change does not introduce a new general-purpose support-ticket product.
- Review retention and orphan-image reconciliation before broad rollout. The initial
  report references retained classroom evidence; an immutable capture of every
  source log at submission is not yet implemented.
