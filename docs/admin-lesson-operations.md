# Admin Lesson Operations

Open `/lesson-operations` in the dashboard. Lesson detail lives at
`/lesson-operations/:id`; account detail at `/operations/people/:role/:id`.
Tutor, student, and session lists link to those records. `/payments` opens
the same workspace's payments view.

## Views

- Live: room presence, browser-reported media connection, initial missing-tutor
  alerts after three minutes, and room-departure alerts after sixty seconds.
- Lessons and Schedule: date-bounded bookings, published slots, and linked detail.
- Notes: draft and changed notes, deadlines, bounded reopening, submission versions,
  and existing attendance archive recovery.
- Issues: assignment, priority, 24-hour review target, private internal updates,
  reporter-visible resolutions, and selection of completed lesson refund transactions.
- Feedback: response opportunities and rate, ratings, satisfaction topics,
  improvement topics, and QA-only written comments.
- Performance: the tutor app's shared calculator, not a parallel scoring formula.
- Payments: ticket transactions and pending or uncertain lesson refunds.
- Audit: operations, attendance, suspension, issue-review, and internal-case history.
- Permissions: superadmin capability assignment with a mandatory audit reason.

## Permissions

Support handles cases, attendance, note reopening, and note recovery. Operations
handles cancellation, rescheduling, penalty revocation, and booking restrictions.
QA sees survey comments and confidential recordings. Finance sees transactions
and approves or links refunds. Superadmins retain all capabilities. Existing
admins without a permissions property retain their previous access; assign an
explicit capability list to restrict them. Empty lists disable admin access.
Guards read the current Admin node, so stale JWT role claims do not restore access.

## Safeguards

Room presence is separate from browser-reported media observations. Neither media
claims nor admin viewing changes attendance evidence. Manual attendance corrections
use the existing reason-required correction service.

Rescheduling requires the same tutor's open, bookable slot, serializes against
ordinary reservations, rejects student overlap, and closes five minutes before
the source lesson. Admin cancellation is an audited support exception available
until the actual start; student cancellation still closes five minutes before.
Changes revoke any existing classroom connection and notify both participants.

Reopening is limited to 1-168 hours and never enables absent/cancelled lesson notes.
It does not count late submissions as on-time. Published versions are immutable;
older lessons retain their current snapshot even if they predate version history.

Penalty revocation preserves the ledger and previews shared-calculator effects.
Removing a booking restriction waives automatic re-blocking for seven days without
removing the underlying attendance penalties.

Refund approval uses the original ticket transaction and existing durable dispatch
identifier. Duplicate approval cannot create a second transfer. Uncertain outcomes
remain review-only; never retry with a new transfer identifier. Historical
cancellations without dispatch evidence require transfer-history verification.

## Verification

Unit tests: `bun test tests/adminOperations.test.ts tests/tutorPerformance.test.ts
tests/lessonNotesEditWindow.test.ts tests/lessonSurvey.test.ts` in the server.

The integration test refuses any graph other than port 7693 and Postgres other
than 5434. These must be disposable test containers, never the shared databases.
It resets its isolated graph and uses a fake transfer engine.

Browser tests: `tests/browser/operations.cjs` in the dashboard, with
`PLAYWRIGHT_MODULE` pointing to an installed Playwright module. API fixtures verify
desktop/mobile flows without changing real accounts or bookings.
