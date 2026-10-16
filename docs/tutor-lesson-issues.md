# Tutor Lesson Issues

The tutor performance page has a `Lesson issues` tab next to `Attendance & reliability`.
Sent reports are submitted by the tutor; received reports are submitted by the student
booked into the tutor's lesson. Reports remain separate from attendance decisions and
penalties. This view does not resolve reports, issue refunds, or change attendance.

The tab provides direction counts, submitted/under-review/resolved counts, a review-status
filter, twenty-report pages, lesson and submission timestamps in PHT,
issue type and duration, public descriptions/resolutions, and lesson links.
Direction and status stay selected when the metrics period changes. `#issues` supports
direct links and refresh. Requests are cancelled when filters change or the view closes.

## API

`GET /tutor/lesson-issues` requires a valid `tutorAuth` cookie with the tutor role.
Responses use `Cache-Control: no-store`.

Parameters:

- `period`: `month` (default), `30days`, or `all`.
- `month`: PHT calendar month, required only to select a non-current month.
- `direction`: `sent` (default) or `received`.
- `status`: `all` (default), `submitted`, `under_review`, or `resolved`.
- `page`: positive integer, default 1; fixed page size 20.

Period filtering uses the scheduled lesson date, matching the performance metrics,
not the report's creation date. All-time includes owned lessons with missing schedule
timestamps. Rows sort newest report first, with a stable ID tie-breaker.

Memgraph supplies the authenticated tutor's bookings and booked student IDs.
PostgreSQL joins only those bookings. Sent reports additionally require the same tutor ID;
received reports additionally require the booked student ID. A query-string tutor ID cannot
change scope. Internal comments, assignees, admin IDs and review history are excluded.
Existing issue-report schemas and public subtype labels are reused; no new tables are added.

## Verification And Release

Frontend checks:

```sh
cd fluentxverse-tutor-solid-prototype
npm run build
node tests/browser/metricsLessonIssues.cjs
node tests/browser/performanceMetrics.cjs
```

Backend unit checks:

```sh
cd fluentxverse-server
bun test tests/tutorLessonIssues.test.ts tests/tutorPerformance.test.ts
```

The integration suite `tests/tutorLessonIssues.integration.test.ts` runs only when
`LESSON_ISSUES_TEST_URI` and `LESSON_ISSUES_TEST_DATABASE_URL` are explicitly set and
`DATABASE_URL` matches the latter. Use disposable Memgraph and PostgreSQL instances,
never the application database. It verifies role authentication, cross-tutor and cross-student
isolation, PHT boundaries, pagination, filters, privacy and immediate review updates.

Deploy the application API and tutor frontend together. The tutor Cloudflare Worker hosts
static assets only; a frontend-only release cannot provide the new API endpoint.

## Live Release: October 14, 2026

- Tutor Worker: `07b59c74-e8d1-4138-af6c-bf4a0ed44de2`.
- Previous tutor Worker: `18949370-5657-42a8-859f-0bfcec4f634e`.
- API image: `fluentxverse-server:lesson-issues-20261014`.
- API rollback image: `fluentxverse-server:pre-lesson-issues-20261014`.

The API image extends the previously running image and copies only the tutor route and
lesson-issues service using `output/Dockerfile.tutor-lesson-issues-runtime`. Runtime
environment values, command and persistent mounts were preserved; database containers
and other apps were not restarted. Both directions were queried against live data without
printing personal details. Public health, unauthenticated rejection and no-store headers
were verified. Browser checks used the deployed assets with read-only report fixtures at
1440, 375 and 320 pixels, including dark mode. Public hosting checks used the real API.
