# Public ESL Platform Overview

Route: `/esl-tutor-app`. Linked from the homepage ESL tutor app photo and
"How the platform works" link, and the public site's ESL footer column.
The direct tutor portal link remains available.

## Source And Scope

Public adaptation of
`fluentxverse-dashboard/src/content/platformGuide.ts`, as rendered by the
authenticated `/platform-overview` page. The source guide identifies its code
review date as October 13, 2026; the public page retains that date and explicitly
does not assert live deployment status. Public adaptation prepared October 24.
The source SHA-256 is recorded in the scoped release manifest.

No dashboard component, authorization code, API client, customer record, private
key, credential or admin endpoint is imported by the public site. The public
content is an intentionally reviewed static snapshot, not an automatic export of
future internal guide changes. Update it deliberately when the source changes.

## Chapter Mapping

| Internal subjects | Public chapter |
| --- | --- |
| Business model | A useful English lesson comes first |
| Apps and people | Two apps. One coordinated service. |
| Student journey | From first booking to follow-up |
| Tutor onboarding | How tutors qualify |
| Scheduling | Reliable scheduling and lesson access |
| Attendance, issues, operating playbook | Attendance, support, and accountability |
| Commercial access | Lesson access and business sustainability |
| Finance and compensation | Compensation and financial controls |
| Materials and AI | Teaching materials and AI assistance |
| Service architecture | How the technology fits together |
| Accounts, security, calls, recordings | Privacy, recordings, and consent |
| Privacy concepts and feature workflows | What private verification can prove |
| Engine, networks, release risks | Networks, receipts, and rollout boundaries |
| Performance and growth | What responsible growth looks like |

Exact staff runbooks, operational penalty identifiers, account-specific decisions,
and signing/funding instructions are omitted. Source caveats remain: trial mode
depends on the deployment; private features are scoped/gated; rates are not
payroll; proofs do not prove learning quality or honest inputs; source code and
network connectivity do not establish a commercial mainnet launch. No invented
traction, learning gains, pricing, funding award, security audit or accreditation
claims are added.

## Presentation And Verification

The article uses the corporate site's Manrope typography, blue accents, full-width
bands and existing tutoring imagery. The desktop navigation is sticky; mobile
chapter navigation expands on request. Search covers prose, tables, summaries and
caveats; topics combine with all query words. Print renders the current reading
view. Metadata includes a canonical public URL and a descriptive page title.

Images reuse previously generated tutor-site assets:
`public/assets/img/esl-platform-overview-wide.webp` and
`public/assets/img/esl-platform-overview-mobile.webp`. No new images were generated
for this page. Generation prompts are preserved in
`output/release/about-closeup-generation.md` and
`output/release/about-matched-generation.md` in the workspace.

Unit tests: `bun test tests/platformOverview.test.ts`.
Browser checks: `SITE_URL=http://127.0.0.1:5205 node tests/browser/platformOverview.cjs`.
Browser coverage includes discovery, direct URLs, canonical metadata, responsive
tables, topic/search combinations, empty/reset states, clipboard links, chapter
anchors, reloads, print CSS and absence of protected API requests.
