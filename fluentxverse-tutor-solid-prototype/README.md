# Tutor App in SolidJS

Native SolidJS tutor frontend, now the deployment source for the existing
`fluentxverse-tutor` Cloudflare Worker. The Preact working tree is archived in
`../archive/preact/fluentxverse-tutor`. The historical project folder suffix is
retained; backend services, production domains, cookies and account data are unchanged.

## Production Deployment

```sh
npm ci --workspaces=false
npm run cf:deploy
npm run test:production
```

Public domains always select `https://api.fluentxverse.com` and
`https://ws.fluentxverse.com`, including legacy `.xyz` frontend hosts. Production
cannot inherit a local API override. `.env.production` contains public settings
only. Workers serves static assets; the local compatibility API is not deployed.

Cloudflare Git builds must use this project directory, Node 24.10.0,
`npm ci --workspaces=false`, `npm run build`, and `npx wrangler@4.149.0 deploy`.
The root `deploy:tutor` command delegates here. GitHub Actions is updated to build
and deploy SolidJS when `CLOUDFLARE_API_TOKEN` is configured. Cloudflare-managed
Git build settings could not be inspected with the current token (Builds API
403); verify their project roots in the dashboard before a remote rebuild.

## Run

```sh
npm install
npm run dev:api
npm run dev
```

Open **http://127.0.0.1:5177**. The local tutor API runs at **http://127.0.0.1:8782**. Existing tutor email/password credentials work with its separate `fxvSolidTutorAuth` cookie and ephemeral signing keys. Restarting the API requires signing in again.

The API permits authentication and selected reads against the local database. It intentionally blocks application writes, registration, AI generation, proof issuance, and live classroom signaling. Browser compatibility tests intercept requests and socket messages instead of modifying real accounts or schedules. No attendance jobs or migrations run in this harness.

Local development retains isolated defaults. Explicit `VITE_TUTOR_API_URL` and
`VITE_TUTOR_SOCKET_URL` overrides apply only outside the known production hosts.

## Verification

```sh
npm run typecheck
npm run build
npm test
npm run test:browser
node tests/browser.cjs authFlows multiMaterialNotes pdf
```

Browser tests need `/usr/bin/google-chrome`. Cross-app reporting and scheduling checks also expect the Solid student app at `http://127.0.0.1:5176`. Screenshots are written to `../output/screenshots` or ignored `test-results`.

Verified during migration: 78 unit tests; desktop/mobile light/dark page and dialog checks; public-page theme isolation; authentication and certification guards; scheduling restrictions; notification lesson links; reporting and recording consent; multi-material note editing, draft recovery, retries, read-only deadlines, and attendance changes; PDF canvas pixels, text layer, matching worker, and toolbar controls. Browser workflow tests use fixtures, not production writes.

## Migration

- Preserves all 31 routes, tutor navigation, public light-only pages, artwork, styles, and existing API contracts.
- Native Solid signals, effects, contexts, router, Lucide icons, notification store, and modal portals. No React, Preact, Zustand, or Wouter runtime.
- Certification/auth guards forward dynamic route parameters; metrics links use router query/hash state.
- Native dialogs preserve focus, nested scroll locks, Escape dismissal, and busy states.
- Lesson-note state and queued saves use data snapshots. Editable note rows use `Index` to retain input focus and expanded editors.
- PDF worker is bundled from the installed PDF.js package rather than the outdated copied public worker.

`scripts/port-tutor.mjs` is a one-time conversion aid, not a normal build command. Do not rerun it over the refined source. The normalization, snapshot, and row scripts are migration records, not recurring tasks. `copy-tests.mjs` likewise overwrites adapted tests and should not be rerun without reviewing their Solid-specific changes.

## Integration Follow-Up

The static frontend is deployed. Production probes verify anonymous sessions,
API/CORS, login fields, assets and public-page deep links without writing account
data. They do not complete real tutor login or verify real two-party
WebRTC/RealtimeKit calls, reconnection, uploads, exam generation/transcription,
interview booking, notes submission or attendance writes. Those workflows still
need real-account testing and isolated write integration tests.

The build currently preserves eager page loading and emits large-chunk warnings. Route-level code splitting and a production bundle budget remain optimization work before rollout.

PDF.js is upgraded to 6.4.299, with its matching bundled worker. The dependency audit has no high or critical findings. RealtimeKit 2.0.2 still inherits a moderate UUID advisory; resolve it with an SDK-compatible update and live-call testing before production. Do not run a forced audit downgrade of RealtimeKit.
