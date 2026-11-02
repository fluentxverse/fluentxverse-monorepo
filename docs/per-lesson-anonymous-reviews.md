# Per-Lesson Anonymous Tutor Reviews

**Retired October 29, 2026:** the user requested restoring the regular lesson survey.
The anonymous review API is no longer mounted, its student route/navigation are
removed, and lesson surveys no longer select this flow regardless of environment
flags. The original per-lesson form, 48-hour deadline, duplicate checks and tutor
rating updates are restored. The text below records the retired implementation.
Existing proof records and shared artifacts are not deleted or converted into
identity-linked surveys. Other proof features remain unchanged.

October 29, 2026: implemented and locally tested, not deployed or activated by this
change. No live chain transactions, user enrollments or ratings were created.
Existing destination-routing changes in the workspace were preserved.

## Entitlements And Scoring

Each eligible completed booking now has one immutable review enrollment, rather
than one enrollment per student/tutor/month. Eligibility still requires ownership,
the scheduled end to have passed, both participants marked present, and no existing
legacy linked survey for the booking. The repository rechecks these facts inside
the enrollment transaction. This does not depend on the separate lesson-outcome
proof queue, alter issue reports, or approve compensation/refunds.

One student can review several completed lessons with the same tutor. Each lesson
uses a fresh browser-generated Semaphore identity. Authenticated responses contain
a private entitlement ID and lesson context so browser keys, pending submissions,
backups and acknowledgments do not collide within the same tutor group. These
identifiers are never included in the anonymous submission or public proof inputs.

The private entitlement ID is destination-independent. Student writes serialize
cross-destination enrollment and each enrollment ID is unique. A retry restores
the same identity rather than issuing another vote. Another commitment for the
same lesson or reuse of an enrolled key within one group is rejected.

Tutor/month remains the batching unit, **not** the review quota. New cohorts use
the `per_lesson` policy and a separate `.bridge-only.per-lesson` group namespace.
Every lesson key shares that tutor/period's scope but produces its own nullifier,
so the existing submission-ID uniqueness prevents repeat use of an entitlement.
The Semaphore circuit, proof shape and content-commitment protocol are unchanged.
Existing tally arithmetic counts accepted reviews: the new cohorts are therefore
lesson-weighted, and frequent students can contribute more ratings. Summary APIs
explicitly label `ratingUnit: lesson` versus historical `student_month` batches.
Legacy linked scores are not relabeled or silently mixed into anonymous scores.

## Privacy And Limits

Enrollment is authenticated and FluentXVerse knows which bookings/students are
eligible and which public commitments they enrolled. Submission contains only
group ID, structured feedback and a ZK membership proof. It rejects account cookies,
authorization headers, identifiers and free-text comments. Public group data binds
the tutor and period, not a particular booking/student/entitlement.

New cohorts require **at least five distinct enrolled student accounts**, not just
five lesson keys, before sealing. Five lessons from one person do not open a batch.
Frozen members and duplicate nullifiers are still enforced; acceptance requires
the existing configured verification/receipt workflow before public scoring.
At least five accepted reviews are required for publication. This does not prove
five distinct authors submitted: that would require an additional privacy-aware
mechanism. Nor does five accounts prove five humans.

The existing pilot capacity is 256 lesson entitlements per tutor/month cohort.
Full cohorts reject additional enrollment; no entitlement is silently issued
elsewhere. Sharded batches or a larger approved tree are a separate scale-up task.
Enrollment still closes at UTC month end, with feedback collected during the first
seven days of the next month. This change does not make anonymous feedback immediate
or adopt the issue-report deadline. Near-boundary lessons may miss enrollment.

IP addresses, cookies on unrelated requests, CDN logs, submission timing, small
groups and colluding participants can still enable inference. This change does not
establish complete anonymity from the platform or its infrastructure, guarantee
full inclusion, or remove the platform's authority over eligibility and acceptance.
Private keys and private backups must remain on the device/user side.

## Historical Compatibility

Historical group IDs, scopes, keys, receipts and tally proofs keep their original
coordinates and monthly policy. The activation, receipt and tally checks select
the namespace using the stored policy; no old cohort is relabeled per-lesson.
Old backups still restore to their original group-key slot.

If a student already has a historical monthly enrollment for the tutor/period,
the UI continues that enrollment rather than also issuing new per-lesson votes in
the same period. New per-lesson enrollments begin with a new period for that case.
Neither chain changes nor retries grant a second entitlement for a lesson.

## Verification

- Server review/HTTP/destination/tally suite: 26 tests passed, including a genuine
  Semaphore proof and rejection of modified public inputs.
- Disposable Memgraph on port 7798: 19 checks passed for multiple lessons, duplicate
  keys, cross-account access, concurrent retries, destination changes, transactional
  eligibility rechecks, distinct-student thresholds and historical compatibility.
  Chain operations in this test are mocked. Use
  `PER_LESSON_REVIEW_TEST=1 bun tests/perLessonReviews.integration.ts` only against
  the empty dedicated database; it cleans that disposable graph.
- Browser identity/recovery unit tests: two passed.
- Built student app: four per-lesson browser scenarios (desktop/mobile, light/dark)
  each generated and independently verified two real proofs, with distinct
  nullifiers and separate local caches. Payload checks exclude account, booking,
  entitlement and private-key values. API receipts are fixtures, not chain evidence.
- Four historical browser scenarios passed for original backups, artifact pinning,
  real proofs, exact retries, pending/verified displays and closed windows.
- Student typecheck and production build passed. Whole-server typechecking still
  has unrelated errors; no new review source diagnostics were introduced.

The test fixture and verifier use synchronous stdout writes before exiting so
child-process output is not truncated. Public proving artifacts remain unchanged.
