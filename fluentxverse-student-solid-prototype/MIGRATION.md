# Migration Coverage

The Solid app is the deployment source for the existing student Cloudflare
Worker. Local development remains available on port 5176 with isolated test API
harnesses. Production connects directly to the existing .com backend; no database
reset, cookie renaming, or backend replacement is part of this deployment.

The previous Preact deployment can be restored using Cloudflare version rollback.
Its source remains intact. The compatibility lab is development-only.

## Automated Checks

| Area | Coverage |
| --- | --- |
| Native frontend | Solid compilation, lazy routes, TypeScript build; no React/Preact/Zustand runtime |
| Dashboard | Populated/empty/error states, statistics, navigation, responsive layouts, bitmap assets |
| Schedule | JST dates, cancellation cutoff, confirmation and retry, past-lesson calendar |
| Materials | Course listing and artwork; level/chapter/search filters and lesson navigation |
| Tickets | Shared ticket art, tier selection, balances, purchase UI and history |
| Profile | Editors, saves/retries, lesson history, materials, device tests |
| Lessons | Timing/entry/wrap-up, cancellation, material requests, notes, reports and feedback |
| Account settings | Email/password/personal details, clipboard, busy/errors, focus, logout |
| Secondary pages | Inbox, public pages, archives, registration, lesson content and dialogs |
| Classroom | Mocked signaling, recording choice, issue reporting, feedback on tutor exit, cleanup |
| Tutor browsing | Search, filtering, guest schedules and authentication prompts |
| Carousel | Actual Three.js canvas, high-resolution textures, motion and interactions |
| PDF viewer | Installed-package worker, actual canvas pixels, text layer and high-resolution rendering on desktop/mobile |
| API harness | Exact origin checks, cookie isolation, endpoint allowlist, default write blocking |
| Compatibility lab | Mocked session scenarios, origin remediation, wallet signatures and lifecycle races |

The 36 unit tests check session, identity, wallet, origin, cookie, API harness and deployment endpoint
boundaries. The older cancellation test targeting the previous lesson layout
also fails against the original app; the recreated app instead uses the current
lesson/schedule design suites, which cover cancellation deadlines and retries.

The browser suites exercise widths from 320 to 1566 pixels and both themes where
applicable. Application workflow suites mock APIs and socket messages; a pass is
frontend parity, not evidence of completed real bookings, payments, or calls.

## Live Production Gates Still Required

- Sign into the recreated app using each enabled provider; verify reload, recovery,
  registration, logout, and rejected/expired sessions with its separate API cookie.
- Test a real external wallet on a test chain, including account/network changes,
  rejection, balances, ticket transfer, purchase recovery, and refunds.
- Use isolated seeded Memgraph/PostgreSQL databases to test real bookings,
  cancellation deadlines, attendance, notification delivery, reports and surveys.
- Exercise tutor/student calls on separate browsers/devices, including early entry,
  scheduled unlock, cancellation revocation, reconnects, tutor disappearance,
  recording permission, cleanup, and the three-minute end-of-lesson cutoff.
- Validate PDF/lesson file serving against the intended media storage environment.
- Confirm Privy core's support status and restore strict-null/implicit-any checks.
- Cloudflare routing, API origins, security headers and build configuration have
  deployment-specific checks. Account cookie lifecycles and live workflows still
  need real-user verification; keep the previous version available for rollback.

Neither API harness enables production write endpoints or production background
jobs. Test database mutation mode is opt-in and must not point to existing student
data. The frontend is not ready to replace production solely because visual and
mocked interaction tests pass.
