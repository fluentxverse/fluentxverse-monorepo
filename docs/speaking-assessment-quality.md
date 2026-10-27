# Speaking Assessment Feedback

## Current Format

New oral assessments use `read-aloud.v1`: exactly ten distinct short sentences,
IDs 1-10, all `read-aloud`, each with 30 seconds of recording time. Generation
targets 8-18 words with everyday vocabulary and simple grammar. Validation rejects
other task types, missing/extra items, duplicates, blanks, out-of-order IDs,
non-30-second limits, and sentences outside a 6-24-word safety range. Natural
sentence quality still depends on AI generation, not a deterministic language test.

The AI evaluates only the transcribed reading against the supplied text. No
picture description, situational response, teaching demo, or open response is
generated. The read-aloud rubric is `read-aloud-transcript.v1`; existing wire fields
map to word preservation (`vocabulary`), sentence preservation (`grammar`), word
order (`coherence`), and coverage (`taskCompletion`). They are not claims about
spontaneous grammar or vocabulary. Exact reading may receive full marks; original
ideas and advanced vocabulary are not required. Acoustic scores remain null.

Speaking results and tutor dashboard labels now describe a provisional AI content
assessment, not a final pass/fail application decision. New result metadata marks
`human_review_required`; both threshold outcomes explain the limitation. Old
stored summary text is not shown as a final verdict on the speaking results page.
Applicants can contact the tutor application mailbox to discuss their assessment.

This does not create an automatic human-review queue or change score eligibility,
retake limits, historical results, or certification policies. The internal
`passed` flag still means the existing 85% content threshold. Profile and interview
approvals remain separate requirements. A low score is not silently promoted to
qualification; an audited human score-correction workflow is separate work.
The earlier mixed-task format and transcript-content.v2 results remain readable
and gradeable for existing attempts. Saved attempts are not rewritten. New
read-aloud results cannot issue credentials under the existing broader screening
policy, even if their rubric label is changed. Approving a new certification policy
requires a separate coordinated Engine policy release; this change does not do that.

## Checks

- `fluentxverse-server/tests/writtenQuality.test.ts`: all 24 option permutations,
  all four original correct positions, unchanged source, weak-distractor rejection.
- `fluentxverse-server/tests/speakingQuality.test.ts`: ten read-aloud items, legacy
  compatibility, hidden hints, provisional outcomes and certification isolation.
- `fluentxverse-tutor-solid-prototype/tests/browser/screeningFeedback.cjs`:
  both score outcomes and legacy summaries, desktop/mobile and both themes.
- Existing application browser flow checks recording resume, upload retry, and
  asynchronous grading, in both legacy and `READ_ALOUD_ONLY=1` modes. Browser APIs
  are fixtures, not an actual human review.

## Deployed Verification

On 2026-10-26, API image `fluentxverse-cloud/api:read-aloud-screening-20261026`
and tutor Worker version `da256ab6-3713-4fa0-b076-12e90bab1d0d` were deployed.
The exact image passed 43 focused tests and an API bundle check. The frontend
typecheck and build passed. The full backend typecheck still reports 14 unrelated
errors; none are in the read-aloud modules or their tests.

The provider pilot scored an exact transcript and a synthesized sentence recording
at 100%, unrelated injected speech at 20%, and silence at 0%. The public API pilot
generated ten sentences, saved ten eSpeak-synthesized recordings, checked idempotent
upload, resume, and duplicate submission, and completed real transcription and
asynchronous AI grading with a provisional 99% result. Audio evidence was bound to
the temporary account and attempt; no certification was issued. The temporary
account, exam, and recordings were deleted. This tests the pipeline, not human
pronunciation assessment, identity liveness, or grading consistency across accents.

The deployed frontend passed 1440px, 390px, and 320px browser checks in both themes
for the new intro, provisional results, category labels, and legacy result display.
Local browser recording tests passed at 1440px, 375px, and 320px in both legacy and
read-aloud-only modes. Release evidence is under
`output/release/read-aloud-screening-20261026`; the live pilot can be repeated with
`node scripts/verify-read-aloud-live.mjs --run-live-qa`.
