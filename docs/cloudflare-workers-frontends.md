# Cloudflare Workers Frontend Deployment

The student, tutor and administrator apps are Vite single-page applications configured for Cloudflare Workers static asset hosting.

## Live Hosting (2026-10-11)

| App | Worker | Production hosts |
| --- | --- | --- |
| Student | `fluentxverse-student` | `student.fluentxverse.xyz`, `student.fluentxverse.com` |
| Tutor | `fluentxverse-tutor` | `tutor.fluentxverse.xyz`, `tutor.fluentxverse.com` |
| Administrator | `fluentxverse-dashboard` | `dashboard.fluentxverse.xyz`, `dashboard.fluentxverse.com` |

Both `.xyz` hosts now use Worker routes over their existing tunnel DNS records.
Update at the 2026-10-11 SolidJS cutover: student and tutor `.xyz` DNS records
are absent (authoritative Cloudflare DNS returns NXDOMAIN). Their historical
Worker routes are retained but are not reachable until DNS is restored. The
`.com` custom domains are the verified live frontends. No DNS records were
created or removed during this cutover.
The administrator `.xyz` host uses an existing Worker custom domain, retained
alongside its new `.com` custom domain. Old backend tunnel routes were removed
by the user, so keeping old frontend hosting alone does not restore old API access.
The `.com` hosts are Workers custom domains; Cloudflare created their DNS and
HTTPS certificates. Local resolvers can briefly retain earlier negative answers.
The API, Socket.IO server, database and Seaweed recordings remain local; this is
a frontend-only migration. No server secrets are bundled into these Workers.

The `.com` API/WebSocket tunnel routes and proxied DNS records are now configured.
API health, student-origin CORS and the WebSocket handshake passed. The running
server now uses `API_PUBLIC_URL=https://api.fluentxverse.com`. Some clients still
cache earlier NXDOMAIN replies; this is separate from OAuth authentication.

Privy's public configuration includes both student `.com` and `.xyz` origins.
Google and X are enabled; Apple currently requires enabling in Privy. Real
Google/Apple/X sign-in and production booking still need account-level verification.
The user removed the old tunnel routes, so `.xyz` backend compatibility is no
longer guaranteed; restore old API ingress for previously saved media links.

Asset-only previews (not allowlisted production authentication origins):

- `https://fluentxverse-student.paulanthonyarriola.workers.dev`
- `https://fluentxverse-tutor.paulanthonyarriola.workers.dev`

## Student App

As of 2026-10-11, both student and tutor deployments use native SolidJS. The
Preact working trees are preserved under `archive/preact/`, excluded from active
workspaces, root commands, CI, and Docker builds. Existing API cookies, accounts
and backend services are unchanged; no local test API is deployed.

Directory:

```bash
fluentxverse-student-solid-prototype
```

Cloudflare settings:

```text
Install command: npm ci --workspaces=false --ignore-scripts
Build command: npm run build
Deploy command: npx wrangler@4.149.0 deploy
Output directory: dist
Wrangler config: wrangler.jsonc
Node version: 24.10.0
```

Deploy from the app directory:

```bash
npm run cf:deploy
```

Required build variables:

```text
VITE_STUDENT_API_URL=https://api.fluentxverse.com
VITE_STUDENT_SOCKET_URL=https://ws.fluentxverse.com
VITE_PRIVY_APP_ID=<existing public Privy app ID>
VITE_TICKET_CHAIN_ID=84532
VITE_TICKET_CONTRACT_ADDRESS=<Base Sepolia ticket contract, currently unset>
VITE_TICKET_RPC_URL=https://sepolia.base.org
VITE_VAULT_WALLET_ADDRESS=<vault wallet>
```

Public production values are tracked in the Solid project's `.env.production`.
The production entry point excludes the compatibility lab. Run
`npm run test:production` for real desktop/mobile hosting, API/CORS, Privy
initialization and Google OAuth initiation checks. These do not complete a real
account sign-in or validate actual booking, payment or video calls.

