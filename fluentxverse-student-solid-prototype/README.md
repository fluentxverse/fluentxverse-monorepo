# Student App in SolidJS

Independent recreation of the student frontend using native Solid signals,
contexts, portals, and Solid Router. It includes the existing pages, modals, custom
bitmap artwork, light/dark themes, Three.js carousel, lesson renderers, PDF viewer,
and classroom UI. There is no React, Preact, or Zustand runtime in this project.

This project is the student frontend deployment source for the existing
`fluentxverse-student` Cloudflare Worker. The Preact source is archived in
`../archive/preact/fluentxverse-student`. Both frontends now deploy from SolidJS;
backend deployments and existing account data are unchanged.

## Production Deployment

```bash
cd fluentxverse-student-solid-prototype
npm ci --workspaces=false --ignore-scripts
npm run cf:deploy
npm run test:production
```

Production uses `https://student.fluentxverse.com`, the existing production
student cookie, and the `.com` API/WebSocket tunnels. `.env.production` contains
only public frontend settings. Known production hosts cannot select the local
API harness even if a local endpoint is accidentally supplied at build time.
The compatibility workspace is available only in development.

For Cloudflare Git builds, select this directory as the root, install with
`npm ci --workspaces=false --ignore-scripts`, build with `npm run build`, and
deploy with `npx wrangler@4.149.0 deploy`. Do not rebuild the old Preact directory
for this Worker. The root `deploy:student` command delegates here.

Production hosting checks do not complete an account login, make bookings, or
place live calls. The integration gates below still require real-account tests.

## Run

```bash
cd fluentxverse-student-solid-prototype
npm ci --workspaces=false --ignore-scripts
npm run dev
# In a second terminal (Bun and monorepo backend dependencies required):
npm run dev:student-api
```

Open **http://127.0.0.1:5176/** for the public homepage or
**http://127.0.0.1:5176/home** for the signed-in dashboard. Protected pages require
a student session. Use this exact host and a separate browser profile for manual
integration tests. Do not use a funded wallet for testing.

### Application API

The local application harness is **http://127.0.0.1:8780**. It imports existing
student API handlers without starting the main server, migrations, attendance
jobs, or reminder jobs. It permits student-facing reads and authentication by
default. Registration, profile changes, bookings, cancellations, surveys, reports,
notification mutations, and ticket operations are blocked by default.

It uses its own `fxvSolidStudentAuth` cookie and random JWT signing keys. It does
not accept or overwrite the original `studentAuth` cookie or the compatibility
lab's `fxvSolidLabAuth`. Restarting the API expires its sessions. Only
`http://127.0.0.1:5176` is approved; public lesson media also supports normal
image/iframe requests without an Origin header.

The local dashboard lesson renderer on port 5175 may also read public lesson
files, with non-credentialed CORS. It cannot call student authentication or
protected data endpoints through that exception. Published lesson views still
require the existing dashboard renderer and media storage to be running.

The default database connections use existing local Memgraph and PostgreSQL.
This is not a database clone or reset. Authentication can update normal login
metadata or link Privy identity metadata to an existing student. The harness
blocks student data mutation endpoints; it does not make the underlying databases
globally read-only.

To exercise real writes and classroom signaling, configure **isolated test
databases**, not the current student databases, in an ignored `.env.local`:

```dotenv
LAB_MEMGRAPH_URI=bolt://127.0.0.1:7692
LAB_MEMGRAPH_USER=your-test-user
LAB_MEMGRAPH_PASSWORD=your-test-password
LAB_DATABASE_URL=postgresql://test-user:test-password@127.0.0.1:5433/student_test
LAB_ENABLE_APP_MUTATIONS=1
```

The harness refuses mutation mode unless both database overrides are present.
Provision the test schema and fixture accounts separately. This mode also starts
the existing classroom Socket.IO server on loopback port **8781**, including its
normal presence bookkeeping. Signaling is not started in the default mode.
No engine credentials or production signing keys are inherited. Blockchain
transactions and actual calls still need separate controlled end-to-end testing.

