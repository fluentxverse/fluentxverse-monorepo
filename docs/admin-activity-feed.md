# Dashboard activity feed

The dashboard bell and overview read `/admin/activity`. Authentication is required,
responses are private/no-store, and requests are bounded to 250 items. The bell starts
at 25 and expands in batches of 25. It refreshes on opening, every 30 seconds and on
existing notification/mint socket signals. Failed refreshes retain the previous list
and display a retry message.

Coverage includes tutor/student registrations, profile submissions/reviews, all persisted
broadcast or recipient-specific admin notifications, identity submissions/reviews/resets,
credential requests/invalidation/issued NFTs, interview bookings/results, assessment
completion, lesson bookings/cancellations, notes submissions and completion-proof requests,
penalties, attendance/admin audits, issue threads/replies/decisions, student/tutor reports
and their latest reviews, payment/credit transactions, materials, account suspensions,
tasks/suggestions and inbox publication.

Entries link to the relevant admin screen. Personal documents, assessment contents,
recordings, private proving inputs and report descriptions are excluded from new
activity projections. Recipient-specific admin notifications are scoped to the caller.

This is a recent activity view over existing persisted events and snapshots, not a
complete immutable audit log. Historical state changes without a stored event cannot
be reconstructed. Some mutable sources expose only their latest update. Unknown legacy
event times remain unknown. Newly finalized identity NFT issuance records an `issuedAt`
timestamp so it is not incorrectly dated as its original request. Per-source reads are
bounded; mixed legacy string/temporal values are compared as strings in graph reads and
normalized to UTC for the final merge.

Validation: focused unit tests, candidate read-only checks against live graph/Postgres
data, API bundle/type checking, and desktop/mobile browser checks for expanded history,
links, refresh failures/recovery and dropdown layout. The scoped release includes the
existing metadata rate-limit layer unchanged.
