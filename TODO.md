# TODO

- [x] Deploy the administrator Worker at `dashboard.fluentxverse.com`, retain its
  old Worker domain and switch server-generated dashboard links to `.com`.
  Desktop/mobile login UI, actual API/CORS, private-access rejection and deep-link
  refresh passed without a DNS override. Real administrator workflows need review.

- [x] Launch `fluentxverse-site` on Cloudflare Workers at `fluentxverse.com` and
  `www.fluentxverse.com`. Desktop/mobile home, About refresh, images and app links
  passed on both public domains without a DNS override.

- [x] Deploy student/tutor frontends to Cloudflare Workers, attach `.com` custom
  domains and serve existing `.xyz` URLs through Worker routes. Keep local Docker
  frontends/tunnel entries as rollback; backend/storage remain local.
- [x] Configure `.com` API/WebSocket DNS and tunnel ingress, restore the old
  student `.xyz` origin in Privy and switch the running API public URL to `.com`.
  Fresh Chrome reaches the login endpoint and Google OAuth without a DNS override.
- [ ] Verify real-account social sign-in, reload, logout and booking on `.com`.
  Apple remains disabled in Privy. See [Workers hosting](docs/cloudflare-workers-frontends.md).
- [ ] Remove the tutor index.html legacy author/offcanvas demo panel and audit
  unused styles/images. Public hosting checks found four missing demo images;
  real app assets and classroom media are unaffected.

- [ ] Complete production `.com` cutover: Cloudflare routes/HTTPS, Privy allowed
  origin, real-account auth/classroom checks, marketing-site hosting and public
  server URL switch. Dual-domain app/server support is implemented; keep `.xyz`
  working until these checks pass. See [domain migration](docs/domain-migration.md).

- [x] Add server-only RealtimeKit configuration, booking-pinned media providers,
  authorized participant tokens, and meeting expiry/cancellation reconciliation.
- [x] Integrate the RealtimeKit Core SDK into both classroom UIs behind a pilot flag.
  Real Cloudflare audio/video, student refresh, camera toggles, microphone controls,
  device selection and cleanup passed locally on 2026-10-09. Staged code is deployed;
  production configuration now selects RealtimeKit for new classroom mappings.
- [x] Add versioned QA recording notices and acknowledgements, including adult
  or parent/legal-guardian authority declarations and withdrawal of permission.
- [x] Replace the R2 plan with encrypted local Seaweed archives, verified provider
  status polling, 30-day retention/deletion and audited administrator-only playback.
  Deployed runtime archive, authorized MP4 range playback and durable playback
  audit passed on 2026-10-09; the focused server suite passed 51 tests.
- [ ] Review legal guardian consent verification and recording policy for children;
  a self-declared checkbox does not independently verify guardian authority.
- [ ] Run a controlled RealtimeKit pilot with real assigned accounts on separate
  networks, including mobile data. Local fixtures cannot satisfy this check.
  Production rollout was explicitly requested before this external check passed.
- [ ] Confirm encrypted Seaweed/SQL backups, matching backup retention, physical
  volume vacuuming, available disk monitoring and worker-warning alert delivery.

- [x] Activate Cloudflare TURN with a verified TURN Key ID/API token.
  `TURN_PROVIDER=cloudflare` is active on the API/Socket.IO server. Forced-relay
  audio/video and reconnection passed in both apps using the full server list
  (selected TCP) and TLS-only on port 443, on 2026-10-09. Cloudflare STUN is active.
- [ ] Verify a selected relay candidate across separate networks, including
  cellular and restrictive corporate networks, before launching unrestricted
  production lessons. UDP-only did not connect on the local test network;
  investigate that path on another network. TLS-only port 443 passed locally.
  See [video-call infrastructure](docs/video-call-infrastructure.md).