Cloudflare Git builds must use the Solid project directory above after its source
is committed and pushed. Local deployment alone does not update GitHub or remote
build settings.

Solid deployment verification (2026-10-11):

- Live version: `7147d17b-211e-456e-86d8-f4e7cf8d7a27`.
- Previous SolidJS version: `3b416b99-a7b0-436d-a769-1e9370790e74`.
- Previous Preact version: `16d69712-a57d-4d84-b2d9-0b8662b3a074`.
- Build/typecheck, 36 unit tests, Wrangler dry run and server-secret bundle scan
  passed. Dashboard, tutor browsing/booking, schedule, classroom-feedback and
  carousel browser suites passed against the built frontend with fixture APIs.
- Real production desktop/mobile probes passed for SolidJS identity, assets/MIME,
  API/CORS, anonymous session rejection, Privy initialization and deep-link
  refresh. Google OAuth initiation reached Google's authorization page.
- Completed account login, live booking and actual video calls were not tested
  by these deployment probes. No production student data was modified.

Rollback from the Solid project directory, only if required:

```sh
bunx wrangler@4.149.0 rollback 16d69712-a57d-4d84-b2d9-0b8662b3a074 --message "Restore previous Preact student frontend"
```

## Tutor App

Directory:

```bash
fluentxverse-tutor-solid-prototype
```

Cloudflare settings:

```text
Install command: npm ci --workspaces=false
Build command: npm run build
Deploy command: npx wrangler@4.149.0 deploy
Output directory: dist
Wrangler config: wrangler.jsonc
Node version: 24.10.0
```

Deploy from the app directory:

```bash
npm run cf:deploy
```

Required build variables:

```text
VITE_TUTOR_API_URL=https://api.fluentxverse.com
VITE_TUTOR_SOCKET_URL=https://ws.fluentxverse.com
VITE_ENABLE_NOTIFICATION_SOCKET=true
```

SolidJS tutor version: `70369a11-cd43-480f-9888-5e436858a46d`.
Initial SolidJS version: `da57586d-c18a-4d48-86de-432e0a6e0bb7`.
The session-restoration hotfix accepts the legacy role-less `/tutor/me`
response (the endpoint already validates tutor cookies) while rejecting an
explicit non-tutor role. Regression fixtures now match that server contract
and cover material-library navigation and page refresh.
Previous Preact version: `a1588c9c-9298-48de-a086-6d512ba09c92`.
Build/typecheck, 82 unit tests, Wrangler dry run, server-secret scan, and built
desktop/mobile public-page/login probes passed. Existing fixture suites cover
authentication/certification, booking links, schedules, reporting, recording
consent, PDF rendering and lesson-note/attendance transitions. Live probes use
anonymous sessions only; completed account login and actual calls remain pilot
checks. No production student/tutor account data was changed by this cutover.
Live `.com` desktop/mobile probes also passed for both apps: native SolidJS
identity, assets/MIME, API/CORS, anonymous-session rejection, public light mode,
login fields, and deep-link refresh. Student Privy initialization and Google
OAuth initiation passed; OAuth was not completed as a real account.

Emergency rollback from the tutor SolidJS directory:

```sh
bunx wrangler@4.149.0 rollback a1588c9c-9298-48de-a086-6d512ba09c92 --message "Restore previous Preact tutor frontend"
```

Root `deploy:student` and `deploy:tutor` commands and GitHub Actions now target
SolidJS. Actions deployment requires the repository's `CLOUDFLARE_API_TOKEN`
secret. These local source changes have not been committed or pushed by this
deployment. Cloudflare dashboard Git build configuration could not be inspected
or updated: the available OAuth token receives Builds API 403. If dashboard Git
builds are configured, set their roots to the two SolidJS project directories
before the next remote build; do not point them at `archive/preact/`.

