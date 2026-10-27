# Tutor Workspace Access

Teaching pages require the server's application snapshot to confirm all four
requirements: written assessment, speaking assessment, profile approval, and
interview pass, with no missing requirements. ZK proof status is not a teaching
access decision. There is no client-side email allowlist bypass.

The shared certified-route guard covers scheduling, lessons, classrooms, materials
libraries and nested previews, conversational material viewers, and performance
metrics, Profile, and Knowledge Base. The profile Stats tab checks the same rule before activating the tab or
fetching performance data. Home teaching widgets and attendance reminders also
wait for approval.

Applicants retain access to the teaching journey, email confirmation, assessments,
interviews, application profile editing at `/application/profile`, settings, inbox,
and notifications. The application profile is linked from the teaching journey,
does not include the Stats tab, and does not unlock the main Profile navigation tab.
Navigation links remain visible; denied teaching links return to the journey with
a persistent, dismissible Certification Required warning. Direct URLs, refreshes,
and new tabs use the same guard. A failed approval lookup shows an error and retry
control, rather than granting access or incorrectly asserting rejection.

These are frontend workflow restrictions, not replacements for API authorization.
This release does not change backend permissions, database records, approved
profiles, interview decisions, or credentials.

Checks: `tests/teachingAccess.test.ts` and `tests/browser/teachingAccess.cjs` in the
tutor app cover all four requirements, 19 guarded URLs, navigation, the stats tab,
lookup failures, retry, approved access, and removal of the email bypass. Browser
tests use fixtures without changing real applicant approvals.
