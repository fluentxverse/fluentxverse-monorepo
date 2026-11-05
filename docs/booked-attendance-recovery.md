# Booked Attendance Recovery

## Rollout State

Deployed and enabled with `BOOKED_ATTENDANCE_RECOVERY_ENABLED=true`. New bookings created while enabled receive
`attendanceRecoveryVersion: 1`. Existing bookings are not retroactively enrolled.
Activation is prospective; no existing booking was retroactively enrolled.

## Policy

- Confirmation window stays 35 to 11 minutes before the lesson.
- At start minus 10 minutes, a booked lesson not confirmed Present is cancelled
  with TA-301. Tutor-declared absence triggers recovery immediately.
- The student's Account settings preference defaults Off and is saved separately
  from other lesson preferences, with an audit entry.
- Opted-in students can transfer no later than five minutes before start, to an
  open, Present slot at the exact same instant and duration, with compatible
  language and the same tutor tier. Pending checkout slots are not candidates.
- Original lessons retain penalties and replacement links; replacement bookings
  own the original entitlement. No new payment is taken. Trial-use checks and
  refund workers exclude the superseded booking. Completed ticket debit records
  are linked to the replacement, preserving their original booking identifier.
- With no replacement or opt-in, the existing refund worker restores the trial
  allowance or processes the original ticket refund. Archived passes require
  existing staff recovery, never an invented replacement credit.
- Classroom schedule authorization and tutor entry require Present and no TA-301.
  Cancelled originals cannot be entered; room presence cannot clear deadline penalties.

Deadline TA-301 is an application policy, not a full-lesson no-entry assertion.
It must not be exported through the contract's full-lesson no-show operation.
This implementation does not alter the contract or enroll a new on-chain case.

## Verification

Use a fresh disposable Memgraph at `bolt://127.0.0.1:7721` only:

```sh
cd fluentxverse-server
TEST_MEMGRAPH_URI=bolt://127.0.0.1:7721 bun --no-env-file run tests/attendanceRecovery.integration.ts
bun --no-env-file test tests/attendanceRecovery.test.ts
```

## Verification And Follow-Up

Passing checks: ten-minute boundary, five-minute transfer cutoff, absent/Present
states, opt-out/no-match fallback, legacy exclusion, repeat recovery, concurrent
students competing for one slot, classroom denial, trial allowance/refund
idempotency, and paid-debit handoff with exactly-once mocked ticket restoration.
Backend typecheck and student production build passed. The account-settings
browser test passed at 1440px/390px in both themes, including persistence and save
failure retention.

The scoped production API artifact also passed the isolated database suite,
including HTTP preference authentication/role rejection/schema checks and saved
student preference reads/writes. Live health returned 200, unauthenticated
preference access returned 401, and deployed student browser checks passed.

- Broaden transfer-vs-checkout, cancellation, preference-change, and refund races.
- Update tutor guidance, lesson links, replacement disclosure, schedule events,
  and admin history; complete end-to-end notification delivery/reconnect checks.
- Preserve the scoped release records at `output/release/attendance-recovery-20261103`.
  No contract parameters, historical bookings, or unrelated runtime configuration
  were changed. Student version: `f060ef5f-190a-4483-885a-187a8dbf3b58`.