## Notes

Administrator deployments run `bun run deploy` in `fluentxverse-dashboard`.
Its Wrangler config keeps both dashboard domains; its `.com` bundle selects
`api.fluentxverse.com` and `ws.fluentxverse.com` at runtime. The server's explicit
`ADMIN_DASHBOARD_PUBLIC_URL` is now `https://dashboard.fluentxverse.com`, and
`FRONTEND_URLS` includes both domains. Database, roles and administrator passwords
are unchanged. Users must sign in once on the new domain; cookies are not copied
between `.xyz` and `.com`.

The deployed dashboard passed desktop/mobile login rendering, real `.com` API
CORS, expected anonymous-session and missing-credentials rejection, private
recording access rejection and deep-link refresh without a DNS override:

```sh
node tests/browser/dashboardHosting.cjs
```

This probe does not log in as an administrator or prove a real account's login,
logout or recording playback workflow. Set `PLAYWRIGHT_MODULE` as needed.

- Both `wrangler.jsonc` files use `not_found_handling: "single-page-application"` so browser refreshes on nested routes work.
- Do not add `/* /index.html 200` to `_redirects`: it rewrites existing JavaScript/images too. Wrangler provides the SPA fallback.
- `VITE_*` values are public build-time variables. Never include the Privy secret, Cloudflare API tokens or recording keys. Production API/socket endpoints are selected from the exact browser hostname, so `.xyz` retains its existing backend.
- Keep the API and WebSocket services deployed separately. These frontend Workers only serve static assets.
- Vite 8 requires Node `20.19+` or `22.12+`. Both apps include `.node-version` and `.nvmrc` set to `24.10.0`.

## Verification and Rollback

Both builds, Wrangler dry runs and server-secret bundle scans passed. Public
`.xyz` Workers served app JavaScript/core images with the correct content types and deep
classroom links with HTTP 200. Actual Cloudflare RealtimeKit audio/video, student
refresh, camera/microphone selections and server-controlled lesson closure passed
on workers.dev and `.xyz`, with fixture identities and fake browser devices.
This does not replace the real-account, separate-network/mobile-data pilot.

All eight desktop/mobile checks passed across the two apps and two domains.
The `.com` browser run used an edge-IP DNS override because the local resolver
still cached NXDOMAIN; Google and Cloudflare public DNS already returned the
frontend addresses, and HTTPS certificate verification succeeded. The `.com`
backend was NXDOMAIN during that initial run, so those were rendering/routing
checks, not auth checks. After DNS setup and the server public-URL switch, fresh
Chrome reached API health (200), anonymous session/login endpoints (expected 401)
and Google OAuth without any DNS override. The redeployed student HTML no longer
references missing stylesheets; all 47 observed stylesheet responses were CSS and
there were no MIME rejections or API DNS failures. Actual account login is pending.

Public desktop/mobile hosting checks (no mocked API or account responses):

```sh
node tests/browser/workersHosting.cjs
# Once all .com DNS is available:
WORKERS_TEST_DOMAINS=fluentxverse.xyz,fluentxverse.com node tests/browser/workersHosting.cjs
```

Set `PLAYWRIGHT_MODULE` if Playwright is installed outside the repository.
The test reports four pre-existing missing tutor demo images separately; they
belong to the unused offcanvas markup outside the application root. It fails on
other missing assets, incorrect JavaScript/image content types and app errors.
If a local resolver still caches earlier negative frontend answers, the optional
`WORKERS_DNS_IP` can target the currently published Cloudflare edge IP while
preserving HTTPS hostname verification. That run is not DNS propagation proof.

Docker frontends and their tunnel ingress entries remain available. To roll an
old `.xyz` host back to Docker, remove only its student/tutor Worker route from
Cloudflare and the matching Wrangler config before redeploying. Keep its existing
DNS CNAME and tunnel route. Do not remove unrelated Workers or tunnel entries.
