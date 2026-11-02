# Tutor Application Catalog

`GET /admin/applications` is the complete application view. It requires an operations-capable admin and returns `private, no-store` responses. Query parameters are `filter`, `page` (starting at 1), and `pageSize` (1-50, default 10).

The response contains paginated `items`, filtered `total`, pagination metadata, and unfiltered `counts`. Counts are calculated over the complete catalog, never from the currently visible page. Invalid filters or pagination return 400.

- Applicants remain visible after passing both assessments. `/admin/pending-tutors` remains the separate exam-only queue for existing callers.
- The latest booked/completed interview supplies the applicant's result and `interviewSlotId`. Older results cannot replace a newer interview in this view.
- Saved account assessment flags and completed exam evidence are both recognized.
- Profile Review counts actual `pending_review` profiles, not every uncertified tutor. Approved requires written, speaking, interview, and profile approval; salary-testing waivers are not counted as application approval.
- Applications links to `/interview-room/:interviewSlotId` with Review interview. The existing review editor saves corrections independently of the call and provides Back to applications navigation.
- The application catalog refreshes on return/focus and every 30 seconds while visible. Request revisions prevent stale filter responses from replacing the current page.

Shared API contracts and pagination/count logic live in `shared/tutorApplications.ts`. API releases must include that file at `/shared/tutorApplications.ts`, as well as the changed admin route/service. Deploy the API endpoint before the dashboard that uses it. No data migration or applicant-record modification is required.

Verification:

- `fluentxverse-dashboard/tests/tutorApplications.test.ts`: complete totals beyond 50 applicants, stage filters, and page bounds.
- `fluentxverse-dashboard/tests/browser/applicationCatalog.cjs`: desktop/mobile and light/dark, pagination, stale-response protection, failed refresh recovery, applicant-specific result correction, and updated counts.
- `fluentxverse-server/tests/tutorApplications.persistence.ts`: real graph queries, legacy exam-queue exclusion regression, multiple interview results, correct approval counts, authenticated API permissions, invalid pagination, and result corrections. Requires an empty disposable graph at `APPLICATION_CATALOG_TEST_URI=bolt://127.0.0.1:17726`; never use application storage.
