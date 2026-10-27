# Public Student App Guide

Route: `/esl-student-app`. Original learner-focused writing based on reviewed
student-interface source, not an export from the tutor guide or protected API.
Review date: October 24, 2026. The deployed student source baseline and SHA-256
hashes are recorded in the release manifest.

## Source Areas

- Public and protected routes: `student/App.tsx`.
- Tutor search and time defaults: `BrowseTutorsPage.tsx`, `browseTimeFilter.ts`.
- Profiles, introductions, and favorites: `TutorProfilePage.tsx`.
- Booking holds, sign-in prompts and access modes: `BookingModal.tsx`.
- Appointment lists and cancellation presentation: `SchedulePage.tsx`.
- Authorized joining, chat, materials and media controls: `ClassroomPage.tsx`.
- Published library filtering: `MaterialsPage.tsx`. Named proposed tracks are not
  represented as fully available courses.
- Preferences and five-item history: `StudentProfilePage.tsx`.
- Preparation and follow-up: `LessonPage.tsx`.
- Conditional review enrollment, key backup and privacy warnings:
  `AnonymousLessonReview.tsx` and `AnonymousReviewsPage.tsx`.
- Feature visibility: `config/launch.ts`. Ticket and pass access are described as
  deployment-dependent, never guaranteed for all accounts.

The overview distinguishes cancellation eligibility from credit restoration;
recording consent from a camera preference; an account from unique-person proof;
implemented UI from live rollout; and activity counts from measured learning.
It does not advertise an autonomous student AI assistant, universal private
passes, mainnet launch, accredited results, fixed prices or guaranteed outcomes.

## Presentation

Both public guides use `components/PublicAppGuide.tsx` for identical search,
topic filters, table rendering, chapter navigation, deep links, clipboard and
print behavior. Their datasets, source notices, images, portal URLs and related
guide links remain distinct. Existing tutor chapters and their October 13 source
date are retained. The original learner photo
`/assets/img/esl-japanese-student-v2.webp` is reused; no image was generated.

The homepage student card and footer link to the guide; the direct student portal
link remains. Each guide links to the other.
