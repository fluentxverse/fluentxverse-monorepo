# Tutor Profile Performance

The profile no longer fetches private personal/address information just to render education. Its existing profile response already supplies `schoolAttended` and `major`. Settings still load their own complete personal information when requested.

Recent profile responses are kept for thirty seconds in account-scoped tab memory, never local/session storage. Authentication changes and profile-affecting writes invalidate the entry. A generation check prevents a request started before invalidation from restoring an outdated cache. Navigation cancels pending reads. Unchanged settings closure does not reload or replace the page.

Screening certification has a section-local Suspense boundary with no added loader. Slow certification responses cannot hold the rest of the profile behind a page-level loading state. Failed profile reads offer retry rather than an editable empty profile. Successfully loaded statistics are reused within the page.

Navigation and the favicon reuse the existing 23 KB WebP logo instead of the 241 KB PNG. This removes about 90% of each logo transfer without changing the brand design; browser checks verify that the replacement decodes on desktop and mobile.

The server creates a non-unique `User(id)` index if it is absent. Previously the profile query plan used `ScanAll (u)`; the optimized plan uses the label/property lookup. The read projects only fields consumed by the profile DTO and certification summary, excluding password hashes, screening answers and unrelated account fields from database transport. The own-profile response remains authenticated with `Cache-Control: private, no-store`. `Server-Timing` exposes profile database duration without identifiers.

## Reproducible Checks

`tests/browser/profilePerformance.cjs` uses identical mocked API delays: 200 ms for profile, 1600 ms for personal information and screening. Desktop/mobile baseline display times were 2281/2227 ms. After eliminating the redundant read they were 726/699 ms; cached return was 24 ms in both viewports. These are controlled local browser measurements, not claims about every live network or comparisons with Facebook.

Cache tests cover account separation, expiry, write/auth invalidation and stale-response rejection. Browser checks cover education, cached navigation, edits, initial errors and retry. Disposable Memgraph tests validate the real query plan, projection, DTO fields and authenticated endpoint headers. They run only with `TUTOR_PROFILE_TEST_URI=bolt://127.0.0.1:17692`, never the production database.
