# Written Assessment Quality

New written assessments contain 30 items: grammar 1-10, vocabulary 11-20, and
reading comprehension 21-30. Existing active or completed attempts are not silently
rewritten or re-keyed by this release.

## Publication Gate

1. The author returns questions and four options per item, without an answer key.
   A separate solver establishes the key by selecting literal option text. Code
   maps that text to the stored zero-based index; neither model supplies numerical
   answer positions. Whitespace, capitalization, and typographic apostrophe
   differences are normalized; unknown option text is rejected, not guessed.
2. New-content checks require ordered sections, unique stems, one blank in each
   grammar/vocabulary item, and referenced reading passages of reasonable length.
   Passages target 150-250 words, with a broad 40-600-word safety bound. Unused
   passages are removed before review rather than forcing a full regeneration.
3. A separate reviewer call solves all items without seeing the author's answer
   key. It selects literal option text, not indexes, and includes a brief internal
   rationale. It receives the exact option wording and passages, but no applicant ID,
   email, scores, or application history.
4. Every item must have exactly one defensible option selected by the solver,
   with no flagged grammar, ambiguity, unsupported inference, or content issue.
5. Failed quality checks return targeted feedback to the author for bounded
   revision of only the flagged questions. Approved questions and passages remain
   unchanged; review results are reused only for those unchanged items. Every
   repaired item is reviewed again. At most four attempts share the
   existing 90-second generation budget. Provider failures do not silently pass.
6. Only an accepted assessment is published and starts the exam timer. Failed
   generation does not create a completed examination or consume a graded attempt.

Vocabulary options must be usable verbatim, with appropriate tense, passive voice,
agreement, and word form. Distractors should be grammatically compatible so the
item tests meaning rather than accidental grammatical errors. Reading answers must
be supported by the supplied passage.

The author and reviewer use GPT-4.1 through the existing provider configuration,
with temperature 0.2 for authorship and 0 for review. The reviewer is a separate
call to the same configured model/provider, not an
independent human audit or a mathematical guarantee of linguistic correctness.
Correlated model mistakes remain possible. A human-reviewed item bank would provide
stronger editorial control than generation alone. ZK certification does not establish
that an exam question or an AI judgement is linguistically correct.

## Tester Feedback Update

The `written-quality-v2` generation policy requires at least two plausible,
passage-relevant distractors per reading item. The reviewer flags
`weak_distractors` for giveaway choices, triggering targeted repair. Unsupported
but plausible claims must remain distinguishable from text-supported answers;
this is an AI editorial check, not a deterministic guarantee of item quality.

Accepted questions have their options shuffled server-side with cryptographic
randomness and Fisher-Yates, with the answer index remapped to the same literal
choice. Shuffling happens once before persistence, not on fetch, resume, or
grading. Individual positions are random, not a predictable A/B/C/D cycle or a
guaranteed equal quota. Existing attempts are unchanged.

## Verification

- `fluentxverse-server/tests/writtenQuality.test.ts` tests structural defects,
  answer-key stripping, missing/duplicate reviews, no-answer/multiple-answer cases,
  key disagreement, and the reported passive-voice regression.
- `fluentxverse-tutor-solid-prototype/tests/browser/writtenExam.cjs` checks desktop,
  tablet, and mobile in both themes, real artwork loading, visible timer text,
  aligned section labels, readable controls, selections, and restored answers.
- `scripts/deploy-written-exam-release.mjs --pilot` calls the real configured AI
  provider on synthetic assessment content and checks rejection of the reported
  malformed vocabulary item. It does not create applicants or generate credentials.
- `scripts/verify-written-exam-live.mjs --generate-test-exam` creates a temporary
  verified applicant, generates through the public API, checks hidden answer keys,
  timer start, answer saving, and resume, then deletes that applicant and exam.
  It never submits an exam, issues a credential, or creates a wallet.

## Deployed Verification

On 2026-10-26, API image `fluentxverse-cloud/api:written-exam-quality-20261026`
and tutor Worker version `18c7cdbe-5319-4d8d-b382-8979d844fb9f` were deployed.
The exact image passed 32 tests. The real-provider pilot produced 30 reviewed items
and rejected the malformed passive-voice regression. The public API pilot passed
in approximately 52 seconds, with the timer starting after review, hidden answer
keys, and saved-answer resume verified. The temporary records were removed.
The deployed frontend passed 1440px, 768px, 390px, and 320px browser checks in both
light and dark themes. Browser tests used fixture API responses; the separate API
pilot used the actual provider and Memgraph.
