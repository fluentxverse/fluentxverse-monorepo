# Business English Generator: Reference Study and Design

Reviewed: 2026-10-27, using the user's signed-in Chrome tab.
Status: research and a reviewable original sample. Runtime prompts and live materials have not been changed by this study.

## Scope and Sources

The reviewed curriculum is **Business Communication**, which differs from the older Jissen Business material referenced elsewhere in this repository. This is a representative sample, not a review of every lesson.

| Source | What was examined |
| --- | --- |
| [Curriculum and overview](https://tutor.rarejob.com/materials/business_conversation/business_communication) | A1 and A2; five workplace pillars; 200 listed input/output entries; separate preparation and performance lessons |
| [Tutor guide explanation](https://tutor.rarejob.com/materials/business_conversation/business_communication#Tutor%20Guide%20and%20Feedback) | Numbered actions, distinct spoken scripts, section times, answer guidance, objective-based feedback |
| [A1 socialization input](https://tutor.rarejob.com/lesson/material/business_communication/input/socialization/a1/lesson-1-1) | Repetition, vocabulary substitutions, sentence construction, intonation, model exchanges, supported roleplays |
| [A1 socialization output](https://tutor.rarejob.com/lesson/material/business_communication/output/socialization/a1/lesson-1-1) | Tasks accumulate communicative requirements, then change the student's role; reference language remains available |
| [A2 daily operation input](https://tutor.rarejob.com/lesson/material/business_communication/input/daily-operation/a2/lesson-7-1) | Functional language organized around appointment details, reasons, and alternatives |
| [A2 daily operation output](https://tutor.rarejob.com/lesson/material/business_communication/output/daily-operation/a2/lesson-7-1) | Request, explanation, alternative, and confirmation become a complete workplace exchange |
| [A2 meeting input](https://tutor.rarejob.com/lesson/material/business_communication/input/meeting/a2/lesson-8-2) | Completed, current, and next actions provide related language slots and a coherent model |
| [A2 meeting output](https://tutor.rarejob.com/lesson/material/business_communication/output/meeting/a2/lesson-8-2) | Increasingly complete updates, followed by practice conducting the exchange from the other role |
| [A2 presentation output](https://tutor.rarejob.com/lesson/material/business_communication/output/presentation/a2/lesson-9-2) | Main change, subsequent change and reason, then current position; reduced hints in the counterpart role |
| [A2 negotiation output](https://tutor.rarejob.com/lesson/material/business_communication/output/negotiation/a2/lesson-10-3) | Opening, response to a constraint, alternative, and closure; tutor guidance includes complete possible exchanges |

The count above describes the visible catalog entries. An input/output pair shares a topic; it does not represent two unrelated topics. No source lessons, screenshots, or vocabulary banks are stored as a training corpus here.

## Findings That Matter for FluentXVerse

The strongest recurring principle is alignment: a practical objective determines the language, the practice, the final task, and the feedback. Repeated sentence frames reduce the learner's burden while details change. Output activities build a conversation a piece at a time. Tutor notes specify what to say and when to intervene, making the material teachable without extensive improvisation.

The reference distinguishes correction timing. Controlled preparation receives prompt correction; simulations receive correction after the exchange. It also places tutor guidance beside student content, with numbered actions and visibly distinct scripts. This supports our existing separate paper and tutor-guide layout.

Several reference choices should be adapted to our requirements. Some roleplays begin with the learner; ours should have a natural tutor opening. Some tasks repeat many substitutions; ours should use a smaller core set plus optional variants to fit the lesson duration. Reference conversation practice restricts follow-ups, while our guided free talk should allow relevant, natural follow-ups. Our fixed feedback guide should remain vocabulary, grammar, and smooth delivery rather than adopting the reference's progression labels.

The overview describes 25-minute lessons, but the displayed A1 input section allocations total 29 minutes. Our generator should calculate its own time budget and mark optional work explicitly.

## Current Code, Verified Locally

- `fluentxverse-server/src/services/ai.service.ts` already defines `businessEnglishAgent` and `generateBusinessEnglishContent`.
- The agent currently uses `openai/gpt-5.2`, generates sections, and supplies English/Korean content.
- `fluentxverse-server/src/routes/ai.route.ts` exposes an admin-protected `/generate-be-content` handler. The complete URL depends on the router mount.
- Generation already consults existing house-standard lessons and earlier chapter lessons. Present patterns and vocabulary can be supplied to later sections for cohesion.
- Current chapter generation specifies five slots: Listening, Reading, Speaking, Speaking, Review. The lesson service also limits Business English chapters to five lessons.
- The speaking skill guidance is shared by Lessons 3 and 4. It does not, by itself, enforce a distinct guided versus sustained-speaking design.
- The section-generation request inspected here does not take a student ID or structured student evidence. It is an authoring tool, not proof that a personalized Business English checkpoint pipeline exists.
- `scripts/generate-business-english-level3.ts` is deliberately disabled. It is not the active generation entry point.

`business-english-level-03-plan.md` contains older ten-lesson decisions. Treat its lesson-count and Lesson 10 instructions as historical until deliberately reconciled with the current product. This study does not change the chapter sequence.

## Proposed Generation Contract

Extend the existing generator around one lesson plan shared by all sections. The following describes proposed responsibilities, not implemented APIs.

| Plan field | Required meaning |
| --- | --- |
| Identity | Course, level, chapter, lesson slot, language, template version |
| Lesson objective | One observable workplace outcome with natural Korean translation |
| Skill and delivery | Listening, reading, guided speaking, sustained speaking, or review |
| Required information | Facts the student must understand or convey to accomplish the objective |
| Language budget | Three core patterns for Level 3 and a short set of useful words or phrases |
| Source of truth | Scenario facts, document/table values, roles, and constraints |
| Progression | What becomes less supported or more demanding in each activity |
| Success checks | Observable task outcomes and acceptable alternatives |
| Tutor guide | Opening, exact scripts, actions, support triggers, correction timing, closure |
| Time budget | Required sections total 25 minutes; optional variants explicitly excluded |
| Evidence policy | Which assessed responses are recorded and how missing evidence is handled |

The agent should plan the final workplace task first, then select language and preparation that make it achievable. Section generation should receive the same plan and fact set. Improving one section should check its dependencies before changing a fact used elsewhere.

## Fit With Our Existing Material

| Existing data section | Recommended responsibility |
| --- | --- |
| `introduce` | Objective first, understanding check, then situation and task |
| `present` | Vocabulary, three functional patterns, and one useful pronunciation focus |
| `understand` | A skill-appropriate input with comprehension questions grounded in it |
| `practice` | Supported production followed by reduced support; item-level assessment where applicable |
| `challenge` | A workplace outcome with role/context cards and clear completion checks |
| `discussion` | Three general-topic categories with relevant questions; optional within the time budget |
| `feedback` | Same objective and fixed compact range/accuracy/fluency guide |

Keep the current `beData` storage and rendering boundaries. Source text, hints, expected answers, and tutor-only notes must remain distinguishable. The A4 renderer should keep individual activities intact and place teaching notes outside printed student sheets.

### Skill Differences

- Listening: the tutor-only script contains every tested fact. Learners first identify the main point, then relevant details, then use what they heard.
- Reading: a readable workplace document contains every tested answer. Learners locate details and use them to make a decision.
- Guided speaking: move from frames to cues to a complete exchange. Change the communicative demand as well as names or numbers.
- Sustained speaking: provide a short planning outline and one tutor opening, then let the student give an uninterrupted, level-appropriate response. Hold follow-up questions until it ends.
- Review: recombine language from the preceding four lessons. Use reliable student evidence when available; otherwise provide balanced coverage of their grammar tips and communicative outcomes.

## Tutor Guidance and Assessment

Each task needs a clear student instruction, tutor opening, expected outcome, acceptable alternatives, support rule, and stopping point. Scripts are exact spoken English; instructions describe actions; tips state exceptions. Do not expose the expected learner answer before assessing it.

For controlled items, record correct, incorrect, or not assessed. Keep support level separate: independent, prompted, or modeled. A correct response after help is different evidence from an independently correct response. Accept equivalent natural language in open tasks; do not mark it wrong solely for differing from an example sentence.

Record evidence with student, lesson, item, attempt, actual response when captured, correction, skill/category, tutor note, and support level. Keep lesson and student learning evidence in Memgraph under the established architecture. Generation must verify access to the student and source evidence on the server.

The fixed feedback categories remain:

| Category | Focus | Original compact example |
| --- | --- | --- |
| Range | Useful vocabulary and unnecessary repetition | "The room is good and the location is good." -> "The room is quiet and the location is convenient." |
| Accuracy | Grammar used to convey meaning | "She work in support." -> "She works in support." |
| Fluency | Long disruptive pauses and repeated fillers | "I, um, need... um... a room." -> "I need a room." |

Normal thinking pauses are acceptable. Feedback must describe observed performance; do not invent learner quotations, mistakes, or weaknesses. Task achievement should be assessed against the objective separately from these three language categories.

## Checkpoint Design

For the current five-lesson chapter, Lesson 5 is the review slot. Do not add a Lesson 10 slot without a product decision.

1. Load the actual preceding four lessons and their taught language.
2. Load authorized evidence for this student and those lessons. Distinguish missing data from successful performance.
3. Prioritize repeated, unresolved issues using evidence references. Preserve some coverage of the other chapter outcomes.
4. When evidence is sparse, use a balanced review of the preceding lessons' grammar tips and objectives. State that the selection is balanced; do not attribute unsupported weaknesses.
5. Generate fresh exercises and an integrated workplace task from the approved language and verified facts. Reusing grammar is intentional; repeating the exact exercise is unnecessary.
6. Validate and persist a student-owned lesson snapshot in Memgraph with source lesson versions, evidence IDs, generation policy/model version, and generation status.
7. Reopen the saved snapshot for the student. A deliberate regeneration creates a new revision; it should not silently replace a lesson already in progress.

Do not infer this workflow is already implemented merely because the general authoring agent exists.

## Quality Gates Before Saving a Generated Draft

- Valid schema and supported section/block types; failures return a useful generation error rather than a blank successful section.
- Identical objective at introduction and feedback; consistently label it "Lesson objective."
- English/Korean meaning agrees, with no Japanese remnants or visible HTML markup.
- Three core Level 3 patterns recur meaningfully through preparation and final task.
- Every closed question has a supported answer; each distractor is demonstrably wrong.
- Tables, dates, capacities, prices, and tutor responses obey one fact set.
- Later practice reduces support or adds a purposeful requirement; it is not solely a renamed duplicate.
- Tutor opens roleplays; sustained speaking has an explicit uninterrupted response period.
- Required work totals 25 minutes, with optional work clearly marked.
- Final task is solvable with the taught language and assesses the objective.
- Feedback guide remains fixed; student-specific feedback is evidence-based.
- A4 preview has no clipped activities or answer leakage to student pages.

## Reviewable Original Sample

See [Choosing a Meeting Room](business-english-original-sample.md). This is a text-only guided-speaking design, not a replacement for any saved lesson. It demonstrates one fact table, three patterns, decreasing support, a practical constraint, a tutor-first opening, and assessable completion criteria.

Recommended implementation sequence: reconcile the current chapter/template authority, add the shared planning contract, enforce slot-specific task progression, validate generated sections against that plan, and then connect student evidence to the checkpoint path. Use the existing agent and Memgraph lesson service rather than building a second unrelated authoring system.
