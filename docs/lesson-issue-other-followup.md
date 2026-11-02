# Tutor Other issue follow-up

Selecting Student-related issue > Other creates a private lesson conversation in
the tutor inbox. The same conversation is available in the administrator inbox.
It includes the scheduled day, start/end time, explicit Asia/Manila timezone, and
the exact reply deadline. A personal notification links to the inbox.

The deadline is 24 hours after the warning conversation is durably created, not
24 hours after the lesson ends or after the tutor reads the message. The issue
dialog warns about this before submission. A valid tutor explanation must contain
10 to 2,000 non-whitespace-trimmed characters and omit student personal information.
Staff replies do not satisfy the tutor's obligation or extend the deadline.

At the deadline, a report without a tutor reply receives TA-301. Enforcement runs
on startup and once per minute, with catch-up after restart. A reply at or after
the exact deadline does not prevent the penalty. A later reply remains available
for staff review once the penalty is recorded; it does not automatically revoke it.
Cancelled bookings do not receive this penalty.

## Storage and Safety

- Conversations, replies, deadlines, penalty records, and audits live in Memgraph.
- The existing PostgreSQL report row acts as the delivery outbox. Failed dispatch
  is retried without duplicating the conversation or resetting its deadline.
- Deadline enforcement runs separately from the PostgreSQL delivery step.
- Reply and enforcement transactions lock the same conversation node. Repeat
  workers cannot penalize a timely response or repeat a processed timeout.
- Existing active TA-301 penalties are reused. The existing repeat-absence blocking
  policy is applied after assignment.
- Classroom presence is not falsified: the penalty carries an explicit
  `issue_reply_timeout` source. TA-301 bookings are excluded from payable earnings.
- Tutor endpoints derive ownership from authenticated cookies. Only authenticated
  administrators can access all tutor conversations and post staff responses.

## Verification

Unit tests cover option validation, exact deadline boundaries, message wording,
and empty/oversized explanations. The disposable Memgraph/PostgreSQL test covers
report creation, outbox recovery, duplicate notifications, ownership, authentication,
privacy checks, timely responses, staff-only responses, cancellations, and
concurrent timeout workers. It uses a controlled clock rather than waiting a day.

```bash
cd fluentxverse-server
bun --no-env-file test tests/lessonIssueFollowup.test.ts tests/lessonTroubleReport.test.ts tests/tutorEarnings.test.ts
```

The persistence test refuses any graph except `bolt://127.0.0.1:17729`, requires
it to be empty, and exercises the PostgreSQL outbox only against the explicitly
guarded disposable database on port 17732. Never point it at application databases.

Mocked browser tests cover tutor and administrator inboxes at desktop/mobile sizes,
light/dark themes, reply failure recovery, and preservation of unsent text during
refresh. They do not send real reports or apply real penalties.

The API and both frontend apps must be released together to activate the workflow.

## Staff Decisions and Images

Staff can explicitly choose TA-301, No penalty, or Delete slot (PAST), with a
required explanation and a version check against competing staff decisions.
Each change records its actor, timestamp, previous booking snapshot and outcome.
An explicit decision stops the unanswered-message timer from overriding staff.
Staff can reverse an automatic TA-301. Penalty-block counts are recalculated.

Delete slot is administrative removal, not record deletion: the TimeSlot becomes
`past`, the booking is retained, and the tutor calendar no longer displays it as a
booked lesson. It cannot earn compensation or receive a lesson-outcome credential.
It does not automatically refund a ticket or transfer money. No penalty also does
not fabricate attendance; all other completion/earnings rules still apply.

Tutor and staff replies accept up to three PNG/JPEG/WebP images, at most 5 MiB
each, alongside an explanation. FFprobe checks the decoded dimensions and codec;
FFmpeg re-encodes the first image frame to JPEG, strips metadata, and limits the
output to 2048 pixels per dimension. Upload admission is authenticated and bounded
to 16 MiB, with concurrency/rate controls from the shared request-defense layer.

Files use authenticated encryption under a domain-separated key derived from the
existing `QA_RECORDING_ENCRYPTION_KEY`, and live in Seaweed's private lesson-issue
namespace. Only the conversation's tutor or authenticated staff can read an image
actually attached to a committed reply. Downloads are non-cacheable and access is
logged. Original filenames and public filer URLs are not exposed. Screenshots are
not automatically OCR-redacted; users must remove student identifying information.

FFmpeg/FFprobe and the existing recording encryption key must be available for
image replies. Text-only replies remain available if image storage is unavailable.
After an ambiguous database outcome, encrypted files are retained rather than
deleted because a committed reply might reference them; orphan cleanup requires
operator reconciliation. Clients are instructed to refresh before retrying.
