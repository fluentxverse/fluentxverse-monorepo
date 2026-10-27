# Origin Protection

## Network boundary

The API, Socket.IO, and Engine ports are bound to loopback and reached through Cloudflare Tunnel. Databases, object storage, and Vault have no public host-port mappings. Both IPv4 and IPv6 are covered by the host firewall; a firewall does not prevent saturation of the provider's uplink.

Administrative SSH uses WireGuard, not a publicly reachable SSH port. The cloud public zone permits UDP 51820 and DHCPv6-client; SSH is allowed only on `wgfxv` in `fxv-admin`. A timed rollback was armed during the change and cancelled after fresh private deploy/root SSH checks succeeded. The private tunnel and firewall persist across boot; a reboot has not been performed as a test.

### Operator and recovery access

Use `node scripts/cloud-shell.mjs` or add `--root`. The shared deployment helper reads the private local transport marker, uses `10.78.24.1`, and verifies the original pinned server host key. Both machines run `wg-quick@wgfxv`.

Private local material:

- `~/.ssh/fluentxverse-cloud/id_deploy`: SSH key.
- `~/.ssh/fluentxverse-cloud/known_hosts`: pinned server key.
- `~/.ssh/fluentxverse-cloud/transport.json`: private-address transport configuration.
- `/etc/wireguard/wgfxv.conf`: workstation WireGuard configuration, root-only.
- `~/.ssh/fluentxverse-cloud/wireguard-recovery.conf`: separately keyed recovery peer configuration.
- `~/.local/state/fluentxverse/private-access-20261024/`: provisioning keys and configuration. Treat the entire directory as secret.

Keep an encrypted recovery copy outside both machines. On a replacement Linux operator machine, securely install the recovery configuration as `/etc/wireguard/wgfxv.conf` with mode 0600, install WireGuard, then enable `wg-quick@wgfxv`. Use the original SSH identity, pinned known-hosts, and private transport marker. Do not use the long recovery filename as a Linux interface name. The recovery peer is configured server-side but has not been independently live-tested.

If VPN access fails, use the provider's out-of-band console. Check `wg show wgfxv`, `systemctl status wg-quick@wgfxv`, the public UDP rule, the `fxv-admin` SSH service rule, and the workstation's actual endpoint reachability. Do not flush firewalld, expose database ports, or restart stale desktop application writers. An emergency public SSH reopening must be temporary and restricted to a known operator IP; close it after repairing private access.

## Request admission

The API release applies protection before Elysia body parsing. Counters use atomic Redis Lua scripts, keyed by HMAC commitments rather than raw user IDs or client addresses. This change does not migrate the application's separate legacy in-memory cache or token-revocation store to Redis.

`shared/requestDefense.ts` is the canonical endpoint policy. It defines separate authentication, search, AI, assessment, proof, and upload rates/body caps. Account identities must come from verified JWTs, not submitted form values. Existing route authorization remains authoritative. Anonymous proof intake does not acquire an identifying account requirement.

When app cookies coexist, admission selects a valid session with the required role and cookie name. An administrator session does not mask a tutor session. Routes that explicitly call `request.formData()` disable automatic Elysia parsing, so the bounded body is consumed once; this covers tutor media, interview recordings, and lesson material uploads.

Origin controls include a 48-request ceiling, one concurrent upload, one proof request, two AI requests, two assessment requests, two anonymous proof requests, and a 128 MiB aggregate buffered-body budget. Real streamed byte counts are checked even without Content-Length. Bodies time out after 20 seconds, or 180 seconds for large uploads. An origin Redis failure returns a retryable 503, not an unlimited in-memory fallback. Private health checks and CORS preflight remain available. These limits bound request handling, not background jobs that a handler might enqueue; background workers still require their own queue/capacity controls.

Cloudflare's `CF-Connecting-IP` is trusted only because public application ports are unreachable and the connector is local. Submitted X-Forwarded-For and X-Real-IP are overwritten. Do not publish these ports or enable this trust setting on an origin accepting arbitrary direct clients.

### Edge worker

`infra/edge-guard` routes only authentication and expensive operation paths. Ordinary lesson APIs and Socket.IO are not routed through this Worker. It rejects oversized declared bodies, missing authentication cookies for private operations, and category/network bursts before origin forwarding. Cookie names are only an early filter; the origin verifies signatures and permissions.

