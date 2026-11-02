# Lesson Outcome V2: Support-Only Workflow

## Release State

October 29, 2026: source implementation and local testing. Not deployed. This
release adds eligibility, structured support decisions and durable proof requests;
it does **not** generate a ZK proof or submit anything to a chain. Historical V1
lesson proofs remain retired. No development key is reapproved.

The student schedule no longer fetches lesson proofs or shows claim, submit,
retry, status or public-proof links. No completion-proof UI is added to either
participant app. Existing normal lesson-reporting and dispute-evidence controls
are separate and unchanged.

## Policy

The draft policy is `fluentxverse.lesson-outcome.v2.draft2`. Assessment is not
issuance, a verified credential, a payment decision or a refund decision.

- Eligibility opens exactly 48 hours after the **scheduled lesson end**.
- The student reporting window is independent of lesson-note editing/reopening.
- Any unresolved student **or tutor** report blocks eligibility indefinitely.
- A resolved report without an explicit completion decision still blocks it.
- All approved reports must agree with each other and the observed outcome.
- A support rejection prevents eligibility. A category or duration answer alone
  never approves or rejects completion.
- No refund is automatically issued, reversed or inferred by this feature.
- An uncleared TA-301 blocks both automatic and support-requested proof generation.
  The service checks penalty records for this exact booking, not just the attendance
  flag. Legacy penalties with no status are active unless revoked or voided.
  Present attendance plus TA-301 requires support correction; absent/unconfirmed
  attendance plus TA-301 is ineligible. A remaining booking-level `penaltyCode:301`
  also blocks, even if its historical penalty record was voided. Resolve both
  records through existing correction tools; report approval cannot override them.
  Voided/revoked records alone and penalties on other bookings do not block.

Timing uses authenticated participant records for the booked tutor and student.
Intervals are bounded by stored observations, clipped to the schedule and unioned
across overlapping connections. No missing heartbeat is extrapolated to lesson end.
No client supplies attendance, eligibility, completion or verification results.

| Outcome | Draft requirement |
| --- | --- |
| `both_attended` | Tutor is confirmed present, arrived by +5:00, and a connected interval reaches +10:01. Both participants' observations reach scheduled end, student is marked present, and overlap meets the existing dispute-evidence threshold of min(15 minutes, scheduled duration). |
| `student_no_show` | Student explicitly marked absent with no conflicting observed presence; tutor's qualifying interval starts no later than +5:00 and reaches +10:01. This is not student learning completion. |
| `student_left_early` | Student presence and departure are observed, and the tutor remains observed through scheduled end, satisfying the same arrival/waiting requirement. |
| `early_ended` | Tutor entered by +5:00 and their connected interval reached +10:01 before ending early. No student report means no additional manual approval after the reporting window. A student report requires explicit matching support approval. |

At whole-second precision +10:00 does not qualify; +10:01 does. It is elapsed time
from the scheduled start, not a claim of 601 seconds of teaching: entry at +5:00
followed by departure at +10:01 meets that elapsed-time rule. Gapped short visits
do not establish a continuous qualifying interval. The existing 15-minute
both-attended threshold is a draft reuse, not a newly agreed teaching-duration or
salary rule. The policy needs approval before a circuit/artifact release.

The early-ended outcome deliberately follows the operator's rule even when a
student remained in the room. It must not be labeled a full-duration student
completion or automatically approve tutor compensation. An unreported incident
does not establish teaching quality or the absence of real-world problems.

## Support Flow

Lesson Operations > Issues has a structured completion decision in Review:

- Not assessed
- Completion approved (`both_attended`)
- Alternative outcome approved (one of the other three outcomes)
- Completion rejected
- More evidence required

Approval/rejection requires report status `resolved`. Reopening clears the
dashboard's previous selection. Older clients can still resolve a report without
assessing completion; that remains blocked. Decisions and their selected outcomes
are recorded with the existing actor/timestamp review history. Internal proof
decisions are not added to student/tutor report API projections.

After the reporting deadline and all required approvals, support clicks
**Generate completion proof**. The backend rechecks eligibility and records a
durable Memgraph `LessonOutcomeProofRequest` linked to the booking. Requests with
the same evidence fingerprint are idempotent. Concurrent requests serialize on
the booking and the request has a unique booking constraint. The response is
HTTP 202 / `awaiting_prover`, **not** a generated proof. The support view states
that setup is pending. A fresh assessment marks requests needing reassessment if
the current evidence changed or eligibility was lost.

