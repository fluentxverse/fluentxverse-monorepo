# Interview Call and Review Lifecycle

- Ending media and reviewing an applicant are separate actions.
- Saving pass/fail stores the evaluation and updates the applicant's interview approval. It does not close media, disconnect participants, navigate away, or mark the call completed.
- Ending the call persists `mediaClosedAt`, `status: completed`, and `completedAt`. An interview without a decision remains pending review.
- Operations admins can reopen the interview room from the calendar or pending-review list and correct an evaluation after the call. Completed results link back to the review editor.
- Each changed evaluation creates an `InterviewResultRevision`. Applicant-level locking serializes changes, the expected review timestamp rejects stale forms, and identical retries are idempotent. An older interview cannot override a newer booking.
- A failing correction clears interview approval and application certification status. Profile approval remains a separate requirement for teaching access.
- Applicant `/home` shows scheduled, pending review, passed, or not passed. A pass advances progress to profile completion and links to `/application/profile`. Results refresh every 15 seconds while visible and on focus/wake.
- Review notes, timestamps, and rubric scores returned by the room endpoint are admin-only. The applicant receives the decision, not private review notes.

## Verification

The persistence test requires an empty disposable Memgraph instance at `bolt://127.0.0.1:17698`; it refuses other URLs. Never point it at application storage.

```sh
cd fluentxverse-server
INTERVIEW_TEST_URI=bolt://127.0.0.1:17698 bun --no-env-file test ./tests/interviewReview.persistence.ts
```

Browser coverage:

- `fluentxverse-dashboard/tests/browser/interviews.cjs`: real two-browser media, authorization, recording retries, independent decisions, post-call corrections, reload, and private room fields; requires the isolated `interview.runtime.ts` fixture and local frontends configured for its API/signaling ports.
- `fluentxverse-dashboard/tests/browser/interviewFeedback.cjs`: persisted feedback, existing scores/notes, and save-failure recovery with mocked APIs.
- `fluentxverse-dashboard/tests/browser/interview-calendar.cjs`: calendar controls and result access, light/dark and desktop/mobile.
- `fluentxverse-tutor-solid-prototype/tests/browser/interviewProgress.cjs`: pending/pass/fail refresh, profile progression, and teaching-access gating with mocked APIs.
