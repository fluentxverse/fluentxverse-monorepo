# Tutor compensation: USD base rates

The dashboard manages each tutor's current administrator-set base rate. A separate
finance-authorized earnings API now records approved payable completions and
reserves payout batches. Neither endpoint transfers funds or claims that real
tutor payouts are ZK verified.
There is no booking-time rate lock. Rates and their financial history are stored
in Memgraph, not PostgreSQL; existing application logging/report services are
unchanged.

## Dashboard

Finance-authorized administrators see a Base rate (USD) column in Tutors. Its edit
button opens the tutor account's Compensation tab in a centered modal above the
tutor list. Account sections use keyboard-accessible tabs; the header and tabs
remain visible while content scrolls. Closing returns to the list and refreshes
its base rates. Existing tutor account links open the same modal. The tab provides an exact USD
amount field, a confirmation showing old/new rates, required reasons for changes,
last administrator/date and paginated rate history. An unset rate is distinct
from zero. The application never silently assumes a zero rate.

Students and ordinary support operators cannot access rates. All financial API
reads/writes require the live administrator's finance permission. Rate-change
history is intentionally separate from general support-accessible account audit
history. The generic public User/tutor profile does not contain compensation.

## Storage And API

- `(:User)-[:HAS_COMPENSATION]->(:TutorCompensation)` contains the current rate,
  fixed USD currency, integer cents, version and last change metadata.
- `(:TutorCompensation)-[:HAS_RATE_CHANGE]->(:TutorRateChange)` records each change
  with before/after amounts, actor identity, timestamp, reason and prior version.
- Unique constraints protect tutor IDs, save request IDs and tutor/version keys.
- The shared tutor node is written before comparing the expected version.
  Updates and history commit in one Memgraph transaction. Stale saves return 409;
  identical request-ID retries return the original change. Reusing a request ID
  for different data or another administrator is rejected.
- Amounts must be $0.01 through $1,000,000.00, with at most two decimal places.
  Exponents, floating-point rounding and unbounded integers are not accepted.

```text
GET /admin/operations/compensation?tutorIds=<comma-separated IDs, maximum 50>
GET /admin/operations/compensation/:tutorId?beforeVersion=<optional history cursor>
PUT /admin/operations/compensation/:tutorId
```

```json
{
  "amount": "12.34",
  "currency": "USD",
  "expectedVersion": 0,
  "requestId": "an independently generated UUID for this save",
  "reason": ""
}
```

The backend derives administrator identity from authenticated cookies, rechecks
finance permission inside the write transaction and requires a trusted dashboard
Origin for financial reads as well as mutations. Another FluentXverse frontend
cannot reuse an administrator's shared API cookie to read rates. Financial
responses are private/no-store. Version zero
means unset; its optional empty reason becomes "Initial base rate". Subsequent
changes require a nonblank reason. No delete, backdate or history-edit API exists.

## Next Milestones

The current earnings API is deliberately approval-driven, not automatic accrual:

```text
GET  /admin/operations/compensation/:tutorId/earnings
POST /admin/operations/compensation/:tutorId/earnings/:bookingId
POST /admin/operations/compensation/:tutorId/payouts
GET  /admin/operations/compensation/:tutorId/payouts/:batchId/evidence
```

Posting requires a finance administrator, trusted dashboard Origin, a reason,
ended/finalized completion, both participants present, and no refund or financial
hold. Each lesson creates at most one earning. The immutable earned cents and
rate version come from the approved history effective at finalized completion,
not today's rate. No rate at that time means review, not a zero-rate fallback.
Reservations contain one to four distinct unclaimed earnings, use exact USD
cents and the explicit zero-fee v1 policy, and prevent overlapping batches.
Fresh evidence export rechecks refund/hold state, reservation ownership and
expiry. `zkVerified` and `transferEnabled` remain false. Reservations are not
automatically released after timeout or an uncertain operation.

The prototype signs a one-hour authorization. Production must select a versioned
validity policy that covers actual aggregation/finality/retry latency, with fresh
ledger checks and revocation before release. Engine's development circuit,
consumer and mainnet QA are documented in
`gmr-engine/docs/tutor-payout-authorization-qa-20261014.md` in the sibling Budol
repository. These are not audited shielded settlement.

1. Define automatic accrual and refund/dispute cutoffs around the implemented
   approval-driven ledger. Do not multiply every past completed lesson by today's
   rate or automatically backfill uncertain lessons.
2. Add approved payout batches, authenticated tutor authorization, adjustments
   and durable transfer reconciliation. Custodial Engine wallets are not proof
   that the tutor alone controls an entitlement.
3. Build a dedicated Engine-owned earnings circuit covering authorized payable
   records, private rates, integer fee/rounding rules and claim/destination
   binding. Consume stable lesson/claim nullifiers atomically so overlapping
   batches cannot pay the same lesson twice. Verify the real zkVerify aggregation
   receipt before release. Ordinary transfers still expose amount and recipient.
4. Introduce shielded settlement only after selecting and reviewing the actual
   protocol, circuit, proving artifacts, custody and disclosure model. The
   existing Engine payout-pool template is not an audited production pool: its
   submission-ID path does not verify a zkVerify receipt, and its verified path
   does not bind the recipient/relayer fee to the proof. Do not fund it as-is.

All proving, zkVerify submission, transaction signing and chain operations remain
in GMR Engine/Vault. The FluentXverse backend remains the authorized source of
business records. No grant eligibility or funding outcome is implied.

## Verification

`bun test tests/tutorCompensation.test.ts tests/adminOperations.test.ts` tests USD
precision, validation and permission policy. The standalone integration fixture
requires an empty disposable Memgraph at `bolt://127.0.0.1:17699`, selected with
`COMPENSATION_TEST_URI`; it verifies transactions, conflicting first/subsequent
saves, retries, pagination, permissions, revoked access and Origin checks. When
mounting all existing admin routes, it also requires an isolated logging database
at `postgresql://127.0.0.1:15439/qa`, checked before importing those routes.
`EARNINGS_TEST_URI=bolt://127.0.0.1:17699 bun tests/tutorEarnings.persistence.ts`
tests effective rate versions, duplicate earnings, overlapping reservations,
refund/hold/expiry gates and permission revocation using an empty disposable graph.

The dashboard browser fixture uses stub API responses and captures desktop/mobile
screenshots. Run `tests/browser/tutorCompensation.cjs` with
`PLAYWRIGHT_NODE_PACKAGE` pointing to an installed Playwright package and a local
dashboard on port 5185. It verifies save confirmation, retry IDs, conflict reload,
precision errors, responsive layout and finance-only visibility.
