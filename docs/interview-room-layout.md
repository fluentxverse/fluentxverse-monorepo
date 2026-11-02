# Interview Room Layout

The admin interview room uses a full-height video stage and a 400px tools sidebar
(360px on smaller desktop screens). Remote video uses `object-fit: contain` so the
applicant is not cropped; the local preview stays in the corner. Call controls remain
outside the scrollable tools area. On mobile, video and controls stack above tools.

Identity, Evaluation and Chat are separate keyboard-accessible tabs. Identity opens
first. Panels remain mounted while hidden, preserving chat drafts, notes and the
current identity presentation. Each panel scrolls independently; chat fills its panel
with the composer at the bottom. Switching tabs does not start/stop recording or
submit decisions. The existing unrecorded ID-check and result safeguards are unchanged.

Release: `output/release/interview-room-layout-20261102/`. The API, socket protocol,
storage, recording implementation and tutor frontend are unchanged.

Verification uses two browser peers with synthetic camera/microphone streams and
mocked HTTP/socket signaling: real WebRTC video/chat, reconnect, multiline text,
draft retention, tab navigation, accessible ID/scoring controls, video-stage framing,
and media cleanup at call end, at 1440/390/320 in light/dark themes. No applicant
documents, real messages, recordings or decisions are used. Build passes; full
typechecking has only the known unrelated `AIContentGenerator.tsx:349` Skill diagnostic.

Published dashboard version: `52ab60ca-cfcb-405c-a0fe-3dd83d65e975`. Existing open rooms
keep their loaded assets until the next navigation/reload; no API restart is required.
All six two-peer regression scenarios also passed against published assets with synthetic
data. A first uncached production bundle load exceeded the test's default five-second
expectation; the join readiness assertion now allows twenty seconds and the rerun passed.

## Identity Action Safety

The standalone Revoke verification button has been removed from the shared reviewer UI.
Confirmed fraud opens a native modal with the review reason and consequences, defaults
focus to Cancel, and submits only after Yes, ban account. Cancel and Escape send no action.
Busy submissions cannot be dismissed/repeated. Tests exercise a verified applicant and
all three modal paths across desktop/mobile, including centered placement.

Revocation previously cancelled the booked slot; the room endpoint then returned 404 for
that status. Authorized staff can now read a cancelled room with `mediaClosed=true`.
Tutor/public access is not widened, and socket/media join restrictions are unchanged.
This preserves the review record without reactivating the call, restoring verification,
or editing the applicant's existing decisions. Route tests cover staff, owner, unrelated
tutor and anonymous access. Server typecheck and deployed-image route test pass.
API image: `fluentxverse-cloud/api:cancelled-interview-review-20261102`.
Dashboard version: `44f66c49-c6ab-48ba-ba39-473ee83cd670`. Final frontend release:
`output/release/identity-action-safety-final-20261102/`. Existing applicant identity and
booking decisions were not changed by deployment; no test bans were sent to production.

## Identity Review Workspace

The standalone identity review page now has a dashboard-styled header and applicant
queue with search, status filtering, selection highlighting, loading and empty states.
The selected applicant's name, document type and status lead the review workspace.
Document viewing and issuer links are separated from the decision form; acceptance
is the primary action and confirmed fraud is visually separated, retaining its modal.
Document images are still fetched only on explicit request through the protected API.
No ID data, review rules, deadlines, storage or permissions changed.

The desktop view uses queue/document/decision columns; smaller layouts stack these
sections without horizontal scrolling. Page-specific styles avoid changing the tutor
submission screen. The shared component remains usable within interview-room tabs.
Release artifacts: `output/release/identity-review-workspace-20261102/`.
Final contrast refinement: `output/release/identity-review-workspace-final-20261102/`.
Dashboard version: `5abcc70f-19d4-4978-9288-635ba7da8ff6`. Scoped builds, responsive
review/search/filter/confirmation checks and six two-peer interview regression scenarios
passed. Full typecheck still has only the pre-existing AIContentGenerator Skill diagnostic.
