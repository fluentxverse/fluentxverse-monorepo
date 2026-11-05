# Learning Terminology

FluentXVerse builds onchain learning applications. Use "learning" for the ecosystem,
products, platform narrative, headings, navigation, descriptions, and metadata.
Use "Qualifications" for tutor profile credentials and "Highest qualification" for
the attainment field, rather than relabeling an academic background as "Learning".

## Compatibility

- `/onchain-learning` is canonical. `/onchain-education` remains a redirect, including
  the client-side query string and fragment, so existing links continue working.
- Daily Dispatch displays the saved `Education` category as `Learning`. Option values,
  filters, and API payloads keep `Education`; existing articles need no migration.
- Profile keys such as `education` and `educationalAttainment` remain unchanged in
  APIs, stored records, and approval workflows. Only their displayed labels change.
- Actual degree names, school names, employment sectors, cited URLs, historical
  changelogs, and archived builds retain their original wording. Do not alter a
  person's qualifications or an institution's name to match marketing terminology.

## Verification

The site build runs `tests/learningTerminology.test.ts` to check current website,
student, tutor, dashboard, and shared source copy, metadata, route compatibility,
and legacy category labels. The website technology browser suite also checks rendered
copy and legacy URL redirects. Existing profile browser tests use the new labels
while continuing to verify the original qualification values and API payloads.
