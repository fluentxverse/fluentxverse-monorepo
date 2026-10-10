# Video call infrastructure

Production lesson classrooms now use RealtimeKit for new room mappings. Previously
mapped lessons keep their original provider to avoid splitting an active call.
Interviews still use peer-to-peer WebRTC with Cloudflare TURN.

## RealtimeKit production configuration

Both classroom apps use the Cloudflare Core SDK for selected bookings, retaining
the existing video layout, device controls, and Socket.IO chat/materials/attendance.
Interviews are not migrated. Configuration is server-only:

```env
CLASSROOM_MEDIA_PROVIDER=realtimekit
CLOUDFLARE_RTK_PILOT_BOOKING_IDS=
QA_RECORDING_ENABLED=true
QA_RECORDING_ENCRYPTION_KEY=<32 random bytes encoded as 64 hex characters>
CLOUDFLARE_ACCOUNT_ID=<account ID>
CLOUDFLARE_RTK_APP_ID=<RealtimeKit app ID>
CLOUDFLARE_RTK_API_TOKEN=<Realtime Admin token scoped to this account>
CLOUDFLARE_RTK_STUDENT_PRESET=group_call_participant
CLOUDFLARE_RTK_TUTOR_PRESET=group_call_participant
```

`CLASSROOM_MEDIA_PROVIDER=realtimekit` selects all new room mappings. For a
restricted pilot or rollback, set the provider to `webrtc` and use the comma-separated
pilot booking list to select only those bookings for RealtimeKit.
The first authorized room entry pins a booking's provider in PostgreSQL, so flag
changes cannot split an already mapped lesson between providers. Reverting the
flag changes future mappings, not active RealtimeKit calls.

The authenticated `classroom:media-token` socket acknowledgement only serves the
assigned student/tutor already in the room and inside the live lesson window.
Authorization is checked again after provider calls. The server serializes
meeting/participant provisioning per booking with a PostgreSQL row lock and
recovers matching opaque provider resources after interrupted writes. Ambiguous
or inactive meetings fail closed. Only participant tokens reach the browser;
API tokens are never bundled or logged, and participant tokens are not persisted.
Names sent to Cloudflare are generic roles; identifiers are hashes rather than
emails or profile names. Both role presets must deny recording, livestreaming,
and provider administration. The verified default participant preset does so.

The SDK reconnects media independently of app signaling. Device operations are
serialized, setup failures have bounded retries, and browser cleanup releases
tracks. The browser lease uses server time instead of the user's wall clock.
The server marks meetings inactive and kicks peers when the tutor ends a lesson,
on cancellation, or after the three-minute wrap-up. A 30-second reconciliation
job retries provider failures and survives server restarts through stored state.
Provider outages can delay server-side closure; monitor reconciliation warnings.

### QA recording and private local Seaweed storage

Every meeting still sets `record_on_start=false`. Both apps show a versioned
recording notice. Each assigned participant must explicitly agree and confirm
adult/parent/legal-guardian authority. Declining or withdrawing permission does
not prevent the lesson from continuing; the server stops active recording when
permission is withdrawn. A checkbox records a declaration, not independent proof
of guardianship. Review the guardian consent process before onboarding children.

The server checks current consent, assigned identities, the live lesson window,
and actual Cloudflare participant presence before starting composite recording.
Students/tutors cannot start recording through the provider SDK. Starts are
serialized with PostgreSQL advisory locks; persisted intent and provider list
recovery handle interrupted requests. An ambiguous start waits before retrying,
and there are at most six start attempts/segments per booking. Recording duration
is bounded by the classroom end time, with a one-hour safety limit.

Provider status is verified by polling authenticated Cloudflare APIs, not trusting
client events or unsigned webhooks. Control checks run every ten seconds and
archive checks every thirty seconds. Closure/cancellation and consent withdrawal
stop recording on the next successful control check; outages can delay that stop.
Only verified `UPLOADED` recordings with matching meeting IDs are downloaded.

Cloudflare's default storage retains recordings for seven days. Our worker
downloads immediately when ready, without needing a separate R2 bucket or exposing
Seaweed publicly. Download hosts are restricted and redirects refused. Downloads
are bounded to 512 MiB and fifteen minutes; archive failures retry and appear in
the admin list and worker warnings. Investigate failures well before day seven.
Source URLs are never persisted or returned to browsers.

