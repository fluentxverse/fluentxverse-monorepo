# FluentXVerse Cloud Backend

## Current deployment

The closed-internal-testing backend moved to `185.184.223.23` on 2026-10-23. This is the primary writer, not an active/active deployment. The desktop backend containers are stopped with Docker restart disabled, and its `cloudflared.service` is disabled. The local review prover remains separate and is not required for ordinary cloud requests.

The frontends remain on Cloudflare Workers. The existing FluentXVerse tunnel now runs on the cloud server, retaining these public hostnames:

| Hostname | Cloud origin |
| --- | --- |
| `api.fluentxverse.com` | `127.0.0.1:8765` |
| `ws.fluentxverse.com` | `127.0.0.1:8767` |
| `engine-api.fluentxverse.com` | `127.0.0.1:8090` |

The server has one exposed logical EPYC CPU, approximately 8 GB RAM, and an 80 GB root filesystem. It runs Fedora 44. No provider rebuild was needed. The hostname shown in the provider panel is not the SSH username.

The backend includes the existing API/Socket.IO image, GMR Engine, GMR Vault, three Memgraph databases, PostgreSQL, Redis, and three SeaweedFS services. Salary and compensation records remain in the application Memgraph database. Web3 and signing remain in Engine/Vault. RealtimeKit continues to carry lesson media.

Review tally proving stays disabled, as it was before migration. The desktop prover is retained, but a durable private cloud-to-desktop job queue has not been deployed. Do not claim offline-desktop jobs will automatically execute when it reconnects. Ordinary API/database/wallet services no longer require the desktop.

## Access and hardening

The deployment account is `fluentxverse-deploy`; root key access remains available for recovery. Docker-group membership is root-equivalent and must be treated as an administrative privilege, not a security sandbox.

The SSH identity was moved out of the checkout to `~/.ssh/fluentxverse-cloud/id_deploy` with mode `0600`. Its original one-line OpenSSH formatting was repaired, with the original retained privately. The obsolete source path is excluded from Git and the Go server Docker context. The path was not present in the checked Git history. A dedicated pinned known-hosts file is used; the initial host key was accepted on first connection, not independently verified through the provider console.

Example operator connection:

```sh
node scripts/cloud-shell.mjs
# Root maintenance over the same pinned, private connection:
node scripts/cloud-shell.mjs --root
```

Since 2026-10-24, public SSH is closed in both runtime and persistent firewalld rules. The public zone permits only WireGuard `51820/udp` and DHCPv6 client traffic. SSH is permitted on the separate `fxv-admin` zone attached to `wgfxv`. Password and keyboard-interactive SSH authentication remain disabled. Application/Engine host ports bind only to IPv4 loopback. Databases, Redis, Vault, and SeaweedFS have no published host ports. Other host listeners must still be evaluated against firewall rules; a listening socket is not proof of public reachability.

WireGuard starts at boot on both hosts. The server uses `10.78.24.1`, this operator workstation `.2`, and a preconfigured recovery peer `.3`. Only the server's private address is routed; this is not a default-route VPN. The private local marker `~/.ssh/fluentxverse-cloud/transport.json` directs all deployment helpers to the VPN address while retaining the pinned public-IP host-key alias. Do not delete it to attempt a public fallback.

See [origin-protection.md](origin-protection.md) for recovery, edge admission, limits, and upstream protection limitations.

Docker logs rotate, journald has a disk cap, service memory/PID limits are set, and SELinux remains enforcing. The container limits total 6496 MiB, leaving memory for the OS and daemon; these are ceilings, not reservations. Memory swap is disabled for the application containers. The OS's existing swap remains available to the host.

Security updates are downloaded automatically, but are not applied and the server is not automatically rebooted. Schedule reviewed updates and reboots. This is not unattended security patch installation.

## Runtime locations

