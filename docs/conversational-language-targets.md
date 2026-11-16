# Conversational Skills Language Targets

The course owner supplied these authoring ranges on November 13-15, 2026:

| Product Level | TOEIC Authoring Range |
| --- | --- |
| 3 | 10-220 |
| 4 | 225-545 |
| 5 | 225-545 |
| 6 | 550-780 |
| 7 | 550-780 |
| 8 | 785-940 |

These are product content targets, not a CEFR conversion or a prediction of a
learner's test result. A workplace setting does not make Level 5 an advanced
course. The B1/B2/C1 labels in older source references do not control difficulty.

## Language

Level 3 uses very common words, one idea at a time, short complete sentences,
simple present/past, can, and direct questions. Keep the continuing plot but use
simple ways to talk about feelings, choices and mistakes. Do not require complex
conditionals, hypothetical regret, past-perfect passive or abstract analysis.

Levels 4 and 5 share a language band: common social/work phrases, simple reasons,
clear questions, requests and short exchanges. Teach essential story words with
Japanese support. Do not increase grammatical difficulty just because a plot
includes a job, budget, missing file or mystery.

`shared/conversationalLanguage.ts` is the common policy for authoring and future
AI requests. Its word budgets are editorial safeguards, not proficiency tests.
Japanese support remains for Levels 3-5. Useful Language, pronunciation and the
existing guide structure remain across these editions. Speaking is tutor-first
dialogue, not a compulsory monologue.

Levels 6 and 7 use clear intermediate English, relevant multiword expressions,
comparisons, reasons, polite clarification and manageable connected sentences.
The C1/C2 reference subtitles do not override the owner's ranges. All lesson text,
tutor guides and feedback labels are English-only. Step A uses exactly four
expressions, each with an English definition and contextual example, not six
vocabulary cards. Part II discussion leads directly to Step B pronunciation; there is no Part III pronunciation.
Cultural explanations must attribute practices to the speaker or tradition
rather than impose universal etiquette rules.

Level 8 uses the owner-confirmed TOEIC 785–940 range and that score range as
the visible lesson badge. Use precise multiword expressions, qualified claims,
competing perspectives and manageable discussion of implications. Explain the
expressions in English and keep four per lesson. English-only materials,
tutor-first short dialogue and Step B-only pronunciation continue. Sensitive
topics stay within the fictional roles; do not require personal disclosures.
The old C1–C2 subtitle and INTERMEDIATE badge do not override this instruction.
Level 8 editorial caps are 100 introduction words, 220 speaking-model words,
130 words per private listening message and 280 words per reading passage,
with sentences generally at most 26 words.

The owner's November 15 pronunciation update applies from Level 6 onward:
Step B uses a Phrase/Example table for connected speech and meaning groups,
with at least two contextual phrases, readable guides and full sentences.
Bold marks the exact stressed words or syllables. Linking and pause marks are
separate cues. The only pronunciation section is Step B; Part III is removed.
The sixteen existing drafts in Chapters 1/2 have this format saved and verified,
with only Step B and the warm-up transition changed. Metadata, artwork, fixed
feedback, publication states, other lessons and learner-evidence hashes matched.
Future checkpoint composition reviews one pronunciation phrase from each source
lesson; existing saved checkpoints are not regenerated.

New Level 6 sources live under
`fluentxverse-server/content/conversational-skills/en/`. The existing expressions
renderer supports this format without a frontend change. Local validation and
future-checkpoint composition enforce English-only content and four expressions;
Level 6 review expressions are drawn from all four source lessons. These server
policy changes require a server release before they affect live publishing and
new checkpoint generation. Saved checkpoints are never rewritten.

## Versioned Content

The older Kyoto story definitions remain as plot baselines and regression
fixtures. Approved simplified episodes are versioned under
`fluentxverse-server/content/conversational-skills/ja/toeic-revisions-v1/`.
`buildToeicLesson()` composes the current language with those stories and the
standard lesson layout. Authoring/updating must use this composed version, not
replay a historical builder directly over the saved lessons.

Level 5 Chapter 1's direct builder also loads its approved versioned episodes,
because the newer reference changes the plot as well as its wording. New
Chapter 3 is authored directly at the shared language target. It uses the
standard builder, not an older difficult-language baseline.

The revised Level 5 Chapter 1 reference supersedes its first draft: professional
friendship and mystery only, no romantic subplot. It retains two financial-report
versions, the instruction to keep the old report, its later disappearance, an
incomplete argument and the Northstar Media printer-page reveal. It does not
retain the old mistaken-attachment or deleted-proposal storyline.

## Checks and Persistence

Lesson authoring is now entirely offline. Do not call the application's model
API, another provider, or even a model-availability probe for these tasks. The
owner reserves application API credits for Daily Dispatch. This policy is also
recorded in the root `AGENTS.md`.

The earlier partial API-generated candidates remain part of the editing history.
Their gaps were completed by direct editorial work. The API batch generator was
removed. `scripts/compile-editorial-language-revisions.ts` reads only local source
and draft files; it has no model client, network client, process launcher or API
key access. Tests verify that restriction. Directly authored copy is in the
`editorial-chapter*.ts` files; the compiler validates and produces versioned JSON.
Automated checks are editorial safeguards, not a language-level certification.