## Configuration

Public frontend variables are documented in `.env.example`:

```dotenv
VITE_PRIVY_APP_ID=your-public-app-id
VITE_STUDENT_API_URL=http://127.0.0.1:8780
VITE_STUDENT_SOCKET_URL=http://127.0.0.1:8781
```

The Vite config falls back to the original student's public Privy app ID and then
the server's public app ID. It reads no other server values into frontend config.
For another Privy test app, set `LAB_PRIVY_APP_ID` and `LAB_PRIVY_APP_SECRET` for
the harness as well. Never prefix a secret with `VITE_`.

Privy tokens use an app-ID-specific `fxv-solid-lab:privy:<appId>:` storage namespace,
with Privy's cookie mirror disabled. Application authorization still requires a
verified backend student cookie and the `student` role. The browser origin and
OAuth callback must be approved in Privy for the selected app. This prototype does
not spoof Origin headers, bypass CORS, or disable identity verification.

### Compatibility Workspace

The original compatibility experiment is retained at
**http://127.0.0.1:5176/compatibility**. It defaults to simulation with no API or
Privy requests. Its separate optional auth harness starts with `npm run dev:api`
on **http://127.0.0.1:8776** and permits authentication endpoints only.

The user manually verified real Privy OAuth login, token exchange, and a student
cookie through that lab. This does not count as verification of every login
provider or of the recreated application's critical workflows.

## Routes

The recreated application includes the public homepage, registration, tutor
browsing and profiles, dashboard, schedule and past-lesson calendar, tickets,
purchase history, materials and curriculum detail pages, Daily Dispatch and
archives, young learner lessons, lesson details and feedback, classroom, student
profile, inbox, contact, privacy, terms, and not-found pages. Account settings,
authentication, booking, cancellation, material selection, issue reporting,
recording consent, feedback, device tests, and session-expiry dialogs retain the
student app's design and API contracts.

## Verification

```bash
npm test
npm run build
# With the frontend running:
npm run test:student
npm run test:pdf
npm run test:browser
# With the compatibility auth API also running:
npm run test:origin
# Optional public Privy config/OAuth initiation check:
npm run test:live-sdk
```

Student parity suites use mocked API responses and classroom socket protocols.
They check real Solid rendering, interactions, retries, timers, layouts, themes,
image loading, and the actual Three.js canvas. They do not create real bookings,
submit real reports, place calls, or send blockchain transactions. See
[MIGRATION.md](MIGRATION.md) for the coverage and remaining production gates.

Browser tests use system Chrome. Set `CHROME_PATH` to another Chromium binary if
needed. The student suites accept `STUDENT_TEST_URL`; compatibility suites use
`PROTOTYPE_URL`. Student screenshots are written to the repo's ignored output
directory; compatibility results are under ignored `test-results/`.

## Maintenance Notes

`scripts/port-student.mjs` performed the initial AST-based conversion. The native
bootstrap, router, Privy integration, theme store, and later fixes are maintained
in this project. The script refuses to overwrite an existing port unless passed
`--overwrite`; that flag would discard manual port refinements. It is not a build
step. `scripts/copy-parity-tests.mjs` copies the 13 current browser suites listed
in `tests/student-suites.json` and adapts their local URLs without editing the
original app. Older suites targeting superseded markup remain only in the
original project; cancellation, survey and media checks use the current design
suites here.

The inherited frontend currently compiles with `strictNullChecks` and
`noImplicitAny` disabled. Restore these checks while hardening the port for
production; a successful build is not a claim of full strict-type coverage.
The retained compatibility workspace is checked separately with both flags
enabled using `tsconfig.compatibility.json` as part of `npm run typecheck`.

Privy's pinned `@privy-io/js-sdk-core` 0.77.0 works without a UI framework, but its
installed README describes it as low-level and recommends contacting Privy before
building on it. This is not a claim of official SolidJS support. The prototype
uses its required viem peer version, 2.56.0. Obtain vendor guidance and complete
real authentication, wallet, payment, and classroom testing before replacing the
production app.
