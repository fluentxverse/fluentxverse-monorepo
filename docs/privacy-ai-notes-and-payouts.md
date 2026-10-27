# AI, Lesson Notes And Payout Privacy

October 25, 2026: private payout authorization is deployed to the cloud Engine,
API and admin dashboard, with a completed live zkVerify mainnet/Base receipt
pilot. Notes and AI changes below remain locally tested, not deployed as part of
the payout release. Payment execution is not enabled.

## Notes And AI

The API rejects personal details on draft save and final submission, covering
feedback, tutor handoff, vocabulary, grammar, pronunciation, material titles and
progress details. Identity aliases come from the owned booking relationship.
Rejected writes preserve the preceding draft. Errors do not echo detected values.

Detection normalizes Unicode, format controls, HTML and entities; it checks known
student names/identifiers, contact details, common street-address forms, URLs and
explicit personal-detail phrases. This is not universal name/address recognition.
Unknown names, unusual addresses and deliberate obfuscation can evade detection;
common names can cause false positives. Historical notes, backups and unsaved
browser drafts are not retroactively erased. Do not promise guaranteed anonymity.

The shared Mastra boundary removes structured identity metadata, unrelated history
and recognized personal values before generate/stream calls. Unreviewed call
options are rejected; SDK logging is disabled and application AI errors omit
content. Classroom AI requires an owned booking. Personalized checkpoints exclude
free-form tutor handoff history. Speaking grading redacts known applicant details
without changing stored raw evidence or its authenticated hash.

Audio transcription still sends audio, including spoken personal details; voice
itself can identify a person. Necessary educational content still reaches the
configured provider. This is reduced disclosure, not confidential inference.
Provider retention/training settings have not been changed or independently
verified. New assessment preprocessing belongs in the next policy-version review;
existing credentials are not regraded. New direct clients, memory or raw-prompt
tracing require privacy review.

## Private Payout Authorization

The finance-only compensation tab adds completed-lesson approval, selection of up
to four earnings, reservation, proving readiness, proof generation, cancellation
and receipt reconciliation. All salary and proof-attempt records stay in Memgraph.
No salary tables were added to Postgres.

Engine owns witness preparation, signing, proving, native submission and official
Base receipt verification. The application checks finance permission, exact
reserved records, refunds, evidence digests, expiry and approved release pins.
Business records are rechecked after proving and before submission. Browser-supplied
verification outcomes and proof IDs are never accepted.

Stages distinguish `proving`, `locally_proved`, `submitting`, `submitted`,
`native_finalized`, `receipt_verified` and `review`. Generation is serialized.
Lost submission responses remain uncertain and are not automatically resent.
Stored Engine submission IDs allow read-only reconciliation; unknown IDs require
operator inspection rather than a public ID-replacement endpoint.

Amounts, contracted rates, recipients, tutor bindings and lesson identifiers stay
in the witness. Public signals contain salted commitments, policy/issuer/project
bindings, timestamps and lesson nullifiers. Lesson count is disclosed; repeat
nullifiers are linkable. Evidence digests are private operational metadata and
must not be published alongside the proof.

The issuer attests authorized application records; the proof does not independently
establish that teaching occurred. Entitlement secrets are Engine-held in the
custodial tutor-wallet model, not exclusively tutor-controlled. Backend reservations,
revocation and acceptance remain trusted. Nullifiers alone do not enforce onchain
duplicate prevention: no new consuming contract is deployed. Key/policy/scope
rotation requires migration planning.

A valid historical receipt does not make a cancelled, refunded, held or expired
reservation currently payable. No proof stage transfers funds or marks earnings
paid. Ordinary transfers would reveal recipient and amount. Shielded settlement,
conversion, tutor-initiated claims and live payment execution are not implemented.

## Activation

Configure a dedicated payout Engine project, protected signing/nullifier keys,
20-signal v2 policy and a signed, cryptographically verified proving release.
Use server-only `GMR_PAYOUT_ENGINE_API_BASE` and `GMR_PAYOUT_ENGINE_API_KEY`.
Pin the approved release with:

```dotenv
PAYOUT_ARTIFACTS_APPROVED=false
PAYOUT_RELEASE_MANIFEST_SHA256=
PAYOUT_ZKVERIFY_VK_HASH=
PAYOUT_ISSUER_HASH=
PAYOUT_SCOPE_HASH=
PAYOUT_RELEASE_POLICY=independent-reviewed
PAYOUT_VERIFICATION_NETWORK=zkVerify
PAYOUT_CHAIN_ID=8453
PAYOUT_ZKVERIFY_DOMAIN_ID=2
PAYOUT_PROOF_SUBMISSIONS_ENABLED=false
```

Explicit `self-operated` approval is supported with truthful assurance: it is not
an independent audit/setup contribution. Flags never replace setup verification.
The development QA keys are not a production release. The application adapter
initially supports Base/Base Sepolia; Engine's additional destination choices do
not silently change these application pins.

## Tests

- Server `tests/personalInformation.test.ts`: normalization, minimization, overlapping
  contacts/names, option restrictions and request-context isolation.
- Server `tests/payoutPrivacy.persistence.ts`: disposable Memgraph, rejected draft
  rollback/final submission, finance/origin guards, duplicate generation, refund
  races, cancellation, response loss, receipt states and zero paid earnings.
- Dashboard `tests/browser/payoutAuthorization.cjs`: fixture-backed finance workflow,
  disabled native/payment actions and 1440/375/320px browser geometry.
- Engine `scripts/payout-private.test.mjs`: actual development Groth16 proof,
  39 invalid witnesses and mutations of all 20 public signals rejected.
- Engine release/policy tests reject unapproved artifacts, keys and destinations.

Native/receipt results in the persistence/browser fixtures are simulated. The
separate production pilot used one actual synthetic proof submission and a native
network fee; it did not pay a tutor. See `payout-activation-20261025.md` for release
pins, verified evidence and the remaining settlement decision.
