# Daily Dispatch Generation

The article generator lives in the separate `fluentxverse-ai` repository. It is
not an Elysia API background job. Its single cloud Docker worker is named
`fluentxverse-dispatch`, on the private application network with no exposed ports.

The restored worker generates one published article per Philippine day at 03:00
Asia/Manila. Startup catches up the most recent scheduled day, not the whole missed
history. Stable `daily-dispatch-YYYY-MM-DD` article IDs and create-only persistence
make restart/retry recovery idempotent. Keep exactly one worker replica; this is
not a distributed generation/lease system. Do not run the legacy scheduler too.

Generation failures retry after 5, 10, 20, 40, then 60 minutes. A 15-minute watchdog
restarts stalled generation. The worker has a 768 MiB memory limit, half a CPU,
bounded logs, a read-only filesystem, and a writable temporary directory. Docker
restarts it after host reboot. Health checks report stale polling or repeated
failures; Docker health alone does not restart an unhealthy process or send alerts.

The worker uses existing server OpenAI and Memgraph configuration. Only its
required settings are copied into a mode-0600 Compose file on the VPS. It does not
receive signing keys, authentication secrets, payment credentials, or the Docker
socket. NewsAPI/GNews credentials are optional; the existing generator falls back
to Google News RSS. Generated material still requires normal editorial oversight.

Deploy the reviewed generator checkout:

```bash
node scripts/deploy-daily-dispatch.mjs /absolute/path/to/fluentxverse-ai
```

Runtime configuration:
`/opt/fluentxverse/releases/daily-dispatch-20261027/compose.private.json`.
The original API image and its Compose configuration are not changed. Logs are
available with `docker logs fluentxverse-dispatch`. Check for `dispatch_published`,
confirm the article through the authenticated Dispatch API, and inspect container
health. Stop only this worker with `docker stop fluentxverse-dispatch`; do not
launch the old full-stack Compose file from the AI repository.
