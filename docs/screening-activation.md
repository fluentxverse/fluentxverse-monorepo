# Screening Certification Activation

## Current Release Policy

October 23 completion: the self-operated release is deployed and certification is
enabled after a real zkVerify mainnet proof and finalized official Horizen receipt
passed the pilot, including tampering, expiry, revocation, consent and binding
checks. The synthetic pilot credential was revoked; no real tutor was automatically
certified. See [the current release record](screening-self-operated.md).

October 22 operator decision: self-operated setup is now an explicitly supported
screening release policy. External audit/contributor requirements below describe
the earlier independent-review policy, not snarkjs prerequisites. See
[Self-Operated Screening Release](screening-self-operated.md) for the exact trust
assumptions, artifact pins, deployment procedure and generated activation evidence.
The historical QA record below does not claim the new release is live.

## Historical Status: Engineering Implemented, Production Disabled

October 22, 2026. Bridge-only proof generation now has a project-scoped GMR
Engine implementation and an application client. These changes are tested source,
not an activated production release. No custom validator or ERC-8004 endpoint was
restored, no live credential was issued, and no proof transaction was submitted.

This gate is not asking applicants to repeat the application flow as a substitute
for cryptographic review. It requires independent review and setup evidence for
the exact circuit and proving key used to certify them.

## Completed Engineering

- Engine owns isolated snarkjs workers; FluentXVerse has no local proving fallback.
- A dedicated Engine project's 15-signal policy pins the issuer, policy/schema,
  native verification key, network/domain and official receipt bridge. Callers
  cannot supply release paths, reviewer keys or artifact configuration.
- `GET /v1/screening/prover` starts asynchronous full release verification once
  per exact operator configuration. It checks signed reviews, setup history,
  phase one, contribution keys, final zkey/VK and the native zkVerify VK identity.
- `POST /v1/screening/proofs` is unavailable until verification succeeds. Setup
  and proof jobs share a single worker slot. Proofs have a three-minute timeout;
  setup verification has a 30-minute budget. Timeouts kill the worker process group.
- Workers receive only an allowlisted environment, with dotenv loading disabled.
  Engine/Vault signing credentials are excluded. Private witnesses are sent over
  stdin and are not put in the transaction journal. Responses are bounded and
  contain only explicit public/proof fields. No proof result claims certification.
- FluentXVerse requires the exact release-manifest pin and current policy,
  issuer, network, native VK and statement bindings. Public transport requires
  HTTPS; approved same-host/Docker transports may use HTTP. Redirects are refused.
- Issuance requires complete 30-question and ten-task evidence. Written answers
  and oral dimension scores are recomputed; shortened legacy attempts, invented
  acoustic scores and inconsistent percentages cannot qualify. This changes the
  policy hash; old policy approvals cannot activate this release.
- Existing consent, expiry, revocation and receipt gates remain in force.
- Stored proofs bind the exact release manifest and native VK. Rotation requires
  regenerating an unsubmitted proof; an already submitted or ambiguously dispatched
  proof requires reconciliation. Atomic proof/submission updates fence concurrent
  generation, withdrawal and revocation.

## What Is Still Required

1. An independent reviewer examines the circuit and evidence/issuance/acceptance
   code, records findings and signs approval over the exact final release manifest.
2. Select and verify a documented public phase-one setup. Obtain at least two
   independently operated phase-two contributions, with signed input/output hashes
   and contributor records. Two keys created by one developer do not establish
   independent operators or entropy destruction.
3. Obtain the setup review and final signed approvals. Pin reviewer and contributor
   public keys through a separate trusted channel. Internal QA is not that approval.
4. Install the reviewed release read-only in Engine. Configure a dedicated project
   using `gmr-engine/config/screening-prover.example.json`, not the shared ticket or
   anonymous-review project. Set `GMR_ENGINE_SCREENING_PROVER_PATH` to the operator
   file. Its trust pins must match that project's `GMR_ENGINE_ZKVERIFY_POLICY_PATH`.
5. Deploy the tested Engine/API changes, verify readiness, configure a dedicated
   real issuer key and the application's release/issuer/native-VK pins, then enable
   one consented tutor pilot. No development seed or test proving key is eligible.
6. Submit the approved proof through Engine, obtain its aggregation receipt, and
   verify it against the official Horizen bridge. Exercise expiry, withdrawal,
   revocation, replay and wrong-network rejection before expanding the rollout.

Verification failures remain blocked for that configuration. Investigate the cause
and restart Engine or install a corrected operator configuration; repeated HTTP
requests do not repeatedly run an expensive failed setup. A process restart clears
the verification cache and requires full verification again. Artifact hashes are
rechecked for each proof even after setup verification has succeeded.

## Review Handoff

The separate Engine checkout contains `scripts/prepare-screening-review.ts` and
the signed-release/ceremony workflow in `docs/proving-release-review.md`.
The handoff freezes the compiled circuit, dependency sources, current application
policy, evidence implementation and Engine integration, with per-file SHA256 pins.
It contains no production proving keys, private tutor evidence or issuer secrets.
It is labeled unreviewed and cannot activate certification.

Internal verification includes Go race tests, worker-secret/output/timeout tests,
application and Engine negative tests, real development Groth16 proving, signed
score-boundary witnesses and the Memgraph consent-withdrawal race. These do not
establish independent review, contributor independence or live bridge acceptance.

Whole-server TypeScript checks still report pre-existing mail-composer errors.
The screening changes introduce no additional TypeScript diagnostics.

## October 22 Handoff And QA Record

The final packet is in the separate Engine checkout at
`zk/screening/ceremonies/review-handoff-20261022-r2.tar.gz`.
Its transport SHA256 is
`1e0592318c31032036413786dd973156e0a1eeb9ad6ae329052464da6a045513`;
the enclosed handoff manifest SHA256 is
`7f665e2afbd12186e63386380f32a37f25f6bdc0a12d8717dc804358136f9806`.
The manifest pins 113 files and the current policy hash. It does not contain an
approved proving key or authorize activation.

Verification passed: 41 focused application Bun tests, 30 Engine Bun tests,
Engine HTTP/configuration Go race tests and `go vet`, one real development
Groth16 proof through the Engine worker, two accepted/seven rejected signed
score-boundary witnesses, and isolated Memgraph release-rotation, late-worker,
withdrawal and idempotency checks. Development proving keys remain rejected by
the production entry point. No funds were moved or live proofs submitted.

The running API/Engine images were not replaced for this work. Production
onboarding remains healthy; certification remains disabled until the outside
review/setup work and consented live pilot pass.