| Path | Contents |
| --- | --- |
| `/opt/fluentxverse/releases/20261023/compose.private.json` | Live Compose configuration, including secrets; do not print or commit |
| `/opt/fluentxverse/releases/20261023/shared/` | Preserved Engine config, deployments, reviewed setup artifacts, SQL initialization bind |
| `/opt/fluentxverse/secrets/cloudflared.token` | Restricted tunnel token file |
| `/opt/fluentxverse/backups/migration-20261023/` | Encrypted migration backups and volume manifest |
| `/etc/systemd/system/fluentxverse-backend.service` | Boot-time backend startup with dependency health checks |
| `/etc/systemd/system/fluentxverse-tunnel.service` | Public connector, ordered after backend startup |

Persistent volume names start with `fxv-cloud-`. All 17 mounted data volumes were preserved, including the anonymous `/var/lib/memgraph` volumes that actually held Engine/Vault data. The original named `/var/opt/memgraph` mounts alone were not sufficient to recover those databases.

Do not run generic `docker compose down --volumes`, volume pruning, or provider rebuilds against this deployment.

## What was verified

- Transferred archive SHA-256 matched. All imported image filesystem layers and runtime image configuration matched the running desktop baseline. Docker classic and containerd stores expose different top-level IDs, so those IDs were recorded separately rather than treating a manifest conversion as an application rebuild.
- Local writers were stopped before cold backup. Each volume was archived with GNU tar, compressed, encrypted with age, authenticated by decryption, and restored to a fresh cloud volume. Encrypted transfer checksums matched.
- Node-label counts and relationship-type counts matched for all three Memgraph databases, and exact row counts matched for every public PostgreSQL table before cloud application workers started.
- The Engine cryptographically verified the installed self-operated screening setup on the new host. Self-operated assurance did not become an independent audit during migration.
- API dependencies, cloud service health, unauthenticated access rejection, app-specific CORS, Engine.IO polling, and an actual WebSocket transport handshake were checked.
- Student, tutor, and dashboard frontend HTTP checks passed. An existing profile image was readable from restored SeaweedFS storage.
- The cloud runtime no longer referenced desktop/host-gateway infrastructure URLs. The local API, Engine, Vault, and databases remain stopped with restart policy `no`.

No real Google OAuth session, authenticated lesson booking, live student/tutor call, recording round-trip, or successful review-tally proof was completed as part of this migration. Infrastructure health checks are not replacements for those workflows.

## Migration tools

These scripts are pinned to this release and operator host. They are not a general multi-tenant deployment platform.

```sh
node scripts/prepare-cloud-release.mjs --capture --images
node scripts/prepare-cloud-release.mjs --send
node scripts/prepare-cloud-release.mjs --verify-staged
node scripts/migrate-cloud-primary.mjs --cutover
node scripts/verify-cloud-primary.mjs
node --test scripts/tests/cloud-verification.test.mjs
```

Do not rerun capture or cutover against the existing state. The scripts deliberately stop rather than overwrite an earlier attempt. `activate-cloud-primary.mjs` can finish only a restored/fenced pre-activation checkpoint, not restart an already active migration.

The local private operator directory is `~/.local/state/fluentxverse/cloud-20261023/`. It contains runtime secrets, the source container snapshot, encrypted backups, and the **backup decryption identity** `backup-age.key`. That identity is not stored on the cloud server. Maintain another secure recovery copy outside both machines; losing it makes the encrypted backups unusable. The SSH private key is not a replacement for this separate age identity.

Sanitized deployment records are under ignored `output/cloud/20261023/`: inventory, image-content verification, source/cloud census, activation, and post-cutover verification. An earlier failed activation check is retained as diagnostic history. It was fixed and activation subsequently succeeded; the databases were not recopied or rolled back after cloud writers started.

## Host monitoring

The administrator dashboard has a `/server-health` page backed by `GET /admin/server-health`, restricted to the `operations` capability. The lightweight host collector is defined in [../host-metrics/README.md](../host-metrics/README.md) and runs as `fluentxverse-metrics.service`. It publishes CPU, RAM, root-disk, uptime, uplink addresses, interface byte totals and measured transfer speeds every five seconds. The API receives only a read-only directory mount at `/run/fluentxverse-metrics`; no Docker socket or host administration credentials are exposed.

