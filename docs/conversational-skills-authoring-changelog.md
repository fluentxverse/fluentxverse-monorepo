# Conversational Skills Authoring Changelog

This repository history records curriculum production and lesson-authoring work.
It is separate from the website's public product changelog. A saved draft is not
a published lesson or an application deployment.

## 2026-11-13

### Chapter 5: Two Cities, One Secret

- Authored eight Japanese-support Level 3 lessons in slots 1-4 and 6-9 and saved
  them as drafts in Memgraph with chapter metadata.
- Continued Chapter 4's pending hybrid-work request with approval and Emma's
  first days at the Osaka agency. Introduced Ren while retaining Leo, Claire
  and Nao in the continuing story.
- Replaced the physical-intimacy incident with a hidden private dinner and a
  false work message. Updated the later advice, disclosure, questions and
  roleplays to follow that replacement consistently.
- Added workplace introductions, listening for interests, reading work updates,
  setting boundaries, apologies, regret, advice and honest difficult dialogue.
  The relationship outcome remains unresolved; forgiveness is not required.
- Retained direct character roles, useful language, concise dialogue, Japanese
  support, basic pronunciation, standardized tutor guides and the fixed rubric.
  No artwork generated for this chapter.
- Verification: 61 content/regression tests passed across Chapters 1-5 and
  checkpoint coverage; 33 fixture-backed dashboard/tutor/student browser checks
  passed across desktop/mobile and light/dark themes. Full Memgraph read-back
  and service lookup confirmed the saved drafts.

## 2026-11-12

### Story Chapters and Authoring Standards

- Rebuilt Chapter 1 around the user-approved eight-part Kamo House story.
  Corrected direct role assignments in Chapters 1 and 2 without altering student
  evidence or compatible artwork.
- Created Chapter 2, Exploring Kyoto; Chapter 3, Everyday Life & Unexpected
  Moments; and Chapter 4, Work, Dreams & Decisions. Each has eight new drafts
  in Memgraph, with Japanese support and a continuing four-character story.
- Kept the skill sequence speaking/listening/reading/speaking for Lessons 1-4,
  then speaking/speaking/reading/speaking for Lessons 6-9. Lesson 5 and Lesson 10
  remain personalized checkpoints, not static story episodes.
- Standardized tutor-first roleplays, short speaking dialogues, complete
  tutor-only listening scripts, distinct reading tasks, keyed exercises and
  useful-language support. Removed alternate-character and personal-information
  disclaimers from the story role assignments.
- Applied six watercolor illustrations to Chapter 1 Lessons 1 and 2 across
  Introduce, Apply and Challenge 1. Retained source artwork and optimized WebP
  assets; Chapters 2-5 remain text-only.
- Extended the guarded authoring updater through Chapter 5. It takes a reviewed
  snapshot digest, refuses non-draft replacements, detects concurrent edits,
  backs up records, writes transactionally and verifies full records. Notes,
  marks, fixed feedback definitions and existing checkpoints are preserved.

## 2026-11-05 Through 2026-11-11

### Editing and Renderer Corrections

- Improved early Japanese translations, trivia, discussion and pronunciation
  parts, tutor-guide presentation and the Lesson Objective Achievement label.
- Updated the earlier Chapter 1 prototypes and corrected the later lesson skill
  sequence before the final November 12 story rewrite. Historical correction
  utilities remain available for audit; do not replay them over current drafts.
- Shipped consistent tip-marker alignment and restored configured Useful
  Language in listening missions across student, tutor and dashboard renderers.
  These application fixes are documented separately in the public product feed.

## Persistence and Publication

Lesson content, personalized checkpoint lessons, student mistakes and tutor
notes belong in Memgraph. The authoring tools do not move them to Postgres.
Sparse checkpoint evidence still uses balanced review of the prior four lessons
rather than invented weaknesses.

Source builders and tests are versioned. Raw database snapshots, private
operational evidence, generated browser output and local caches are not part of
the source release. Publishing drafts, deploying applications and syncing
standalone app repositories are separate operations from pushing this monorepo.
