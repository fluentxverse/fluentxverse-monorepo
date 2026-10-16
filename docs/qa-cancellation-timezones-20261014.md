# Cancellation, Refunds, and Schedule Time Zones

## Results

Both dashboard checks passed with isolated synthetic accounts and data.
Cancellation initially failed on the deployed mock-ticket path: the booking was
cancelled but the credit remained spent and the refund stayed pending. The
refund fix was implemented, tested, and deployed before marking the check passed.

### Cancellation and Finance

- Five concurrent cancellation requests produced exactly one successful cancellation.
- An eligible early cancellation restored one basic ticket: balance 1 -> 2.
- Five concurrent refund retries, a reconciliation pass, and another cancellation
  request did not add another credit or refund transaction.
- Cached balance responses refreshed to the restored balance.
- The cancelled lesson disappeared from the student's active schedule and its
  tutor slot reopened without a student assignment.
- A cancellation less than one hour before the lesson received no refund.
- Cancellation within five minutes of the start, and another student's
  cancellation attempt, were rejected without changing the booking or balance.
- Inconsistent original debit evidence required review, without extra credits.
- Cancelled lessons, refunded completed lessons, and refund-pending completed
  lessons could not produce tutor earnings.
- An eligible completed control produced exactly USD 12.50 in Memgraph.
- A subsequent support refund invalidated its payout evidence and prevented a
  new reservation. No payout transfer was enabled or sent.

The fix recognizes mock payments from their original debit evidence, not from
token metadata: some mock booking records use an `unknown` or numeric token ID.
It requires the matching used mock transfer, booking, student, wallet, tier, and
one-ticket amount. Credit, consumed-transfer marking, and refund finalization
occur in one booking-locked Memgraph transaction. Interrupted or inconsistent
evidence is not blindly credited. Real transfers continue through GMR Engine.

### Time Zones and Mobile Layout

The same booking, returned by the real isolated server, was displayed in the
deployed student site with synthetic authentication:

| Viewport | Device Time Zone | Displayed Schedule |
| --- | --- | --- |
| 1440px desktop | America/Los_Angeles | October 16, 00:30 JST |
| 375px mobile | Asia/Manila | October 16, 00:30 JST |
| 320px mobile | Europe/London | October 16, 00:30 JST |

The stored lesson instant was `2026-10-15T23:30:00+08:00`, equivalently
`2026-10-15T15:30:00Z`. The app intentionally displays Japan Time, not the device's
local time. All three views preserved the midnight date rollover and the same
lesson link after reload. Screenshots and DOM checks confirmed no horizontal
overflow, overlapping lesson/actions, or clipped action-button text.

## Verification

- `fluentxverse-server/tests/cancellationRefund.qa.ts`: six database/HTTP scenarios,
  actual mock-ticket debits/refunds, cache refresh, and finance eligibility.
- `fluentxverse-server/tests/schedulingLoopRecovery.integration.test.ts`: eight
  tests passed, including Engine confirmation, single dispatch under contention,
  uncertain outcomes, historical review, and proven-revert retry handling.
  Engine responses in those tests were simulated; no chain transfer was made.
- Four focused policy/earnings/checklist test files: 14 tests, 207 assertions passed.
- `fluentxverse-student-solid-prototype/tests/schedule-timezones.cjs`: three device
  time zones/viewports passed against deployed UI assets, using the actual
  isolated booking response and synthetic login.

Evidence and screenshots remain in
`/tmp/fxv-cancellation-timezone-20261014.mOv0d1`.

## Deployment

Original runtime image:
`sha256:8ff51645331f03c251a8bc806e48cb2cdd1cc5ee366a2520ba822330044a8efa`

Deployed patched image:
`sha256:54b2a83398a79cc1f89e20709ca5c72cbd23a6ae3b9ebd2b1c6f0f34ca54266d`

Only `cancellationRefund.service.ts` changed in the runtime overlay. Its SHA-256:
`4b943a5961b7a51840ce2a1409b059f444d14b45a57e0c99fa0745c39f85bc61`.
All 91 live environment settings were preserved. No frontend deployment or
financial-data migration was required. Production was healthy after restart.

Salary and refund records remain in Memgraph. Postgres in the isolated test
environment was used only for operational/session infrastructure. No real
customer booking, balance, or salary fixture was created or edited. The
production writes for QA were the two checklist results and their audit history.

These checks do not establish real on-chain refund finality, free-trial or private
pass cancellation behavior, or complete live lesson readiness. Those are separate
tests. The mock credit path is active only when mock tickets are enabled and a
genuine matching mock debit is present.
