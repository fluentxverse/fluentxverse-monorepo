# Mail Performance Update

Deployed 2026-10-31 as `fluentxverse-cloud/api:mail-speed-20261031`.
Base: `fluentxverse-cloud/api:project-destinations-20261029-enrollment`.
Only the mail provider and connection pool were overlaid; pending dispute and
other development changes were not promoted. No active classroom connections
were present at restart. Runtime environment, volumes, networks and port bindings
were checked against the previous container; live API health passed.

## Changes

- IMAP uses exclusive reusable connection leases, capped at six connections.
  Idle connections close after 30 seconds. Connection keys bind the server,
  account and credential fingerprint; mailbox selection is never shared between
  simultaneous requests. TLS verification remains enabled.
- Verification sends return when SMTP accepts the message instead of waiting for
  an IMAP connection and Sent-folder append. Automated verification messages no
  longer archive the raw confirmation link in Sent. Normal dashboard-composed
  messages retain their Sent-copy behavior and delivery warnings.
- SMTP rejection is not treated as confirmation acceptance. There are no blind
  retries after uncertain delivery. Provider acceptance still does not prove
  recipient inbox delivery.

## Measurements

Read-only measurements against the configured tutor mailbox on the VPS:

| Operation | Previous | Patched cold | Patched warm |
| --- | --- | --- | --- |
| Folder list | 1,915 ms | 1,622 ms | 126 ms |
| Inbox list | 2,339 ms | 392 ms (connection reused) | 256-258 ms |

These are a small sample, not a latency guarantee. Cold connections after the
idle timeout still require TLS/login. No message contents or credentials were
included in measurement output. No mail was sent by this benchmark.

## Verification

- Full backend typecheck passed.
- 27 email, template, MIME, security and pool tests passed (159 assertions).
- Tests cover lease reuse, exclusive concurrent leases, capacity release after
  failure/idle expiry, SMTP acceptance without IMAP and rejected recipients.
- Live container reports healthy after deployment.

Actual confirmation arrival time remains unmeasured pending a designated test
recipient. Recipient-provider filtering, SMTP queues and SPF/DKIM/DMARC behavior
can affect arrival independently of the application response time. Do not claim
that connection pooling alone eliminates those delays.

Release tool: `scripts/mail-speed-release.mjs`. The VPS release directory stores
the verified image identifier, benchmark and private pre-restart runtime snapshot
under `/opt/fluentxverse/releases/mail-speed-20261031` for operator rollback.
