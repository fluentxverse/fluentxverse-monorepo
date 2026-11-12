# Level 3, Chapter 1: A New Beginning

English lessons for adults, with Japanese supporting translations.
The revised lessons follow residents of fictional Kamo House in Kyoto.
Lesson 1 is published in Memgraph; Lessons 2-4 and 6-9 are
drafts for editorial review. Existing authored drafts in slots 5 and 10 remain
untouched; personalized checkpoint slots are generated separately when their
four source lessons are published. Lesson 1 retains its existing ID.

## Curriculum

| Lesson | Title | Skill / Apply / Main Mission | Language focus | Exercise A / B |
| --- | --- | --- | --- | --- |
| 1 | A New Beginning | Speaking | Introductions and relevant questions | Choose / multiple choice |
| 2 | The Sunday Cafe | Listening | Leo's background, current work, and routines | Choose / multiple choice |
| 3 | A Shared Hobby | Reading | Nao's profile and a photo-walk invitation | Choose / multiple choice |
| 4 | A Walk Through Kyoto | Speaking | Past experiences, preferences, and reasons | Choose / multiple choice |
| 5 | Personalized Checkpoint | Review | Lessons 1-4, adapted to student evidence | Dynamic practice / three challenges |
| 6 | An Interesting Idea | Speaking | Suggesting the cafe exhibition and offering help | Choose / multiple choice |
| 7 | An Unexpected Problem | Speaking | Broken bakery oven; solutions, requests, and deadlines | Choose / multiple choice |
| 8 | The Exhibition | Reading | Visitor guide, artist contributions, and afternoon program | Choose / multiple choice |
| 9 | A Place to Call Home | Speaking | Reflecting on experiences and feelings; future plans | Choose / multiple choice |
| 10 | Personalized Checkpoint | Review | Lessons 6-9, adapted to student evidence | Dynamic practice / three challenges |

Each non-checkpoint lesson has a 23-minute core: introduction 1, Learn 4, language focus 2,
Apply 4, Exercise 4, Mission 6, and Feedback 2. Challenge 2 adds up to two minutes.
All eight story lessons use optional discussion with three general free-talk categories.

Listening is **tutor-delivered**: complete scripts, delivery guidance, gist/detail
questions, and answer keys are in the tutor guide. No recorded audio was generated.
Student views do not render the tutor guides or transcripts. Reading lessons
have actual passages. Speaking lessons use short alternating dialogues and
tutor-first roleplays, not compulsory monologues. Score receptive lessons chiefly on understanding,
not on the length of a correct answer.

English is the instructional language. Japanese appears in goal, introduction,
vocabulary/expression, task-instruction, grammar-support, and feedback fields.
The existing `goalTextJp` field is used; no application-wide language switch was added.
The chapter replaces the old Level 3 Chapter 1 content; it is not a parallel course.
Future authoring and regeneration must follow the shared rules in
`../AUTHORING_CORRECTIONS.md`.

## Current Story Source

`new-beginning.ts` is the canonical user-approved story. Its eight episodes map
to Lessons 1-4 and 6-9, leaving Lesson 5 as a checkpoint. The exhibition stays
at Kamo House cafe on Sunday, 2-4 p.m. The only preparation problem is the
bakery oven; the cafe kitchen and teamwork solve it. The exhibition succeeds,
then the four friends reflect beside the Kamo River.

`buildChapter()` applies this source for future chapter generation. Older
lesson-specific modules and `exhibition-arc.ts` are historical schema templates,
not the current story. Do not run historical update scripts to restore those plots.
Use `scripts/apply-new-beginning-story.ts` for guarded Memgraph updates. It backs
up all eight records, requires exact revisions, preserves IDs/publication states
and fixed feedback, and verifies full records after the atomic write.
It does not change student notes, assessment history, or generated checkpoint lessons.
The story rewrite clears incompatible previous scene images. Lessons 1 and 2
now have matching watercolor illustrations for Introduce, Apply, and Challenge 1.
Their six PNG masters and optimized WebP assets live in `images/`; prompts and
character/style references are recorded in `new-beginning-watercolor-prompts.json`.
Use `scripts/apply-new-beginning-watercolor.ts` for guarded, image-only uploads
and Memgraph reference changes. It preserves lesson text, notes, and publication states.

## Review in Admin

Open http://localhost:5175/conversational-skills-editor and select Level 3,
Chapter 1. Each draft opens in the existing visual editor. Use its Preview action
to review an unpublished lesson. Publish after editorial review.

Direct Lesson 1 editor:
http://localhost:5175/conversational-skills-visual-editor/conversational-skills-L3-C1-1-speaking-1774155960030

The source lesson is preserved in `backups/2026-09-23T06-32-26-413Z.json`.
Later backups are snapshots taken before subsequent imports.

## Assets and Source

