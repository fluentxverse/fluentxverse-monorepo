# Student and Tutor Legal Documents

Four separate public documents are provided by the active Solid apps:

- Student /privacy-policy and /terms-of-service
- Tutor /privacy-policy and /terms-of-service

Each app owns its renderer, scoped stylesheet, and role-specific content. Files remain inside each standalone build context. Archived Preact code is unchanged.

## Publication Review Required

The operator has confirmed that tutors must sign a recording agreement before beginning teaching work. The tutor documents now describe this mandatory engagement requirement, while student recording remains optional. The current software still uses per-lesson tutor consent: a versioned one-time signature record, administrative review, teaching-eligibility gate, and recording-service authorization integration are not implemented by these document changes. Do not replace existing consent checks with assumed acceptance or auto-sign existing tutors.

Legal review must establish the appropriate processing basis for required work-related recording. A contractual requirement or signature alone does not establish freely given consent or waive statutory rights. Define lawful handling of objections and withdrawal, narrowly scoped purposes, student permission, and material agreement changes before enforcing the arrangement.

These are substantive implementation drafts, not a legal opinion or certification of compliance. Do not treat deploying a page as obtaining contractual acceptance or processing consent. Existing signup, recording, and purchase acceptance flows have not been changed by this task.

Before publishing or relying on these documents, the operator and qualified counsel should confirm:

- Registered operator name, address, applicable establishment, and privacy officer/contact. The draft uses the existing support@fluentxverse.com address, not an invented entity.
- Minimum registration ages, guardian verification, child safeguarding, and legally valid recording authority.
- Actual provider inventory, processor agreements, processing locations, overseas transfer notices and safeguards, and any provider training/retention settings. Integration names are derived from source, not a provider-contract audit.
- Retention periods for profiles, chat, assessments/interviews, transactions, reports, logs, and backups, with matching deletion jobs. Only the classroom QA recording setting was verified as 30 days; a generic necessity statement does not replace a formal retention schedule.
- Prices, ticket expiration/transfer conditions, cash-refund policy, exceptional lesson remedies, and required purchase notices. Current code uses one ticket per lesson and ordinary ticket refunds for cancellations at least one hour early.
- Tutor engagement terms, rates, payout timing, taxes, deductions, employment classification, and applicable law.
- Rights-request verification/response operations, deletion workflows, security controls, incident procedures, and support mailbox ownership.
- Material-change notices and versioned acceptance records where required. No automatic reacceptance or retroactive waiver was added.

Verified source behavior includes the five-minute student cancellation cutoff, five-minute early classroom access, scheduled-start communication gate, three-minute wrap-up limit, once-per-participant lesson reporting, missing-tutor reporting delay, and 48-hour eligible lesson-note edit window.

## Primary Reference Material

The privacy-rights and retention wording was checked against primary authority; applicability still requires legal review:

- Philippine Data Privacy Act: https://privacy.gov.ph/data-privacy-act-/
- Implementing Rules: https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-%202012/
- Data subject rights: https://privacy.gov.ph/data-subject-rights/
- NPC Guidelines on Consent: https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf
- Japan Personal Information Protection Commission laws: https://www.ppc.go.jp/en/legal/

No unsupported registered entity, universal governing jurisdiction, fixed child age, tutor payout rate, blanket no-refund rule, or mandatory arbitration was invented.

## Verification

Run npm run build in both Solid project folders. Run node tests/legal-pages.cjs with each app's dev server running (student 5176, tutor 5177). LEGAL_TEST_URL can override the test origin.

The browser suite uses anonymous API fixtures and checks all four documents on desktop/mobile, dark-preference readability, section links and reload, original custom artwork, public routes, print layout, content coverage, overflow, and runtime errors. It does not certify legal enforceability or audit backend privacy operations.