`scripts/apply-toeic-language-revisions.ts` handles the existing 88 records:
forty Level 3, forty Level 4 and eight Level 5. A fresh dry run and exact snapshot
digest are required before writing. It backs up records, changes only the
language/content fields, preserves IDs, media, publication states and fixed
feedback, and verifies full read-back plus unchanged metadata and learner
evidence. Complete learner-reference node properties are hashed on the server;
student notes and marks are not exported to a model or rewritten. Published
records retain their existing status; new publication is
not performed. The updates belong in Memgraph, never Postgres.

The older-chapter updater also uses `buildToeicLesson()`; new Chapter 3 uses its
already-calibrated chapter builder. Dynamic checkpoints keep
observed-error targeting and balanced four-lesson review when evidence is sparse.
Existing saved checkpoints are not regenerated by this revision.

## Revision Status: November 14, 2026

November 15 Level 8 final-chapter update: The Courage to Speak (Chapter 5) has
eight saved and verified English-only drafts at TOEIC 785–940, with the same
visible lesson label. Four Step A expressions, Step B-only pronunciation with
bold stress and dynamic checkpoints follow the owner's pointers. Earlier lessons
and saved reviews remain. This does not add the unsupplied Chapter 4.

November 15 Level 8 Chapter 3 update: The Price of Belonging has eight saved
and verified English-only drafts at TOEIC 785–940, with the same loaded lesson
label. Four expressions, Step B-only pronunciation with bold stress and dynamic
checkpoints follow the owner's pointers. Saved reviews and earlier lessons remain.

November 15 Level 8 Chapter 2 update: Behind Closed Doors has eight saved and
verified English-only drafts at TOEIC 785–940, with the same live lesson label.
Four Step A expressions, Step B-only pronunciation with bold stress and dynamic
checkpoints follow the owner's pointers. Earlier lessons and saved reviews remain.

November 15 Level 8 Chapter 1 update: Behind the Smiles has eight saved and
verified English-only drafts at TOEIC 785–940, starting The Things We Don’t Say.
The owner explicitly requested that score label. Four Step A expressions,
Step B-only pronunciation with bold stress and dynamic checkpoints continue.
Saved reviews, notes, marks and earlier lessons remain unchanged.

November 15 Level 7 final-chapter update: One Last Encore has eight saved and
verified English-only drafts at TOEIC 550–780, completing the five-chapter
Beyond the Spotlight story. Four Step A expressions and Step B-only
pronunciation with bold stress follow the owner's pointers. Checkpoints 5/10
remain dynamic, with saved reviews and earlier lessons unchanged.

November 15 Level 7 Chapter 4 update: The Price of Fame has eight saved and
verified English-only drafts at TOEIC 550–780, with four Step A expressions
and Step B-only pronunciation with bold stress. Checkpoints 5/10 remain dynamic;
earlier lessons and saved personalized reviews are unchanged.

November 15 Level 7 Chapter 3 update: Behind the Contract has eight saved and
verified English-only drafts at TOEIC 550–780. Four Step A expressions and
Step B-only pronunciation with bold stress follow the owner's pointers.
Checkpoints 5/10 remain dynamic, with saved reviews and earlier lessons unchanged.

November 15 Level 7 Chapter 2 update: The Algorithm Never Sleeps has eight
saved and verified English-only drafts at the same owner-confirmed TOEIC
550–780 target, with four expressions and Step B-only pronunciation with bold
stress. Checkpoints 5/10 stay dynamic; earlier lessons and saved reviews remain.

November 15 Level 7 update: the owner confirmed TOEIC 550–780 for Level 7.
Chapter 1, Before the Spotlight, has eight saved and verified English-only
drafts with four expressions and Step B-only pronunciation. Beyond the
Spotlight is the level topic. Saved checkpoints and earlier lessons are unchanged.

November 15 final-chapter update: Level 6 Chapter 5, What We Leave Behind, has
eight saved and verified English-only drafts. Four Step A expressions and
Step B-only pronunciation follow the current pointers, with no Part III or
extra pronunciation commentary. Checkpoints 5/10 remain dynamic.

November 15 update: Level 6 Chapter 3, The Taste of Tradition, has eight saved
and verified English-only drafts. It uses Step A Expressions and the new
Step B natural-pronunciation table, with precise bold stress and dynamic
checkpoint slots 5/10. The sixteen earlier Level 6 drafts also have the
pronunciation update saved; existing personalized checkpoints are unchanged.

Level 6 Chapters 1 and 2 have eight saved and verified drafts each in Memgraph.
Both use English-only content, four Step A expressions, the TOEIC 550-780 target
and dynamic checkpoint slots 5/10. No checkpoint generation or deployment was
performed during this authoring work.

Level 5 Chapter 3's eight new drafts and Chapter 1's eight revised drafts are
saved and verified in Memgraph.
Chapter 4, Difficult Choices, also has eight saved and verified drafts at the
same TOEIC 225-545 target, using its calibrated chapter builder and the saved
authoring corrections. The B2-C1 reference label does not override this target.
The 88-lesson pass is saved and verified in Memgraph: forty Level 3, forty
Level 4, and eight Level 5 Chapter 1 lessons. All missing copy was completed
directly, without further model API calls. Structural, language-budget,
answer-key, Japanese-support, story-fact, role-switch and preservation tests
cover the full set. The compiler is idempotent, and the guarded writer skips
unchanged records. Verification passed 146 tests and 209 renderer cases, plus
two focused final exercise checks. Full record read-back, learner-evidence
hashes and eleven chapter samples through the running lesson service matched.
