# Internal Platform Guide

The authenticated admin dashboard's `/platform-overview` route now serves the
Platform Guide. The existing route and authentication boundary are retained;
the sidebar and breadcrumb use the clearer reading label.

## Content And Evidence

`fluentxverse-dashboard/src/content/platformGuide.ts` contains 18 chapters,
22 plain-language glossary terms, public primary-source references, and a
source-review date. The guide separates business goals, implemented workflows,
configuration-dependent behavior, gated pilots, and future work. It does not
read or expose customer data, financial records, or private infrastructure keys.

The content was checked against:

- `docs/admin-lesson-operations.md` and current attendance/booking/cancellation
  policy modules; the older `TUTOR_SCHEDULING_GUIDE.md` is not the timing authority.
- `docs/tutor-compensation.md`: USD base rates are not automatic payroll.
- `docs/bridge-only-trial-launch.md`: October 13 source defaults are not a claim
  of universal production activation; trial cancellation restoration is distinct
  from the student cancellation deadline.
- Current legal content and `qaRecording.service.ts`: required tutor engagement
  agreement and participant runtime consent are explicitly distinguished.
- `docs/video-call-infrastructure.md`, `private-tutor-screening.md`,
  `anonymous-verified-reviews.md`, `provable-review-tallies.md`, and
  `private-lesson-passes-deployment.md` for processing and release limits.
- Current Engine mainnet support: General can select mainnet; existing feature
  modules remain pinned to their approved Volta policies. ETH and VFY accounts
  are different.

Review content whenever an operating rule, release state, privacy process, or
commercial agreement changes. Update the review date only after rechecking the
affected sources. This orientation does not replace signed agreements, legal
policies, operational approvals, or a live status board.

## Reading Experience

The page has chapter deep links, a sticky desktop contents list, a collapsible
mobile contents list, full-chapter search, topic filters, glossary, references,
and print styling. Print uses the current visible reading selection; clear the
filters to print the full guide. It reuses existing custom dashboard artwork.

## Verification

```sh
bun test fluentxverse-dashboard/tests/platformGuide.test.ts
cd fluentxverse-dashboard
bun run build
bun run dev --host 127.0.0.1 --port 5192
```

Run `tests/browser/platformGuide.cjs` with `PLAYWRIGHT_MODULE` pointing to an
installed Playwright package. Optional `GUIDE_URL` defaults to port 5192 and
`GUIDE_SCREENSHOTS` defaults to `/tmp/fluentxverse-platform-guide`. Browser
checks cover 1440px, 768px, and 375px, navigation, reload/deep links, search,
filters, glossary/reference presence, artwork, print/PDF, and authentication.
All administration reads are mocked and any mutation fails the test.
Set `GUIDE_CHECK_PDF_TEXT=true` when Poppler's `pdftotext` is installed to verify
that the PDF includes the final glossary, references, and footer without clipping.
