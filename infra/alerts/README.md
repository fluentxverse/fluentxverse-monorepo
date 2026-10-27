# Operational Alerts

The administrator page is `/alerts`, below Stats, restricted to the `operations`
capability. The header indicator counts active unacknowledged incidents.
Acknowledgement records the authenticated administrator and does not resolve an
incident. Recovery requires fresh healthy observations.

## Architecture

`fluentxverse-alerts` is a Cloudflare Worker with a one-minute Cron Trigger and
a SQLite-backed Durable Object. It is independent of the VPS and stores incident
state, recent restart observations and acknowledgement history there. It polls
the public API health endpoint and an authenticated aggregate telemetry endpoint.
Neither the API nor the browser has a Docker socket. The existing least-privilege
host collector publishes sanitized Docker restart counters and health states.

The monitor never generates proofs, signs transactions, retries payments, restarts
containers, deletes recordings or changes application records. Application proof
workflow reads stay in the FluentXVerse Memgraph database; this monitor does not
reach into Engine/Vault storage. It does not cover manual Engine proof submissions.
Only counts and timestamps leave the origin, not witnesses, scores, private media,
student identifiers, tutor identifiers or financial records.

## Conditions

| Condition | Opens | Recovers |
| --- | --- | --- |
| API availability | 3 failed one-minute observations | 2 healthy observations |
| Disk | 85% warning; 95% or <1 GiB available critical | <80% and >=1 GiB available |
| Containers | Required service missing, stopped, unhealthy; or >=3 restarts/10 minutes | Healthy observations and restart window clears |
| Recording archives | Archive errors, >=3 retries, or uploaded/unarchived >30 minutes | No failing or overdue archives |
| Application proofs | Pending submission/reconciliation/receipt workflow >30 minutes | No overdue pending workflows |
| Telemetry | Missing or stale source | Complete fresh sources |

Except API availability, conditions need two failing observations to open and two
healthy observations to recover. Escalation to critical clears acknowledgement.
Missing data cannot resolve an incident. Long monitor gaps reset consecutive
observation counters. Container replacement or restart-counter reset establishes a
new baseline; deployment replacements are not counted as crashes.

For legacy proof records without an applicable timestamp, the monitor uses the
first-observed age of the pending queue, rather than inventing a submission date.
This is an aggregate queue-age signal, not exact per-proof latency. No alert means
only that thresholds were not met; it does not independently establish proof
validity, teaching quality or complete recording coverage.

Active incidents are retained. Resolved incidents expire after 90 days and total
history is bounded to 200 incidents and a conservative 100 KB persisted-state
budget; older resolved incidents may be removed sooner to stay within that budget.
Each incident has a stable UUID and opened,
escalated, acknowledged and resolved events. Browser filters never mutate history.

## Access And Delivery

- `GET /internal/operational-alerts/telemetry` requires `x-fxv-monitor-key`.
- `GET /admin/alerts` requires an active operations administrator session.
- `POST /admin/alerts/:id/acknowledge` requires that session and the dashboard
  origin. The server supplies the actor, not the browser.
- Worker `/snapshot`, `/acknowledge`, and operator `/check` require a bearer
  `MONITOR_KEY`. `/check` runs the same fixed real checks as Cron; it cannot accept
  fabricated telemetry or caller-selected probe destinations.
- Worker `/availability` exposes only a timestamp and generic API availability.
  It allows the cached dashboard to display availability when the API is down.
  The full incident list is not public. If the Worker stops checking, the dashboard
  shows stale monitoring after three minutes rather than an all-clear.

`OPERATIONAL_ALERTS_KEY` on the API and Worker secret `MONITOR_KEY` must match.
Use a dedicated random secret, never a student, tutor, administrator or Vault key.
Do not put it in Vite variables or logs. Rotate both ends together; failed telemetry
authentication must result in unknown-source warnings, not fabricated healthy data.

Dashboard incident polling and header badges are enabled automatically. Browser
notifications are opt-in, require browser permission, and work while the Alerts
page is open and able to poll. They are not mobile push notifications. Email,
SMS and chat delivery are **not configured**. Without an external destination,
nobody is paged when all dashboard tabs are closed. The independent monitor still
records incidents and recovery while the VPS is down, but it cannot guarantee
the dashboard or Cloudflare itself is reachable.

## Verification And Deployment

```bash
bun test infra/alerts/policy.test.ts infra/alerts/probe.test.ts fluentxverse-server/tests/operationalAlerts.test.ts
cd infra/container-metrics && go test ./...
```

The scoped release scripts preserve the live backend and dashboard baseline,
check for active classroom connections, test the overlay image, and keep private
Compose and collector rollback copies. Only the API and metrics collector restart;
Engine, Vault and data stores are not redeployed. Never restore database volumes
to roll back this code change.

Policy tests simulate outages, flapping, disk escalation, archive failures, stalled
proofs, unknown sources, acknowledgement, recovery and container replacements.
Browser tests cover desktop/mobile, themes, filtering, permission rejection,
acknowledgements and offline fallback. Do not stop production services or exhaust
real disk space to test alert rules during lessons.

The initial rollout produced an availability incident because the Worker rejected
the unsupported `redirect: error` fetch option, not because the VPS was confirmed
down. The probe now uses `redirect: manual`, treats redirects as failures without
following them, and has runtime-compatibility regression tests. The incident is
retained in history and recovers through normal healthy observations; it is not
deleted to hide the monitor defect. The Worker explicitly uses
`global_fetch_strictly_public` so probes traverse public routing.
