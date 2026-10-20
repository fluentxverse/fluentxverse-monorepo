# Student and Tutor App Quality Release

## User-facing changes

- Shared native dialogs provide keyboard focus containment, Escape/backdrop dismissal, nested scroll locking, focus restoration, and viewport bounds. Busy dialogs cannot be accidentally dismissed.
- Shared loading, empty, error, action, and connection states establish consistent interaction and styling across both apps. Mobile dialog fields avoid browser zoom and support reduced-motion preferences.
- Every lazy page has a retryable error boundary. Browser Back/Forward and explicit reload remain available without clearing authentication. A temporary certification lookup failure now offers retry rather than treating the tutor as uncertified.
- Student lesson details show Booked, Prepare, Classroom, and Feedback progress. Booking identifies the actual trial, prepared pass, or legacy ticket requirement without changing charging or reservation rules.
- The tutor Teaching Desk lists upcoming lessons, attendance/entry urgency, pending notes, unresolved sent/received issues, and temporary scheduling restrictions. Failed refreshes preserve prior tasks and never masquerade as an empty schedule. Issue lists do not expose student names.
- Student issue-report drafts restore after a refresh within the same tab, account, and lesson. They expire after four hours and clear on successful submission or explicit sign-out. Credentials and payment details are never stored in these drafts. Existing tutor note drafts now have an in-app navigation warning as well as reload protection.
- Tutor pages load on demand rather than shipping every classroom, PDF, material renderer, and assessment on startup. Both apps enforce startup JavaScript budgets of 400,000 raw bytes and 135,000 gzip bytes, including all static dependencies and the student's always-loaded App chunk.
- Young Learners lesson text, lyric panels, headers, navigation, and backgrounds remain legible in dark mode.

## Recovery Rules

Temporary GET failures retry once with bounded backoff. Aborted requests, changed authenticated sessions, authorization failures, validation failures, and every write operation are excluded. Notifications retain their dedicated retry logic. Public tutor searches use the same read-only retry policy. No booking, ticket consumption, report, attendance, or payment operation is replayed automatically.

## Release Commands

Run from the repository root with both apps' dependencies installed and Bun available:

```sh
npm run check:apps
npm run check:app-budgets
npm run deploy:apps
```

The release runner builds both apps, runs unit tests, checks manifest-based startup budgets, launches isolated production previews, and runs the browser suites listed in `scripts/release-cases.mjs`. Deployment stops immediately on failure. `--deploy=student` or `--deploy=tutor` publishes just that app after the same checks. The existing per-app `cf:deploy` commands also use this gate.

GitHub CI runs the gate for pull requests and requires it before main-branch deployment. Reports are written to `output/release`; screenshots from suites using the shared output directory are uploaded as CI artifacts. Browser selection supports `PLAYWRIGHT_EXECUTABLE_PATH`, local Chrome, or Playwright Chromium.

## Coverage and Limits

Browser fixtures exercise desktop/mobile, light/dark, route failures, browser history, booking, notifications, lesson details, schedules, materials, settings, offline notices, drafts, nested dialogs, tutor tasks, certification outages, and nonblank interactive homepage canvas rendering. API fixtures prevent real financial or account mutations during checks.

Automated Chromium checks do not replace testing physical iOS/Android keyboards, screen readers, real OAuth providers, live video calls, or a separately authorized end-to-end payment/chain transaction. This release does not claim every possible application defect is eliminated.
