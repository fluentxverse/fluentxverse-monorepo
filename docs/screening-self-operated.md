# Self-Operated Screening Release

## Live Pilot Record

October 23: production Engine/API images are installed and application
certification is enabled after the exact-release mainnet pilot passed finality.
The synthetic screening proof finalized on zkVerify in transaction
`0x89a986a4a8441495f5e8fa8481b396592997bdee6dc768fd926730311b1a5d33`.
Domain 3 aggregation 5423 was relayed to the official Horizen bridge in transaction
`0x47507e7ec57cdbd3645f0e3406d8b361120bf037f4ba01ddf5a45977c6666415`,
block 29325205. The receipt verified against canonical finalized Horizen block
29325617, hash
`0x44b55935dd53664333f1159f64cb4cb02e9ceaa36577cee17dbead214c429315`.
The official bridge accepted domain 3 / aggregation 5423 / leaf count 1 / index 0.
The pilot completed at `2026-10-23T02:58:46.792Z`; production activation followed
after the synthetic credential was revoked and lifecycle tests passed.
`pilot.json` and `activation.json` below record the completion evidence. No real
applicant was certified by this synthetic QA.

Internal checks passed: 42 application tests, 32 Engine script tests, Go race tests
and vet, isolated Memgraph consent/rotation/concurrency tests, and production-image
setup verification without signer credentials. Full API TypeScript checking still
reports the existing unrelated mail-composer errors; no new screening diagnostics.

Production images: `budol-gmr-engine:screening-self-operated-20261022` and
`fluentxverse-server:screening-self-operated-20261022`. Other application services
and policies were preserved. The temporary QA containers were removed. Actual
issuance still requires complete authorized evidence, and chain publication still
requires the tutor's sharing consent. Enabling the feature does not migrate legacy
credentials or automatically approve applicants.

## Policy

The October 22 operator decision permits a self-operated Groth16 setup for
`tutor-screening.v2`. External contributors and an independent audit are not
snarkjs protocol prerequisites. They remain available as a stronger assurance
policy, not a claim made by this release. Confidential payouts are unchanged.

Both phases of this release use fresh production-only BN254 parameters and OS
randomness generated inside short-lived native snarkjs workers. Phase one uses
power 13, sufficient for the frozen 5,771-constraint screening circuit. Phase two
has one random contribution. Neither phase reuses a development ptau or zkey.
No wallet seed, issuer key or user evidence is used as setup randomness.

The operator must be trusted to run the setup correctly and destroy its secret
randomness. Process exit and buffer clearing are mitigations, not proof of
destruction. Retained setup secrets could undermine proof soundness. This is
**not independently audited or an independently operated multi-party ceremony**.

A downloaded Hermez phase-one file matched snarkjs's published BLAKE2b digest,
but its full verification was stopped before completion because recomputing its
original power-28 transcript was impractical for routine startup here. It is not
the phase-one file used by this release. That incomplete attempt is retained
separately and must not be mistaken for approved artifacts.

## Verification And Pins

Engine retains full cryptographic phase-one and zkey verification, contribution
history checks, reproducible build hashes, exact exported VK equality, native
zkVerify key identity, and operator-signed artifact metadata. Every proof checks
the pinned release again. An uncontributed initial Groth16 key is still rejected.

The self-operated policy must be explicitly selected by both the Engine operator
configuration and application environment. A self-operated manifest cannot satisfy
the default independent-review policy. Its readiness response and public credential
metadata disclose the lower assurance; a signature is not presented as an audit.

Frozen build SHA256:
`6dda6e2dd5de1b795ced8909bb18fa2e75bd644e7c3321a558e1934088294adc`.

Release manifest SHA256:
`1e1f74e8fcdc9afd60b469fae94ce2aba5b34270b0e3803194db2961ac9fd96d`.

Native zkVerify VK hash:
`0xf542724cb608260727e9a387b46796d1c22a8e1a3c425358e4e25a8c23a1ea3b`.

## Runtime

Proving and signing transactions remain in GMR Engine / Vault. The application
issues signed screening credentials and stores private evidence in its restricted
Memgraph/encrypted recording infrastructure. It has no local proving fallback.

The dedicated Engine project is `FluentXVerse Screening Mainnet`, a module of the
existing FluentXVerse project. Its policy pins 15 public signals, the current
issuer/policy/schema, zkVerify mainnet, domain 3, Horizen chain 26514 and the official
receipt bridge `0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69`.
Other Engine project policies are preserved.

No custom Solidity verifier, ERC-8004 registry or application validator is deployed.
Engine locally verifies proofs before submission to zkVerify. Certification
requires the finalized proof's exact statement in the existing official Horizen
bridge, plus current expiry, revocation and consent checks. Native verification
alone is not labeled Horizen certification.

Scores, answers, transcripts, audio and reviewer notes remain off the public chain.
Shared credentials intentionally expose subject linkage and public bindings, not
an anonymous identity. The proof establishes issuer-authorized screening results,
not that AI executed accurately or that a person actually taught/spoke.

## Operations

Operator-only scripts, run from the monorepo:

1. `node scripts/prepare-screening-production.mjs --self-phase-one --setup`
   creates fresh artifacts. It refuses to overwrite an existing release.
2. `node scripts/deploy-screening-production.mjs --prepare` builds scoped images,
   reproduces the live Engine binary baseline and runs focused tests.
3. `node scripts/deploy-screening-production.mjs --verify-image` performs full
   setup verification inside the candidate Engine image without signer credentials.
4. `node scripts/deploy-screening-production.mjs --deploy-disabled` installs the
   configuration/images with application certification disabled.
5. `node scripts/run-screening-production-pilot.mjs --live` uses an empty isolated
   Memgraph and clearly synthetic evidence, submits one real proof, reconciles its
   receipt without resubmission, and tests negative/lifecycle cases. Its network
   transaction fee is real. No actual applicant is certified by this QA run.
6. `node scripts/deploy-screening-production.mjs --enable` requires the exact-release
   successful pilot record and negative tests before enabling the application.

Do not rerun a pilot after an ambiguous submission. Its persisted intent/result
must be reconciled through the dedicated Engine project first. Chain publication
is irreversible even when an application credential is revoked or unshared.

After a finalized submission, `node scripts/run-screening-production-pilot.mjs
--reconcile` reads that exact Engine proof record and checks its receipt without
issuing a new credential, generating another proof or submitting a transaction.
If the bridge receipt is available, it recreates only the synthetic public QA
credential in an empty isolated graph and performs certification/revocation checks.
Never run it concurrently with the original pilot. A pending aggregation remains
pending; it does not satisfy the activation gate.

Private backups, issuer seed, scoped API key and rollback Compose files live under
`~/.local/state/fluentxverse/screening-production-20261022`, not Git. Existing
recording-encryption keys are preserved. Proving artifacts are read-only in Engine.

Release evidence is generated under `output/release/screening-production-20261022`:
`candidate.json`, `image-verification.json`, `deployment.json`, `pilot.json`, and
`activation.json`. Only a successful `activation.json` establishes completion;
the existence of source code, an internal signature or a prepared image does not.
