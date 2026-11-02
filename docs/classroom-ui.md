# Shared Classroom UI

The student classroom is the visual baseline for both apps. The tutor keeps
Teaching cues, lesson-note tools, and tutor-specific material controls. Student
classrooms do not render the tutor notes widget.

`shared/ui/ClassroomChatPanels.tsx` owns History and device settings for both
roles. They are non-modal panels anchored below the Chat header, never portaled
to a page-wide dialog. History refresh keeps its panel open; Escape and the
close button return focus to the trigger. Nested recording permission dialogs
retain their separate modal behavior.

`scripts/sync-classroom-styles.mjs` generates
`shared/ui/classroom-student-base.css` from the student classroom stylesheet.
Regenerate it after changing that baseline. The generated selectors are scoped
to `.classroom-standardized`; shared layout fixes live in
`shared/ui/classroom-layout.css`. The Lesson Request content expands naturally
instead of scrolling inside another scrolling panel.

Both lesson detail pages and classrooms display a quality-assurance recording
notice. Entering a room does not open a consent dialog or write consent.
Recording preferences remain available explicitly, and the server still
requires the necessary participant permissions before recording. The notice
alone is not authorization.

## Verification

`node scripts/tests/classroom-standardization.cjs` checks both roles in light
and dark themes at 320, 390, 1024, and 1440 pixels. Set `TUTOR_TEST_URL` and
`STUDENT_TEST_URL` for preview or deployed builds. APIs and sockets are mocked;
these tests do not record lessons or mutate customer data.

The scoped deployment script prepares from the previous live builds, runs the
paired browser checks, and verifies deployed asset hashes. It intentionally
excludes unrelated worktree changes and leaves the API unchanged.
