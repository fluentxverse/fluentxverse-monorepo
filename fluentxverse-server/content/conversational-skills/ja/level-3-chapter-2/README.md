# Level 3, Chapter 2: Exploring Kyoto

User-supplied story reference: **Exploring Kyoto, 8 ESL Lessons, A2-B1 Level**.
This chapter continues Emma, Claire, Leo, and Nao's life at Kamo House after
Chapter 1. Emma and Leo's relationship develops through everyday travel situations.
Role assignments are direct: "You are Emma. Your tutor is Leo."

| Lesson | Title | Skill | Communication Focus |
| --- | --- | --- | --- |
| 1 | A Weekend Adventure | Speaking | Make suggestions and agree on a day-trip plan |
| 2 | The Wrong Train | Listening | Check tickets, platforms, and corrected station information |
| 3 | Lost in Gion | Reading | Read directions, landmarks, and a meeting message |
| 4 | A Taste of Kyoto | Speaking | Ask prices, order quantities, and check payment |
| 5 | Personalized Checkpoint | Review | Generated separately from Lessons 1-4 and student evidence |
| 6 | The Bamboo Forest | Speaking | Describe a place and request a photograph |
| 7 | Rain at Kiyomizu-dera | Speaking | Explain a weather problem and change plans |
| 8 | A Special Souvenir | Reading | Compare product cards and read gift-order conditions |
| 9 | An Evening by the River | Speaking | Invite, respond, and confirm future plans |
| 10 | Personalized Checkpoint | Review | Generated separately from Lessons 6-9 and student evidence |

The reference's episodes 5-8 map to lesson slots 6-9. Do not create static
lessons in slots 5 or 10; the existing checkpoint agent uses published source
groups and actual student evidence, with balanced review when evidence is sparse.
The eight authored materials are drafts in Memgraph, not PostgreSQL.

## Lesson Standard

- Six vocabulary items, Part II discussion, and Part III basic pronunciation.
- Two concise grammar/reading tips with Japanese examples.
- Ten alternating Apply lines for speaking; short tutor-only transcripts for listening.
- Reading passages distinct from Challenge 1, kept visible during the roleplay.
- Six Step A choices and four Step B questions with structured answer keys and marking guidance.
- Standard numbered tutor guides, tutor-first roleplays, useful language, and three optional discussion topics.
- The existing fixed range/accuracy/fluency rubric and six-step feedback guide.
- No generated images or inherited Chapter 1 scene assets.

Places provide narrative context, not live navigation advice. Practice routes,
shop names, fares/prices, opening times, payment rules and product conditions
are fictional and labeled as such. No live platform numbers or train timetable
claims are made. Keep roleplay instructions concise and tied to the story.

## Authoring and Persistence

`build.ts` is the canonical chapter source and uses the established Chapter 1
schema/guide builder with a chapter-specific configuration. Existing Chapter 1
content and artwork are not modified.

From the repository root, run `bun scripts/apply-exploring-kyoto.ts` for a dry run.
Review the generated candidates under `output/exploring-kyoto/`. The explicit
write requires the dry run's `--expected` snapshot digest. The updater backs up
the chapter, metadata, and guide reference, rejects concurrent changes and
non-draft replacements, writes in one transaction, and verifies full records.
It sets the chapter metadata to Exploring Kyoto and leaves student notes,
marks, Chapter 1 lessons, and existing checkpoint materials untouched.

Tests: `tests/exploringKyoto.test.ts` and `scripts/tests/exploring-kyoto.cjs`.