The plan allowance is configuration, not measured billing usage. The provider's monthly bandwidth total and billing cycle are not connected; host interface counters are explicitly labeled separately and can reset. Missing or stale monitoring does not turn into zero-valued success metrics.

The **Stats** sidebar entry directly below Server Health opens `/stats`, backed by `GET /admin/container-stats` with the same operations permission. Its separate [container collector](../container-metrics/README.md) publishes container identity/state, CPU, Docker-compatible memory/limit, cumulative network and block I/O, and PID counts every five seconds. Only the host collector can reach Docker; the API has a second read-only snapshot directory, not the Docker socket. Desktop-only containers are not included. See `node scripts/verify-container-stats.mjs` for public authorization/CORS checks, a continuing-collector check, and comparison with live Docker CLI memory readings. The collector account's Docker-group access is root-equivalent and must be protected accordingly.

The monitoring release uses a scoped API overlay on the migrated image, preserving the private Compose configuration except its API image and metrics directory bind. Its dashboard snapshot builds on the existing deployed dashboard, not the unrelated dirty worktree. Preparation and deployment records are under ignored `output/release/server-health-20261023/`. Use `node scripts/verify-server-health.mjs` for a read-only authorization, cache, CORS, read-only mount and continuing-collector check. The verifier uses a short-lived in-memory test token for an existing authorized administrator; it does not log credentials or modify accounts.

Before deployment the script checks for active classroom transports. API failure restores the previous private Compose file and image. Prior configuration snapshots named `compose.private.json.pre-server-health*` contain secrets and must remain private. To remove monitoring, deploy the old API configuration with the same active-lesson precautions, then disable the host collector; do not restore database volumes or restart stale desktop services.

## Recovery and two-server policy

The cloud is the only authoritative writer. The desktop's old databases are stale recovery material, not a live synchronized replica. Its default Compose files and old deployment scripts must not be used with retained production credentials/data. For development, provision a separate project, database volumes, and test-only credentials.

Do not start the desktop backend or its tunnel as a quick fallback after cloud writes have occurred. First fence cloud writers and obtain a current consistent cloud backup. Restore all required data, keys, and configuration to the replacement host, reconcile pending financial/chain operations, verify it privately, then move the public connector. Never leave two independent Engine/Vault transaction workers active.

Before restoring any age archive, verify authenticated decryption succeeds. Restore only into fresh, empty volumes while consumers are stopped. Preserve numeric ownership and use GNU tar for the sparse archive format. Compare all database counts and validate the actual encryption/signing configuration before accepting traffic. Do not print decrypted wallet records or keys.

The one-time migration recovery set exists both locally and on cloud, and the cloud restore was exercised successfully. **Recurring backups, automatic off-server transfer, backup-age alerts, and automatic failover are not configured yet.** The independent Cloudflare watchdog and administrator Alerts page are documented in [../alerts/README.md](../alerts/README.md); external email/SMS/chat delivery is not configured. A provider snapshot alone is not an adequate recovery strategy. Establish a recurring, consistency-preserving backup schedule before expanding testing or storing irreplaceable records.

## Internal test checklist

- Student Google login, logout, refresh, and booking in a second tab.
- Tutor and dashboard login/logout; verify existing roles and permissions.
- Booking race, cancellation/refund idempotency, and compensation exclusion for refunded lessons.
- A real RealtimeKit lesson on separate networks, refresh/reconnect/device controls, and closure.
- Recording notice, server recording status, upload/download, restricted playback, and access logs.
- Screening issuance and local proving under the verified release; authorize any paid network submission separately.
- Repeat the test with the desktop disconnected. Do not infer a queued desktop proof worker exists.
- Restore another fresh environment from a newer cloud backup and test boot-time service recovery.

This migration retains existing application authentication and signup behavior. Calling the deployment internal testing does not itself implement an invite-only account allowlist or Cloudflare Access gate. Add explicit tester restrictions before sharing the applications beyond the intended team, and rotate previously exposed credentials before broader rollout.