- `specs.ts`: legacy base content for the original ten draft slots.
- `lesson-1-trivia.ts`: revised first-meeting trivia about the liking gap, Japanese translation, discussion question, and research source (Boothby et al., 2018).
- `standardize-tutor-guides.ts`: Lesson 3-based tutor-guide standard for Lessons 1-2; changes guide fields only. Apply through `bun scripts/standardize-lessons-1-2-tutor-guides.ts` from the repository root (dry run first, then `--write` with the three reviewed `--expected-1/2/3` revision arguments).
- `build.ts`: adapts the base content and overlays revised Lessons 6-9 for the visual-editor schema.
- `chapter.json`: exported full editor records from the import.
- `images/`: generated, inspected visual aids, optimized to WebP.
- `lesson-2-listening.ts`: the revised Kyoto listening lesson and its tutor scripts.
- `lesson-2-image-prompts.json`: prompts for Lesson 2's distinct photo assets.
- `apply-lesson-2.ts`: backs up and updates only Lesson 2 after checking its revision.
- `lesson-3-reading.ts`: the Kyoto bicycle-rental reading lesson, service lists, and tutor guides.
- `lesson-3-image-prompts.json`: prompts for Lesson 3's nine distinct photos.
- `apply-lesson-3.ts`: backs up and updates only Lesson 3 after checking its revision.
- `lesson-4-speaking.ts`: the text-only continuation of the bike outing, with an Emma-Claire Apply dialogue and a tutor-first problem-solving roleplay. Standard guide format; existing trivia and fixed feedback categories are preserved.
- `scripts/update-lesson-4-story.ts` (repository root): backs up and revises only live Lesson 4, checks both its revision and the Lesson 3 guide reference, validates content, and verifies persistence. Run without `--write` first.
- `apply-lesson-4.ts`: backs up and updates only Lesson 4 after checking its revision.
- `lesson-6-listening.ts`: the dramatic exhibition continuation, two-message Apply, Nao-to-Emma listening mission, five approved Useful Language phrases, and early-lesson tutor-guide structure. Existing images and fixed feedback categories are preserved.
- `scripts/update-lesson-6-story.ts` (repository root): reads current live Lessons 2 and 6, validates a preview, backs up both, then updates Lesson 6 only with revision guards and full read-back verification. Run without `--write` first; a write requires reviewed `--expected-updated-at` and `--expected-reference` values. Lesson 7 is not updated by this command.
- `scripts/simplify-lesson-6-listening.ts` (repository root): changes only Apply and Challenge 1 listening tasks in the latest live record, preserving other editor content. Scripts are 72 and 57 words, with pause points, four Apply questions, and short-answer support. Dry run first, then write with the reviewed `--expected-updated-at` value.
- `lessons-6-9.ts`: routes Lesson 6 to its dedicated authoring module and builds the remaining text-only exhibition arc.
- `apply-lessons-6-9.ts`: backs up and updates only draft Lessons 6-9 after checking their revisions.
- `image-prompts.json`: exact generation prompts; built-in image_gen was used.
- `import.ts`: validates, backs up, uploads assets, and transactionally imports drafts.

Images are served through the existing API file proxy from SeaweedFS:
`/lesson/files/lessons/conversational-skills/ja/l3-c1/v1/{name}.webp`.
They illustrate the situation and concrete vocabulary; they are not listening
answer keys or a claim that every pictured person matches a named speaker.

## Reproduce

From `fluentxverse-server`:

```sh
bun content/conversational-skills/ja/level-3-chapter-1/import.ts
bun test tests/conversationalLessonValidation.test.ts
LESSON_AUTHORING_DB_URI=bolt://localhost:7691 bun content/conversational-skills/ja/level-3-chapter-1/import.ts --write
```

`--write` imports drafts only and requires an explicit database URI. Credentials
use the existing `MEMGRAPH_USER` and `MEMGRAPH_PASSWORD` environment variables.
`LESSON_AUTHORING_FILER` defaults to `http://localhost:8888`;
`LESSON_ASSET_API_BASE` defaults to `http://localhost:8765` for validation only.
For `--write`, set it explicitly to the public API origin (for example,
`https://api.fluentxverse.xyz`) so saved image URLs work in hosted lessons.
Set `LESSON_AUTHORING_FILER` to the matching storage endpoint as needed.
The importer refuses unexpected lesson IDs or records changed in the admin
after an import. Work in the admin normally; do not rerun to overwrite edits.

Lesson 1's current editor record has newer content than the legacy chapter export.
To update only its trivia in the live Memgraph database, run
`bun scripts/update-lesson-1-trivia.ts` from the repository root to review the
proposed text and current revision. Then pass `--write` and
`--expected-updated-at=<reviewed revision>`. This backs up the live record,
preserves the image and guide format, and refuses concurrent edits. The fact is
based on [the original liking-gap study](https://pubmed.ncbi.nlm.nih.gov/30183512/),
including its findings about new dorm mates; it is not a claim specific to Japan.

## Verification

Content tests cover active branch completeness, skill alignment, Japanese
support, absence of Korean, script placement, missing passages, and old-course
compatibility. Publish validation is applied to Conversational Skills Level 3+.

Browser checks use the saved draft export as intercepted lesson responses so
unpublished lessons can be tested in student and tutor renderers without making
them public. Database persistence is checked separately through the real lesson
service. Desktop checks cover all ten lessons in admin preview, editor, student,
and tutor views; mobile checks cover one lesson of each skill in each renderer.
Screenshots and the result report are under `output/lesson-authoring/qa` at the
repository root. Tutor login in these renderer checks uses a test response;
this does not exercise a real login flow.
