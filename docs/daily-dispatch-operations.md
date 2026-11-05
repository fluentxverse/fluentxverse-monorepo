# Daily Dispatch Generation

The article generator lives in the separate `fluentxverse-ai` repository. It is
not an Elysia API background job. Its single cloud Docker worker is named
`fluentxverse-dispatch`, on the private application network with no exposed ports.

The restored worker generates one published article per Philippine day at 03:00
Asia/Manila. Startup catches up the most recent scheduled day, not the whole missed
history. Stable `daily-dispatch-YYYY-MM-DD` article IDs and create-only persistence
make restart/retry recovery idempotent. Keep exactly one worker replica; this is
not a distributed generation/lease system. Do not run the legacy scheduler too.

Generation failures retry after 5, 10, 20, 40, then 60 minutes. A 15-minute watchdog
restarts stalled generation. The worker has a 768 MiB memory limit, half a CPU,
bounded logs, a read-only filesystem, and a writable temporary directory. Docker
restarts it after host reboot. Health checks report stale polling or repeated
failures; Docker health alone does not restart an unhealthy process or send alerts.

The worker uses existing server OpenAI and Memgraph configuration. Only its
required settings are copied into a mode-0600 Compose file on the VPS. It does not
receive signing keys, authentication secrets, payment credentials, or the Docker
socket. NewsAPI/GNews credentials are optional; the existing generator falls back
to Google News RSS. Generated material still requires normal editorial oversight.

Deploy the reviewed generator checkout:

```bash
node scripts/deploy-daily-dispatch.mjs /absolute/path/to/fluentxverse-ai
```

Runtime configuration:
`/opt/fluentxverse/releases/daily-dispatch-20261027/compose.private.json`.
The original API image and its Compose configuration are not changed. Logs are
available with `docker logs fluentxverse-dispatch`. Check for `dispatch_published`,
confirm the article through the authenticated Dispatch API, and inspect container
health. Stop only this worker with `docker stop fluentxverse-dispatch`; do not
launch the old full-stack Compose file from the AI repository.

## Article Rendering

The tutor app is the current design reference for Daily Dispatch. Its header stays
black in both themes; article and archive surfaces follow the resolved theme.

All student and tutor article views now mount `shared/ui/dispatchArticle.ts`.
This framework-neutral renderer owns the template, citations, font controls,
sidebar, loading/retry, and answer visibility. The Solid apps and Preact dashboard
only supply the route, API base, view permissions, and resolved app theme. Do not
add another article template inside an app. Student app material cannot switch to
tutor mode. Dashboard preview aliases and tutor previews can switch views.

Keep numbered questions, yellow accents, vocabulary grid, explicit typography,
and the theme palette in `shared/ui/daily-dispatch-article.css`. Generic workspace
styles must not override themed articles. Archive-specific styles remain in each
app. The shared renderer uses `data-dispatch-renderer="dispatch-shared-v1"` as a
deployment/parity marker; source credits must be labeled anchors, never raw URLs.

Both standalone and classroom articles use `data-theme` on their article root.
Classroom frames follow the parent theme through `useEmbeddedTheme`, including
theme changes while the article is open. Student views omit tutor answers.

Run `node scripts/tests/daily-dispatch-renderer.cjs` with `STUDENT_TEST_URL` and
`TUTOR_TEST_URL` to check both apps, classroom frames, font controls, archives,
light/dark themes, and desktop/mobile layouts using intercepted API fixtures.

The tutor article's sidebar search submits to the material library with a `search`
query parameter. That library uses `/dispatch/classroom-library` so search includes
older published articles beyond the default 50-item administrative list. Run
`node scripts/tests/tutor-dispatch-tools.cjs` with `TUTOR_TEST_URL` to verify search,
hover contrast, archive themes, and system-theme changes.

## Branding And Citations

Daily Dispatch uses the approved transparent yellow newspaper/D mark at
`public/assets/img/home-icons/dispatch-v2.png` in all three apps. The shared
`appArtworkSrc('dispatch')` mapping also supplies library and home artwork. Keep
the original generated image in `output/imagegen/daily-dispatch-logo-20261105`.

The legacy `articleContent.source` field can contain attribution prose, Markdown
links, or raw source URLs. `shared/dispatchSources.ts` converts these into a short
description and labeled hyperlinks without altering the persisted article.
Google News RSS URLs receive neutral reference labels; do not infer a publisher
from an opaque RSS ID or assign publisher names by list position. Explicit labels
and identifiable publisher domains are preserved. Render escaped text and native
anchors, never raw HTML. Share citation styles through
`shared/ui/dispatch-sources.css` across tutor, student, and dashboard previews.

Run `bun test scripts/tests/dispatch-sources.test.ts` for legacy format handling,
and `node scripts/tests/dispatch-brand-sources.cjs` with `STUDENT_TEST_URL`,
`TUTOR_TEST_URL`, and `DASHBOARD_TEST_URL` for citations, link destinations,
responsive rendering, and logo transparency/load checks.

`scripts/tests/dispatch-standard.cjs` compares actual text and computed typography,
spacing, and colors across all student views and tutor views at desktop/mobile
sizes in both themes. It includes the real November 5 article's five RSS source
URLs in `scripts/tests/fixtures/dispatch-source-20261105.json`, checks both classroom
frames, and confirms that student mode never renders tutor answers. Material
entry routes send no-store/no-cache headers so new page loads revalidate releases.

Dashboard archives support both `/daily-dispatch/archives/:month` (tutor preview)
and `/daily-dispatch/student/archives/:month` (student preview). Match both archive
routes before the generic `/daily-dispatch/student/:id` route. Preserve the view
when changing months or opening an article. Run
`node scripts/tests/dashboard-dispatch-archives.cjs` with `DASHBOARD_TEST_URL` to
check these exact URLs, reloads, browser back, article targets, and both themes.
