# Workplace Communication

## Category Decision

Workplace Communication is a separate material category from Business English. Its course ID is `workplace-communication`, and the admin workspace is `/workplace-communication`, reached through Lesson Maker.

The reference study in `business-english-generator-blueprint.md` predates this category decision. Use its observations about task progression as research for this new category; do not apply its proposed changes to the existing Business English course. The original sample there is also a research draft, not a saved lesson.

## Initial Admin Scope

- Separate lesson library with Prepare and Perform filters, search, and blank draft creation.
- Text authoring, optional Japanese or Korean translations, and separate facilitator notes.
- Student preview hides facilitator notes unless the admin enables them.
- Save and reopen drafts using the existing admin-authenticated lesson API and Memgraph.
- No images, generated lessons, publishing controls, or student/tutor catalog integration in this initial category workspace.

Level, chapter, and lesson number currently use the existing service bounds (1-10, 1-5, 1-10). Each draft occupies a numbered slot; Prepare and Perform currently use separate lesson numbers. A final curriculum map and pairing model are not fixed by this initial registration.

## Original Headings

| Prepare | Perform |
| --- | --- |
| Workplace Brief | Workplace Brief |
| Words at Work | Language Refresh |
| Useful Phrases | First Exchange |
| Response Builder | Handle the Details |
| Delivery Practice | Complete the Task |
| Guided Rehearsal | Beyond the Scenario |
| Progress Review | Progress Review |

Both templates allocate 25 minutes. The objective label is consistently **Lesson objective**. Template definitions and validation live in `shared/workplaceCommunication.ts`.

## Persistence

Drafts use `LessonMaterial` nodes with `course: workplace-communication` and a separate JSON `workplaceData` property. They do not use Business English's `beData`. The versioned document contains mode, translation language, and ordered section IDs with content, translation, and facilitator notes. Creation stores the complete initial document in one database write. Update validation rejects attaching Workplace Communication content to another course.

Draft lesson content is not stored in localStorage. Existing authentication and theme preferences retain their normal behavior.

## Verification

- `bun test fluentxverse-server/tests/workplaceCommunication.test.ts`
- `WORKPLACE_TEST_MEMGRAPH_URI=bolt://127.0.0.1:7693 bun test fluentxverse-server/tests/workplaceCommunication.integration.test.ts` (isolated test database only)
- `ADMIN_TEST_URL=http://127.0.0.1:5175 node fluentxverse-dashboard/tests/browser/workplaceCommunication.cjs` (intercepted API fixtures; no production writes)
