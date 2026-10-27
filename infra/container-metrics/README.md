# Docker Container Statistics

A separate host service publishes sanitized Docker resource readings for the administrator Stats page at `/stats`, immediately below Server Health. The API reads an atomically replaced JSON snapshot over a read-only directory mount. It has no Docker socket, SSH key, or daemon proxy. `GET /admin/container-stats` requires the `operations` capability and sends `private, no-store`.

## Measurements

- Container ID, name, state, and Docker status text. No commands, labels, environment, logs, mount paths, or credentials are published.
- CPU percentage follows Docker's aggregate CPU/system deltas multiplied by online CPUs. Multicore values can exceed 100%. First observations and reset counters have no CPU percentage.
- Memory subtracts `inactive_file` on cgroup v2, or `total_inactive_file` on v1, matching modern Docker CLI memory reporting. The denominator is the container's effective memory limit, not necessarily host RAM.
- Network received/sent and block read/written totals are cumulative container counters, not transfer speeds or provider billing. Network traffic across containers is not summed as unique host traffic.
- PIDs includes processes and kernel threads, not only distinct application processes.
- Stopped containers have unavailable metrics, not fabricated zero usage. Per-container sampling failure is partial data. A daemon listing failure retains the prior snapshot, which becomes stale after 30 seconds.

Reference semantics: [Docker stats](https://docs.docker.com/reference/cli/docker/container/stats/), [Engine stats API](https://docs.docker.com/reference/api/engine/version/v1.51/#tag/Container/operation/ContainerStats). The fixed v1.51 protocol is supported by the current v1.56 server; compatibility must be checked when moving hosts.

## Security And Operations

The collector runs as the locked `fluentxverse-container-metrics` account with a systemd-only supplementary Docker group, local Unix sockets only, no IP access, no capabilities, strict filesystem protection, 64 MiB memory cap, and 5% CPU quota. **Docker group access remains root-equivalent**; these restrictions do not turn Docker's socket into a read-only permission boundary. Keep this executable/configuration root-owned. The program issues only fixed list/statistics GET requests with validated full container IDs, bounded JSON responses, four concurrent requests, and timeouts. It exposes no HTTP service or browser-triggered commands.

Snapshots are published to `/var/lib/fluentxverse-container-metrics/container-metrics.json`; bind that directory to `/run/fluentxverse-container-metrics` in the API read-only, with a shared SELinux container label. API path can be configured with `CONTAINER_METRICS_FILE`, not by request parameters. The dashboard reports only this primary cloud host; desktop-only containers are not connected.

```sh
go test -race ./...
go vet ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o container-metrics .
```

Install `/usr/local/bin/fluentxverse-container-metrics` and `../cloud/fluentxverse-container-metrics.service`. The collector samples every five seconds independently of page visits; frontend refresh/pause/search/sort are read-only. Deployment checks active lesson transports before an API restart and preserves the prior runtime configuration for rollback. This page does not add container lifecycle controls or aggregate desktop metrics.