Only live support-capable administrators can view assessments or request
generation. Mutations require an approved dashboard Origin. The second legacy
report-review endpoint also checks Origin. Responses are private/no-store.

Endpoints:

- GET `/admin/operations/lessons/:id/outcome`
- POST `/admin/operations/lessons/:id/outcome-proof`, body `{}`
- Existing report review endpoints accept `completionDecision` and optional
  `completionOutcome`; client-supplied proof data is not accepted.

## Automatic Requests

`LESSON_OUTCOME_QUEUE_ENABLED=true` with a valid ISO `LESSON_OUTCOME_QUEUE_FROM`
opts into a minute-by-minute queue scan after server startup. Both are unset by
default. The rollout start prevents accidental historical backfill. The scan is
bounded and paginated so ineligible old lessons do not starve later lessons.
Only eligible lessons with **no reports from either participant** queue
automatically. All reported lessons require the manual support request, even
after approval. There is no student/tutor interaction.

This creates requests only. It neither starts proving nor authorizes publication.

## Remaining Prover Work

Before activation, implement a dedicated Engine-owned V2 statement/circuit and
properly generated proving release, signing/public-input bindings, private witness
handling and durable proof-package storage. A worker must freshly recheck reports,
attendance, request fingerprint and supersession status before proving and again
before dispatch. Current database reads span Memgraph and PostgreSQL, and a queue
snapshot is **not** an atomic cross-database authorization or proof that no report
was omitted. Deadline-crossing submissions and review/attendance changes need a
fenced finalization protocol before publishing immutable claims.

Define new operational transitions for actual proving/submission, uncertain
outcomes, read-only receipt reconciliation, canonical finality, and revocation /
superseding credentials. No positive verification flags or automatic student/tutor
notifications should be added by that worker. Keep all lesson-proof controls in
support, and verify active network pins separately; this work is chain-agnostic.

Neither signatures nor ZK establish that a person taught, learned or had working
media. They establish claims about issuer-authorized platform records.

## Local Verification

```sh
cd fluentxverse-server
bun test tests/lessonOutcome.test.ts tests/studentIssueReportWindow.test.ts tests/studentLessonIssueReport.test.ts tests/lessonTroubleReport.test.ts tests/lessonNotesEditWindow.test.ts
```

`LESSON_OUTCOME_TEST=1 bun tests/lessonOutcome.integration.ts` hard-pins a fresh
Memgraph on 7797 and test-only PostgreSQL on 5547. It rejects a nonempty graph and
uses synthetic records only. Do not repoint it at production. Database/API tests
exercise permissions, Origin, explicit approvals, concurrent/idempotent requests,
automatic-vs-support dispatch and reassessment, without chain transactions.

The dashboard browser test is `tests/browser/lessonOutcome.cjs` with
`DASHBOARD_TEST_URL` pointing to a local preview. It mocks API responses and checks
support approval, permission failures, manual requests, reopening and layout at
1440/375/320 pixels. Student schedule browser tests additionally assert no proof
controls or proof API calls. These are not live proof/chain certification.

October 29 local results: 38 focused policy/regression tests and the student UI
source guard passed; 36 disposable database/API checks passed, including four
concurrent support requests. The two existing PostgreSQL report persistence tests
were also run separately and passed. Three support browser scenarios and ten
student light/dark desktop/mobile scenarios passed. Student typechecking/build and
dashboard production build passed. Screenshots were inspected.

Whole-server typechecking remains blocked by errors outside these changed modules
(mail, operational alerts, email verification, and existing test fixtures). The
dashboard full typecheck reports the pre-existing `Skill`/`review` mismatch in
`AIContentGenerator.tsx:349`. A broader screening regression independently fails
in `zkSecurity.test.ts:107`: its validator-configuration mock returns undefined
where the current screening submission code expects `chainId`. Neither the mock
nor the unrelated screening implementation was changed by this work.

TA-301 follow-up: the policy was bumped to draft2. Eighteen outcome policy tests
pass, and the expanded isolated database/API run passes 45 checks. These include
legacy statusless penalties, active/revoked/voided penalties, stale booking markers,
other-lesson isolation, automatic/manual denial and pending-request reassessment.
This does not deploy or activate proof generation.
