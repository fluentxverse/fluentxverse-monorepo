# Profile review status consistency

Both apps and server item approval use the same six required keys from
`shared/profileReview.ts`: nickname, photo, video, bio, education and interests.
Legacy extra keys cannot inflate progress or block approval. Server item reviews
read, update and decide overall status in one transaction after locking the applicant.

Submitting an already approved or pending profile is idempotent: it preserves the
status and submission timestamp and sends no duplicate submission notifications.
Production identity/wallet consent checks still apply. Draft edits to a reviewable
field invalidate that item's prior approval; equivalent values leave it unchanged.
Already-approved profiles continue using the existing pending-change review workflow.

The tutor profile displays an explicit approved banner. While awaiting review it
refreshes every 15 seconds when visible and on window focus, bypassing the short
profile memory cache. UI progress alone never grants approval; server status remains
authoritative.

The scoped operator repair in `scripts/reconcile-profile-approval.mjs` verifies the
affected account's six recorded approvals, matching approved screening decision,
stored snapshot fields, valid nickname and absence of pending changes before restoring
its inconsistent overall flag. It preserves the original decision/review timestamp
and writes an operations audit. It cannot approve missing or conflicting decisions.