Media is encrypted in authenticated 1 MiB AES-256-GCM chunks. HKDF derives a
recording-specific key from the server-only root key; chunk identity/position is
authenticated. Only ciphertext is temporarily spooled for Seaweed's multipart
upload. Stored bytes are read back, authenticated and SHA-256 checked before
playback is enabled. There is no plaintext recording on local disk.

Objects use `/private-qa/<recording-id>.bin`, separate from lesson files. The
public lesson proxy only allows `/lessons/` and rejects traversal; Seaweed ports
bind to loopback rather than external interfaces. Administrator-only range
playback decrypts on demand without public storage links or browser decryption
keys. Listing, playback, deletion and access-history views are audited. The admin
token must explicitly have an admin role and its account must still exist.

The dashboard's `/recordings` page lists provider/archive state, playback, expiry,
access history and deletion. Playback responses are private/no-store, and expired
recordings are inaccessible even before cleanup. Encrypted Seaweed objects are
deleted thirty days after recording invocation; failed deletion retries. Deleted
tombstones prevent re-download. Cloudflare's temporary copy expires independently
after seven days. Seaweed vacuuming and any external backups need matching
retention policies; logical deletion is not an immediate disk overwrite.

Securely back up `QA_RECORDING_ENCRYPTION_KEY` outside the repo. Losing it makes
recordings unreadable. Do not rotate it without migrating stored recordings.
Keep Seaweed volumes and PostgreSQL durable and backed up; monitor available disk
capacity and worker warnings. Recording on Cloudflare's SFU is not end-to-end
encryption against Cloudflare, which necessarily processes the original media.

