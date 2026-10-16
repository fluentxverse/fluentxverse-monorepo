# Tutor Management: Photos And Booking Restrictions

The dashboard `/tutors` table displays profile photos using the public API media proxy.
Legacy API hosts, filer URLs and stored `/user/` paths are normalized. Missing or failed
images fall back to initials. The same avatar handling is used by profile/suspension
modals and the Sessions page.

`GET /admin/tutors` now includes `profilePicture`, `isBlocked`, `blockExpiresAt`, and
`penaltyBlockOverrideUntil`. Existing User properties are reused; no migration is needed.
The list computes effective blocking at read time, so expired blocks are not shown as
active. Booking timestamps are serialized as ISO strings and displayed in PHT.

The Bookings column distinguishes an active block, no block, an automatic-block waiver,
and a separate account suspension. If an older API omits block status, it displays
Unavailable instead of assuming booking access. No block is not a certification decision.

Operators with the existing `operations` capability can choose Lift block. The existing
`POST /admin/operations/tutors/:id/unblock` action requires a reason and a trusted origin,
checks permissions on the server, logs an audit entry and notifies the tutor. It removes
the active restriction and waives automatic penalty-based blocking for seven days.
Attendance penalties and independent account suspensions remain unchanged. The list is
reloaded after success; failed requests leave the blocked state in place.

## Verification And Release

- `bun test tests/adminTutorVisibility.test.ts` in `fluentxverse-server`.
- `tests/adminTutorVisibility.integration.test.ts` requires explicit
  `ADMIN_TUTOR_TEST_URI` pointing to disposable Memgraph, never the application database.
  It covers real list reads, auth/permission/origin failures, required reasons, scheduling
  guards, seven-day overrides, audit records and preservation of penalties/suspension.
- `node tests/browser/tutorBookingAccess.cjs` in `fluentxverse-dashboard` uses isolated
  API fixtures for photo success/failure, booking states, permissions and the lift flow.
- Existing `tests/browser/sessionAvatars.cjs` and `tests/browser/adminDesign.cjs` cover
  avatar and table/navigation regressions.

Both API and dashboard releases are required. A dashboard-only deployment cannot expose
the new tutor-list fields. Keep the live ticketing build flag unchanged when releasing.

## Deployed October 15, 2026

- Dashboard Worker: `37c784ea-eddc-4260-a71a-983be56a5b75`.
- Previous dashboard Worker: `50f81690-a73d-4b9f-8e29-92f1fc935d0f`.
- API image: `fluentxverse-server:tutor-management-20261015`.
- API rollback image: `fluentxverse-server:pre-tutor-management-20261015`.

The API release extends the previously running image with only the admin tutor-list
service and its visibility helper. Environment values, command and persistent mounts
were preserved. No database containers were restarted and no real booking restrictions
were lifted during deployment. Live data reads verified that photo and block metadata
are present; unauthenticated tutor-list requests are rejected. Browser checks use the
deployed assets with isolated fixtures, including simulated unblock requests.
