# Dashboard Pilot Testing

The `/testing` dashboard tab contains 31 versioned pilot checks: 29 runnable
checks and 2 gated release checks. All start unchecked; automated QA results do
not substitute for the team's production pilot.

Operations admins can check or reopen a test and save up to 2,000 characters of
notes. Other authenticated admins have read-only access. Use test-account
aliases and issue IDs; do not enter passwords, tokens, private recording URLs,
or raw customer records. Checklist results do not change feature flags, move
money, or enable certification.

`GET /admin/testing/` returns the catalog and shared progress.
`PATCH /admin/testing/:id` accepts exactly `completed`, `notes`, and `revision`.
Writes require operations permission and a trusted dashboard origin. Conflicting
revisions return 409; refresh and review the teammate's changes before saving.
The dashboard refreshes shared results every 30 seconds and preserves unsaved
notes while refreshing.

Progress and its append-only update history are operational QA records in
Postgres (`admin_testing_checks`, `admin_testing_audit`), not salary records.
Salary and payout reservations remain in Memgraph. This pilot uses the run ID
`mvp-pilot-20261014-v1`; incompatible acceptance-criteria changes should create a
new run rather than silently reusing old passes.

Live certification and live payout claim/settlement cannot be marked passed
while their release gates remain in the catalog. Removing a gate requires an
approved code release, not a checkbox action.

## Verification

```sh
cd fluentxverse-server
bun test tests/testingChecklist.test.ts
# Run against a disposable Postgres database only.
DATABASE_URL=postgresql://qa:qa@127.0.0.1:15439/qa bun tests/testingChecklist.persistence.ts
```

The persistence fixture requires an initially empty checklist database.
Browser tests use mocked authentication and checklist APIs; no production
results or financial records are changed.

```sh
node fluentxverse-dashboard/tests/browser/testing.cjs
```

The browser fixture expects the dashboard dev server at port 5194 (override
with `TESTING_URL`) and checks 1440, 768, and 375 pixel viewports.
