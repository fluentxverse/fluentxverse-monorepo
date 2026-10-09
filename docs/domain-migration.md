# Production domain migration

Target: `fluentxverse.com`. Keep the existing `.xyz` hosts as compatibility
aliases until the new hosts and social authentication pass production checks.
No database, booking, provider meeting or recording encryption key changes are
needed. Existing lesson content and saved links can contain `.xyz` asset URLs;
keep the old API serving them instead of redirecting all API requests.

## Routing

The currently running remotely managed Cloudflare tunnel is
`f005f637-8cbe-4fd2-b342-94debc7ecefb`. Preserve existing application routes
(including routes for other projects). Student/tutor hosting now uses Workers:

| Public hostname | Origin service |
| --- | --- |
| `student.fluentxverse.com` | Worker `fluentxverse-student` (custom domain attached) |
| `tutor.fluentxverse.com` | Worker `fluentxverse-tutor` (custom domain attached) |
| `dashboard.fluentxverse.com` | Worker `fluentxverse-dashboard`; new and old custom domains retained |
| `api.fluentxverse.com` | Tunnel to `http://localhost:8765`; DNS/HTTPS and health verified |
| `ws.fluentxverse.com` | Tunnel to `http://localhost:8767`; DNS/HTTPS and WebSocket handshake verified |

Adding tunnel routes in Cloudflare's dashboard also creates their DNS records.
For API-managed routing, create proxied CNAME records pointing to
`f005f637-8cbe-4fd2-b342-94debc7ecefb.cfargotunnel.com` and add the corresponding
ingress routes, before the final catch-all. Preserve existing DNS records rather
than overwriting conflicting records. Wait for the zone to be active and HTTPS
certificates to be ready before directing users to these URLs.

`fluentxverse-site` is the marketing website and links to the `.com` student/tutor
apps. It is now deployed through Workers static assets with custom domains
`fluentxverse.com` and `www.fluentxverse.com`. It does not use the local tunnel or
a marketing-site container. Vite port 3000 is only for local development.

Wrangler login was refreshed on 2026-10-09. It can deploy Workers, attach custom
domains and modify this tunnel; direct DNS reads/writes still return HTTP 403.
Both `.com` frontend custom domains are attached and publicly resolve through
Cloudflare DNS. API/WebSocket `.com` ingress entries were added in tunnel config
version 33 without replacing other entries. The user subsequently configured the
proxied `.com` DNS records and removed the old tunnel routes. Never expose
management tokens in frontend variables. Both `.xyz` frontend Worker routes are
active, but backend rollback and saved `.xyz` media URLs require restoring the old
API ingress. Docker frontends remain local.