References: [Core SDK](https://developers.cloudflare.com/realtime/realtimekit/core/),
[participant API](https://developers.cloudflare.com/api/resources/realtime_kit/subresources/meetings/methods/add_participant/),
[custom recording storage](https://developers.cloudflare.com/realtime/realtimekit/recording-guide/custom-cloud-storage/).
See also [recording states](https://developers.cloudflare.com/realtime/realtimekit/recording-guide/monitor-status/)
and [retention](https://developers.cloudflare.com/realtime/realtimekit/data-retention/).

### Verification

From `fluentxverse-server`, run the focused server suite:

```sh
bun test tests/classroomMedia.test.ts tests/iceConfiguration.test.ts tests/classroomTiming.test.ts tests/classroomExpiry.test.ts tests/socketAuth.test.ts
RUN_CLASSROOM_MEDIA_DB_TEST=1 bun test tests/classroomMediaStore.integration.test.ts
bun test tests/qaRecording.test.ts tests/qaRecording.integration.test.ts
RUN_QA_RECORDING_DB_TEST=1 bun test tests/qaRecording.integration.test.ts
```

The PostgreSQL integration test requires `DATABASE_URL` pointing at a reachable
test database and deletes its own synthetic mapping. Production Docker already
injects the correct database URL; local Bun commands otherwise use the repo's
legacy development credentials.

From `fluentxverse-tutor`, with both apps running and Playwright available:

```sh
CLASSROOM_RTK_TEST=1 node tests/browser/classroomCallStatus.cjs
CLASSROOM_RTK_TEST=1 CLASSROOM_QA_TEST=1 node tests/browser/classroomCallStatus.cjs
```

`CLASSROOM_TUTOR_URL` and `CLASSROOM_STUDENT_URL` can point to alternate local
preview ports. The test creates an isolated provider meeting with synthetic
participants, mocks only app account/signaling traffic, and verifies real inbound
audio and decoded video frames in both apps. Tokens stay in memory, and the
provider meeting is closed in cleanup. Screenshots cover desktop tutor and mobile
student views. Both apps passed refresh recovery, camera toggles, microphone
mute/unmute, device selection and connection cleanup on 2026-10-09. QA mode also
starts/stops a real provider recording, verifies upload and archives an encrypted
local copy, verifies checksums and range playback, then deletes the test object.
App accounts/signaling are fixtures, not real-account pilot evidence. These local
fixtures do not replace a real-account production
pilot, separate-network tests, or long-running/mobile backgrounding checks.

From `fluentxverse-dashboard`, run `node tests/browser/recordings.cjs` against the
preview or set `QA_DASHBOARD_URL` to the running dashboard's `/recordings` URL.
The dashboard test uses fixture records and checks desktop/mobile controls and
error recovery; API authorization is covered separately by server tests.

Deployment verification on 2026-10-09 confirmed RealtimeKit and consent-gated
recording enabled on the running server. The focused server suite passed 51
tests. A real provider recording was archived through the deployed Docker
runtime, and an authenticated administrator request returned an MP4 byte range
with HTTP 206 and a durable playback audit entry. The isolated local test archive
and its SQL records were removed afterward. Public recording endpoints reject
unauthenticated requests; public lesson-file routes cannot read private archives.
These checks do not establish real-account or separate-network pilot readiness.

STUN uses Cloudflare's public `stun:stun.cloudflare.com:3478` endpoint. For
reliable calls across restrictive NATs and firewalls, configure a TURN relay.

## Cloudflare TURN

Create a **TURN key** in Cloudflare Realtime > TURN. A Realtime SFU App ID and
its API token are not a TURN key. Set these only on the API/Socket.IO server:

```env
TURN_PROVIDER=cloudflare
CLOUDFLARE_TURN_KEY_ID=<TURN key ID>
CLOUDFLARE_TURN_API_TOKEN=<TURN key API token>
CLOUDFLARE_TURN_TTL_SECONDS=7200
```

The server calls Cloudflare's credential-generation API for authenticated
room members, returns only temporary ICE credentials, and caches them per
user for 60 seconds with single-flight requests. Credentials default to two
hours, longer than a normal lesson; ICE restarts request fresh settings.
The upstream request times out after five seconds. Failed key/API requests
are not cached and return a call-setup error rather than silently pretending
TURN is available. No long-lived token is returned to the browser or logged.

Cloudflare's returned relay URLs include UDP, TCP, and TLS, including TLS on
port 443. Browser-blocked port 53 is excluded. The relay is managed by
Cloudflare, so there is no local TURN container or relay port range to expose.

Reference: [Cloudflare TURN credentials](https://developers.cloudflare.com/realtime/turn/generate-credentials/).

## Self-hosted TURN

Alternatively, use coturn with `use-auth-secret` and configure:

```env
TURN_PROVIDER=coturn
TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:443?transport=tcp
TURN_SHARED_SECRET=<same secret configured on the TURN server>
```

For coturn, the server issues temporary HMAC credentials over the authenticated Socket.IO
connection. Do not put the shared secret in a frontend build variable. Expose
UDP and TCP TURN ports and a reachable relay port range on the TURN host. A
TLS TURN listener on port 443 is recommended for networks that block UDP and
port 3478. Confirm that the chosen TURN URLs and relay addresses are reachable
from outside the server network; a private Docker address will not work.

## Verification

With `TURN_PROVIDER=none` or no TURN settings, the apps use STUN and calls can fail on restricted
networks. Validate the production setup with two browsers on different networks,
including a network that blocks UDP, and inspect `webrtc-internals` for a
selected `relay` candidate pair.

Use a forced `iceTransportPolicy: 'relay'` test to verify actual relay traffic,
not just API credential generation or candidate gathering. Repeat with only
`turns:turn.cloudflare.com:443?transport=tcp` enabled to validate the TLS path.
Rotate the server API token if it is exposed, then restart the API service to
load the new secret and invalidate its temporary credential cache.

### Current deployment check (2026-10-09)

Cloudflare TURN is enabled on the running API/Socket.IO server. The replacement
TURN key successfully generates temporary credentials. No long-lived token
was found in frontend bundles or recent server logs.

Both actual classroom apps passed forced-relay audio/video and reconnection
checks using real Cloudflare credentials and mocked account/signaling fixtures.
Both browsers selected `relay` local and remote candidates. The full server
list selected TCP; a TLS-only port 443 run selected TLS and also passed.
UDP-only did not establish a connection within the test timeout on this
network. Separate-network/cellular and corporate firewall checks remain open;
these local tests do not replace them.

Run the browser regression from `fluentxverse-tutor` with Playwright available:

```sh
CLASSROOM_TURN_TEST=all node tests/browser/classroomCallStatus.cjs
CLASSROOM_TURN_TEST=tls443 node tests/browser/classroomCallStatus.cjs
```

Set `PLAYWRIGHT_MODULE` to a Playwright module path when it is installed outside
the app. Other supported modes are `udp` and `tcp`. The test reads only
temporary credentials from the running server and never reads its API token.
