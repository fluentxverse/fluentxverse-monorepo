# Classroom And Workflow Follow-Up

## Scope

- Both classroom apps prepare local camera/microphone access only after an
  authorized room state. The preview stays private until the scheduled start.
- WebRTC reuses the prepared stream. RealtimeKit releases the preview before
  requesting its live token and taking ownership of the devices. Its existing
  server time/token gates and recording authorization remain unchanged.
- Permission failure offers Retry devices. Closing the room, losing access, or a
  delayed permission resolution stops the preview tracks.
- Removed legacy generic dark-mode section backgrounds from workspace pages.
  Primary, muted, and soft text tokens are checked against all four base surfaces
  at a minimum 4.5:1 contrast ratio.
- Tutor interview Return Home now returns to the tutor app, after the existing
  confirmation and camera/microphone cleanup.
- The Home guide has nine steps, including material selection, saving feedback,
  and final submission, with real UI screenshots in both themes. It still
  disappears after the first taught lesson; the knowledge base remains available.
- Obsolete note reminders and cancelled-session reminders become read history.
  Missing lessons lose their action links. Reconciliation runs before notification
  filtering, pagination, and unread counting. Drafts and unsubmitted edits remain
  actionable; other users' notifications are untouched.

## Verification

- Focused tutor unit tests: notification links, guide eligibility, knowledge base,
  and media-token authorization/lifetime.
- Browser checks: both roles and both media providers, pre-start transport denial,
  stream reuse or SDK handoff, denied-permission retry, revoked access, delayed
  acquisition cleanup, theme contrast, classroom parity, and responsive guide,
  notification, knowledge-base, and interview workflows.
- Backend: pure resolution tests and real disposable Memgraph tests cover
  obsolete reminders, unread filtering/counts, pagination, retained history,
  unavailable links, and ownership isolation.
- Screenshot capture uses synthetic lessons and intercepted API writes:
  `node scripts/capture-lesson-completion-guide.cjs`.

## Deployment Records

- Frontends: `scripts/deploy-readiness-improvements.mjs` overlays a narrow file
  list onto the previous live snapshots. Prepared/build/verification/deployment
  records live in `output/release/readiness-improvements-20261031/`.
  The device-switch cleanup follow-up is recorded in
  `output/release/readiness-device-cleanup-20261031/`; its live browser checks
  include a device change resolving after classroom closure, for both roles and
  both providers.
- API: `scripts/deploy-notification-resolution.mjs` overlays only notification
  changes onto the live mail-speed image. It preserves the full running Compose
  file chain, refuses to restart active classroom/assessment/interview work, and
  rolls back on health/authentication failures. Records live in
  `output/release/notification-resolution-20261031/` and its legacy-reminder
  follow-up `output/release/notification-resolution-legacy-20261031/`.
- Deployment is complete only when the corresponding `deployment.json` exists.
  Do not deploy the entire dirty workspace.

## Remaining Pilot Gates

The private dispute stack's synthetic HTTP smoke and health checks passed again.
It has not been promoted. Controlled SMTP delivery, explicit pilot logins,
an actual two-participant lesson, and the production storage configuration still
need verification. See `docs/dispute-staging-release.md`.