References: [publish tunnel applications](https://developers.cloudflare.com/tunnel/get-started/)
and [tunnel DNS routing](https://developers.cloudflare.com/tunnel/concepts/routing/).

## Authentication and endpoints

All three app bundles choose production endpoints from the exact browser host:
`.com` apps use `api.fluentxverse.com` and `ws.fluentxverse.com`; `.xyz` apps use
their existing `.xyz` endpoints. This runtime choice overrides stale build
variables. Lookalike domains and unrecognized subdomains do not match.

Build defaults, example environment files and CI now use `.com`. Docker dashboard
builds use `FRONTEND_BUILD_API_URL`/`FRONTEND_BUILD_SOCKET_URL`, like the other
apps, rather than accidentally using server-side localhost Vite settings.

The API and socket server accept exact HTTPS origins for both domains. Student
mutations still require an allowed student origin, and QA deletion still requires
an administrator session plus an allowed dashboard origin. Session cookies
remain Secure, HttpOnly, SameSite=Lax and API-host-only. Leave `COOKIE_DOMAIN`
unset. Login/logout expires legacy shared-domain cookies for both domains;
browsers ignore expiration headers for an unrelated domain.

In Privy's dashboard, add `https://student.fluentxverse.com` to the existing app's
allowed origins, retaining `https://student.fluentxverse.xyz` during migration.
The public Privy configuration now contains both student origins. Google and X
are enabled; Apple must still be enabled in Privy.
Keep the same Privy app ID and provider configuration so existing users are
recognized. Check any custom Google/Apple/X OAuth or wallet return-domain
settings too; do not assume an app hostname is a provider callback URL.

Cookies and local storage cannot transfer across unrelated registrable domains.
Users must sign in once on `.com`; existing account and booking data stay intact.
Never pass session tokens in redirect URLs to transfer authentication.

Keep the running server's `API_PUBLIC_URL` on `.xyz` until the `.com` API is
reachable. Then set `API_PUBLIC_URL=https://api.fluentxverse.com` and
`ADMIN_DASHBOARD_PUBLIC_URL=https://dashboard.fluentxverse.com`, add both domains
to explicit `FRONTEND_URLS` settings, and restart only the application server.
Do not rotate JWT/Privy/recording secrets as part of this domain change.

## Cutover checks

- [x] Add dual-domain endpoint routing, CORS, student-origin restrictions and
  dashboard recording origin support.
- [x] Update production build defaults, CI and student canonical metadata.
- [x] Deploy student/tutor Workers, attach `.com` custom domains and move `.xyz`
  frontend routes to Workers without removing Docker/tunnel rollback.
- [x] Add `.com` API/WebSocket ingress routes to the running tunnel.
- [ ] Publish `.com` DNS/tunnel routes and verify HTTPS for every host.
- [ ] Add the new student origin in Privy and verify Google, Apple and X sign-in,
  reload, logout, a second tab and booking with real accounts.
- [ ] Verify tutor/admin login and logout, classroom refresh/reconnect, devices,
  lesson closure, recording consent and private administrator playback on `.com`.
- [x] Publish the marketing site to the apex and `www` hosts.
- [x] Change the running server's API/dashboard public URLs after DNS/HTTPS are verified.
- [ ] Only after the above checks pass, redirect old frontend pages to their
  corresponding new hosts while preserving paths and query strings. Do not
  redirect OAuth callbacks mid-login or interrupt active classrooms. Keep the
  old API/WebSocket hosts as aliases for saved assets and existing app sessions.

Rollback: remove frontend redirects and keep the `.xyz` routes. The same built
apps still choose `.xyz` endpoints on those hosts; no data rollback is necessary.
For frontend hosting rollback, remove just the student/tutor `.xyz` Worker routes
and their Wrangler entries; existing tunnel DNS and Docker services still work.

## Verification on 2026-10-09

Administrator Worker `fluentxverse-dashboard` is now deployed on
`dashboard.fluentxverse.com`, retaining its old `.xyz` custom domain. Normal-DNS
desktop/mobile tests passed login rendering, same-site API/CORS, rejection of
anonymous recording access and protected-page refresh. The server now uses the
explicit `.com` administrator URL and a dual-domain `FRONTEND_URLS` list. No
administrator accounts/passwords were changed; real-account workflows remain
part of the cutover checklist.

Marketing Worker `fluentxverse-site` is live on the apex and `www` domains. Its
typecheck/build and all four public browser viewport/domain checks passed without
a DNS override, including Home, About navigation/refresh, decoded images and the
student/tutor portal links. Static assets use the correct MIME types.

The `.com` API/WebSocket DNS and tunnel routes now pass health, student CORS and
WebSocket checks. The running server was recreated from its current image with
`API_PUBLIC_URL=https://api.fluentxverse.com`; media/recording flags stayed enabled.
A fresh Chrome session reached the API/login endpoint and initiated Google OAuth
without a DNS override. The login probe omitted credentials and returned the
expected 401; it does not establish that real Google sign-in completed.

Following the container compatibility update below, both student/tutor frontends
were deployed to Workers with `.com` custom domains and `.xyz` Worker routes.
Eight real public desktop/mobile rendering checks passed (the local `.com` DNS
cache required a frontend-only edge-IP override). Cloudflare RealtimeKit call
checks also passed on the active `.xyz` Workers with fixture identities. Backend
DNS, Privy old-origin restoration and real-account cutover checks remain pending.
See [Workers hosting](cloudflare-workers-frontends.md) for the current architecture.

The compatibility update is deployed to the student, tutor, dashboard and API
containers. Public `.xyz` pages and API health return HTTP 200. RealtimeKit and
consent-gated recording remain enabled; the running API public URL intentionally
remains `.xyz` until `.com` resolves. Database/storage containers were not rebuilt.

All four frontend builds passed. There were 99 passing focused unit/integration
tests: 69 server tests (including real PostgreSQL tests), nine cross-app endpoint
tests, and 21 media/session-refresh tests. Browser checks loaded the deployed
bundles under six simulated production origins and verified same-site API
selection, refresh and administrator WebSocket selection. Identity responses in
that test are fixtures, not evidence of real OAuth authentication.

Dashboard QA controls passed desktop/mobile checks. Both classroom apps passed
real Cloudflare audio/video, student reload, camera/microphone controls, device
selection and meeting closure with fixture account/signaling traffic. A deployed
server check accepted both exact student origins and rejected a lookalike origin.
Server secrets were absent from 319 scanned frontend HTML/JavaScript artifacts.

The full server build stalled in dependency resolution, so deployment reused the
existing running image's dependencies and overlaid only the changed server source
files. No new packages were required. Server/dashboard full typechecks still have
pre-existing unrelated errors; the marketing site's typecheck/build passed.

To rerun the domain browser check with the app containers running:

```sh
node tests/browser/domainMigration.cjs
```

Set `PLAYWRIGHT_MODULE` when Playwright is installed outside the repository.
For prebuilt frontend images, use `dist` as the build context, for example
`docker build -f Dockerfile.prebuilt -t fluentxverse-server-fluentxverse-student dist`
from the student directory. Never use the app source directory as that context.
