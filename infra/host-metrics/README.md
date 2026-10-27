# Host Metrics

A Linux host collector for the administrator Server Health page. It runs outside Docker so the page reports the VPS, not its API container. There is no HTTP listener or Docker socket access. The API reads a bounded, schema-checked, read-only JSON snapshot and requires the `operations` administrator capability. Responses are private and non-cacheable.

## Measurements

- CPU: deltas of aggregate `/proc/stat` counters, excluding already-counted guest time; idle includes I/O wait. First sample has no utilization value.
- RAM: `MemTotal - MemAvailable`; reclaimable cache is not all counted as used memory.
- Disk: root filesystem `statfs`; available space excludes filesystem reservations and can be smaller than total minus used.
- Network: `ens3` only, not loopback or Docker bridges. Interface RX/TX counters and monotonic-time delta speeds. Counter resets invalidate that interval's speed. Totals can reset after reboot or interface replacement; they are not monthly provider billing totals.
- Allowance: configured 2048 GiB plan metadata. Provider billing integration is not connected. No billing-cycle percentage, remaining allowance or provider-measured monthly usage is inferred from interface counters.
- Staleness: samples older than 30 seconds are labeled stale. Missing or invalid snapshots return a sanitized 503. No fabricated zero metrics.

## Build And Test

```sh
go test ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o host-metrics .
```

Install the binary as `/usr/local/bin/fluentxverse-host-metrics`, create a locked system user `fluentxverse-metrics`, and install `../cloud/fluentxverse-metrics.service`. The service owns `/var/lib/fluentxverse-metrics`, samples every five seconds, and has a 32 MiB memory limit and 2% CPU quota. It opens no ports. `IPAddressDeny=any` blocks IP traffic; local netlink interface inspection remains available.

Bind the **directory** `/var/lib/fluentxverse-metrics` into the API at `/run/fluentxverse-metrics` read-only, with the appropriate SELinux container label. Directory binding is required because each snapshot is atomically replaced. API path can be overridden with `HOST_METRICS_FILE`, never by a browser parameter.

The page is `/server-health`; its API is `GET /admin/server-health`. No root, SSH, Cloudflare, database, wallet or provider credentials are included in snapshots. This feature does not implement monitoring alerts, provider billing, automated failover, or backups.
