# Tutor Public Names

`User.nickname` is the preferred student-facing name. Legal first/middle/last names remain unchanged for private account and admin operations. The existing registration in this checkout does not persist a nickname; profile setup now explicitly requests one.

Nickname is required to submit a new profile. It is a sixth independently reviewed item. Updating an already-reviewed nickname during an initial application resets that item's review. Approved profiles keep their current nickname while an edit awaits moderation; approval applies it and clears tutor discovery/profile caches. Rejection keeps the existing name.

Frontend and API enforce 2-24 Latin letters, including ordinary accented letters, with single spaces, hyphens, or apostrophes between name parts. Digits, decorative Unicode lettering, emoji, repeated separators and contact formats are rejected. Readability, capitalization, surname omission, impersonation, professional language and consistency with the introduction video are human-review checks.

Public profiles, search/cards, booking details, favorites, lesson histories/notes and reminders use the nickname. Legacy accounts without one fall back to first name only, never surname or the historical full `displayName`. Existing approved profiles are not retroactively blocked or renamed.

The API image and all affected frontend release snapshots must include `shared/tutorPublicName.ts`. Release the API, tutor, student and dashboard changes together. No automatic migration of legal names or existing display names is performed.

Tests: `tests/tutorNickname.test.ts`, `tests/tutorNickname.persistence.ts` in the API, and nickname browser coverage in tutor, student and dashboard apps. Persistence tests require an empty disposable graph on localhost:17729; they never run against production.