Native Workers rate-limit bindings are per-location, approximate controls, not a globally exact quota. Atomic origin Redis limits supply shared enforcement. A private edge/origin marker prevents direct tunnel-hostname bypass of protected mutations after enforcement is enabled. Neither the marker nor JWTs are logged in deployment reports. The marker is held in a Worker secret and private Compose environment, never public frontend builds.

Workers plan entitlement, daily request quotas, and account-level spending controls must be checked in the Cloudflare dashboard. Quota exhaustion can make these protected operations unavailable. It must not silently disable origin checks. This does not purchase or claim a paid/unlimited plan.

### Deployment and rollback

The scripts are release-specific, preserving the running API image, secrets, volumes, Engine, and unrelated worktree changes:

```sh
node scripts/prepare-request-defense-release.mjs
node scripts/deploy-request-defense.mjs --origin
node scripts/deploy-request-defense.mjs --edge
node scripts/deploy-request-defense.mjs --enforce
node scripts/verify-request-defense.mjs
```

Preparation is only for a pre-defense baseline; do not blindly rerun it after activation. Each API restart checks for active classroom transports. Keep private `compose.private.json.pre-request-defense-*` and `.pre-edge-enforcement-*` snapshots restricted: they contain secrets. To roll back, restore the appropriate private Compose snapshot and start only `api` with `--no-deps --wait`, after the same classroom check. If removing Worker routes, first disable origin edge enforcement; otherwise protected requests correctly fail closed. Never restore database volumes for a code rollback.

The 2026-10-24 rollout also used explicitly pinned follow-up overlays for policy coverage, manual multipart parsing, and mixed-session selection. Sanitized manifests and the latest verification report are in ignored `output/release/request-defense-20261024/`. The source preparer permits a limited set of named baselines with `--refresh-current`; it is not a generic unattended deployer.

The tests exercise concurrent atomic Redis counters, expiry, bounded state, streamed body caps, slow bodies, failed authentication, capacity release, role selection, multipart compatibility, edge failures, and monitoring permissions. Live probes check protected endpoint validation/CORS, missing and wrong origin markers, private SSH, public IPv4 SSH refusal, and cloud health/WebSocket transport. No volumetric attack, real Google OAuth login, or live student/tutor media lesson is performed by this verification.

## Upstream provider gap

RIPE's IP registry identifies this block as GreenCloud infrastructure. This does not establish the contractual DDoS protection of the purchased plan. GreenCloud's published terms permit null-routing or suspension when attacks affect the network, and its SLA excludes DDoS events. No plan-specific scrubbing capacity, PPS/Gbps threshold, IPv6 coverage, or null-route duration has been confirmed. No support ticket or paid upgrade has been submitted by these scripts.

Public-plan research on 2026-10-24 found `EPYCVDSJPSB-1` matching the operator-supplied specifications, but its listing does not specify DDoS coverage. Matching specifications are not verification of the purchased service or protection entitlement. The Technical Support ticket flow requires account login, and no authenticated provider session is available to this agent. The [prepared coverage inquiry](greencloud-ddos-request.md) records the evidence, precise questions, and completion criteria; it has not been submitted.

Ask provider support to confirm in writing for `185.184.223.23` and its assigned IPv6 prefix:

1. Is always-on upstream scrubbing included at this Tokyo SoftBank location?
2. Which L3/L4 attack types are mitigated, and what clean/attack PPS and Gbps thresholds apply?
3. Is protection equivalent for IPv4 and IPv6, including the WireGuard UDP endpoint?
4. When is an IP null-routed, for how long, and can legitimate access be restored through a protected address?
5. Are notifications, emergency support, or mitigation upgrades available, and what do they cost?

References: [RIPE address record](https://rdap.db.ripe.net/ip/185.184.223.23), [provider terms](https://cdn.greencloudvps.com/terms-of-service.php), [provider SLA](https://cdn.greencloudvps.com/service-level-agreement.php), [Cloudflare rate-limit semantics](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Host firewalls and request controls cannot solve an upstream bandwidth flood. Do not describe this deployment as DDoS-proof. Testing uses bounded isolated counters and harmless API probes, not an attack against the public service.
