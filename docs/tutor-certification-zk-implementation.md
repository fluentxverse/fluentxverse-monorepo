# Tutor Certification ZK Implementation

Last updated: 2026-05-04

## Executive Summary

FluentXVerse now has a working zero-knowledge tutor certification flow for the tutor app. The implementation is not a static badge or a simple database flag. It is a full proof pipeline that:

1. Collects tutor certification facts from the real onboarding workflow.
2. Builds a private certification witness.
3. Generates a Circom/Groth16 proof locally.
4. Verifies that proof locally with `snarkjs`.
5. Submits the proof to zkVerify Volta through `zkverifyjs`.
6. Persists the finalized zkVerify transaction metadata.
7. Exposes proof state to tutor, student, public, and admin surfaces.
8. Automatically attempts zkVerify submission when a tutor completes all certification requirements.

The first verified proof was successfully finalized on zkVerify Volta:

```text
txHash: 0x7120ae27b2bb6bfba6468e291947016b1903260ed9706444298e72292d6bbdc7
blockHash: 0xe8a370e14679a9bd9ea6f634f4228550f801dc3a4e3eb63a41ffc5fc4a3bda17
proofType: groth16
domainId: 0
aggregationId: 269566
statement: 0x1983e6c9af3bea6e4e996a1eeb5ec909c0c0aebd62e977c59ba2201f584c626d
status: finalized
```

This proves that the implemented pipeline can produce a real Groth16 proof and have zkVerify finalize it on-chain.

## Product Goal

The product goal is to make FluentXVerse tutor certification independently verifiable without exposing private tutor assessment details.

A student, admin, partner, or ecosystem reviewer should be able to see that a tutor is certified through a ZK-backed proof, while the platform avoids publicly leaking the tutor's raw written exam result, speaking exam result, AI assessment details, interview rubric, or identity-linked internal artifacts.

## What The Proof Means

The proof statement is:

> FluentXVerse issued a tutor certification credential for a tutor who satisfied the private certification rules: written exam score threshold, speaking exam score threshold, profile approval, and interview pass.

The public verifier sees a commitment and issuer/circuit metadata. The verifier does not need to see all private assessment data.

### Current Certification Requirements

The tutor certification proof currently requires:

| Requirement | Source | Circuit Constraint |
| --- | --- | --- |
| Written exam passed | Tutor written exam workflow | `writtenScore >= 90` |
| Speaking exam passed | Tutor speaking exam workflow | `speakingScore >= 85` |
| Profile approved | Admin profile review | `profileApproved == 1` |
| Interview passed | Tutor interview flow | `interviewPassed == 1` |

The written and speaking assessment flows are AI-assisted in the app. The circuit itself does not run AI. Instead, the system records the AI assessment outputs and turns the certification facts into a signed credential that the circuit verifies.

## Why This Is A Real Implementation

This is a real implementation because it contains all of the core parts of a production ZK workflow:

1. **Real source-of-truth data**
   - The inputs come from Memgraph records produced by the existing tutor onboarding, exam, profile review, and interview flows.

2. **Actual Circom circuit**
   - The circuit is written in Circom.
   - It uses Poseidon commitments.
   - It verifies an EdDSA-Poseidon issuer signature.
   - It enforces numeric and boolean constraints.

3. **Actual Groth16 proof generation**
   - The server compiles the circuit.
   - The server performs Groth16 setup.
   - The server generates a witness.
   - The server generates `proof.json` and `public.json`.
   - The server verifies the proof locally before persisting it.

4. **Actual zkVerify submission**
   - The server submits the generated Groth16 proof, verification key, and public signals to zkVerify Volta.
   - A real finalized zkVerify transaction was produced and persisted.

5. **Operational integration**
   - The tutor certification workflow is triggered from real app events.
   - Admins can monitor proof state.
   - Admins can retry failed or pending proof submissions.
   - Students see ZK certification state on tutor cards and tutor profiles.

This is not just a UI claim, metadata badge, or mock endpoint.

## High-Level Architecture

```text
Tutor onboarding events
  written pass
  speaking pass
  profile approved
  interview pass
        |
        v
Certification snapshot builder
        |
        v
AI assessment records + credential record
        |
        v
Circom witness input builder
        |
        v
Local Groth16 proof generation
        |
        v
Local snarkjs verification
        |
        v
zkVerify Volta submission
        |
        v
Persist tx hash, block hash, status, aggregation id
        |
        v
Tutor dashboard, student browse/profile, admin monitoring, public lookup
```

## Main Files

### Circuit

```text
fluentxverse-server/circuits/tutor-certification/tutor_certification.circom
fluentxverse-server/circuits/tutor-certification/README.md
```

### Backend Proof Services

```text
fluentxverse-server/src/services/proof.services/proof.interface.ts
fluentxverse-server/src/services/proof.services/tutorCertificationProof.service.ts
fluentxverse-server/src/services/proof.services/localGroth16.service.ts
fluentxverse-server/src/services/proof.services/zkVerifySubmit.service.ts
fluentxverse-server/src/services/proof.services/tutorCertificationWorkflow.service.ts
```

### Backend Routes

```text
fluentxverse-server/src/routes/proof.route.ts
fluentxverse-server/src/routes/admin.route.ts
```

### Workflow Trigger Points

```text
fluentxverse-server/src/services/exam.services/exam.service.ts
fluentxverse-server/src/services/exam.services/speaking.service.ts
fluentxverse-server/src/services/interview.services/interview.service.ts
fluentxverse-server/src/services/admin.services/admin.service.ts
```

### UI Surfaces

```text
fluentxverse-tutor/src/api/proof.api.ts
fluentxverse-tutor/src/Components/Dashboard/DashboardOverview.tsx
fluentxverse-tutor/src/Components/ProtectedRoute.tsx

fluentxverse-student/src/pages/BrowseTutorsPage.tsx
fluentxverse-student/src/pages/TutorProfilePage.tsx
fluentxverse-student/src/types/tutor.types.ts

fluentxverse-dashboard/src/api/admin.api.ts
fluentxverse-dashboard/src/pages/TutorsPage.tsx
fluentxverse-dashboard/src/pages/TutorsPage.css
```

### Deployment

```text
fluentxverse-server/Dockerfile
fluentxverse-server/docker-compose.yml
fluentxverse-server/.env.example
fluentxverse-server/.gitignore
```

## Circuit Implementation

The circuit is `TutorCertification`.

It receives private inputs:

```text
writtenScore
speakingScore
profileApproved
interviewPassed
subjectHash
credentialNonce
signatureR8x
signatureR8y
signatureS
```

It exposes public inputs:

```text
credentialCommitment
credentialTypeHash
schemaVersionHash
issuerHash
issuerAx
issuerAy
assessmentRoot
```

### Constraints

The circuit enforces:

```text
writtenScore >= 90
speakingScore >= 85
profileApproved == 1
interviewPassed == 1
credentialCommitment == Poseidon(subjectHash, credentialNonce)
issuerHash == Poseidon(issuerAx, issuerAy)
issuer signature is valid over the credential message
```

The credential message is a Poseidon hash of:

```text
writtenScore
speakingScore
profileApproved
interviewPassed
credentialCommitment
credentialTypeHash
schemaVersionHash
issuerHash
assessmentRoot
```

### Why EdDSA-Poseidon Is Included

The circuit does not merely check arbitrary private numbers. It verifies that FluentXVerse, as issuer, signed the credential message. This matters because otherwise a malicious prover could invent private scores that satisfy the thresholds.

The issuer signature ties the proof to a credential issued by FluentXVerse.

### Why Poseidon Is Used

Poseidon is used because it is efficient inside arithmetic circuits. Standard hashes like SHA-256 are possible in ZK circuits, but they are more expensive. For a Groth16 circuit that needs commitments and message hashes, Poseidon is the practical choice.

## Backend Credential Model

The proof service creates and updates `TutorCertificationCredential` nodes.

Important fields include:

```text
id
tutorId
status
credentialCommitment
schemaVersion
circuitVersion
proofSystem
issuer
publicSignals
missingRequirements
localProofHash
localPublicSignalsHash
localVerificationKeyHash
localProofVerified
zkVerifyTxHash
zkVerifyBlockHash
zkVerifyTransactionStatus
zkVerifyProofType
zkVerifyDomainId
zkVerifyAggregationId
zkVerifyStatement
zkVerifyLastError
issuedAt
expiresAt
updatedAt
```

The status lifecycle is:

```text
requirements_incomplete
ready_for_proving
local_proof_generated
submitted
verified
failed
```

## Certification Snapshot

The certification snapshot aggregates the tutor's current status from the database.

It includes:

```text
tutorId
email
walletAddress
smartWalletAddress
writtenPassed
writtenScore
writtenPassedAt
writtenExamId
speakingPassed
speakingScore
speakingPassedAt
speakingExamId
profileApproved
profileStatus
interviewPassed
interviewCompletedAt
interviewSlotId
interviewResult
interviewRubricScores
missingRequirements
```

If any required item is missing, the proof remains `requirements_incomplete`.

If all requirements are present, the credential becomes `ready_for_proving`.

## AI Assessment Records

The implementation creates `AiAssessmentRecord` records for:

```text
written
speaking
interview
```

These records preserve the provenance of the assessment inputs. They connect the certification proof to the app's AI-assisted evaluation workflow without exposing raw assessment artifacts publicly.

This is important because the ZK proof is not just proving a manual admin flag. It is proving the result of a multi-step, AI-assisted qualification workflow.

## Local Groth16 Pipeline

The local Groth16 proof pipeline is implemented in:

```text
fluentxverse-server/src/services/proof.services/localGroth16.service.ts
```

The service performs:

1. Toolchain checks:
   - `circom`
   - `snarkjs`
   - `node`

2. Circuit compilation:
   - `tutor_certification.circom`
   - R1CS generation
   - WASM witness generator generation

3. Local Powers of Tau setup:
   - Uses power size 14.
   - Produces the local `.ptau` files needed for setup.

4. Groth16 setup:
   - Produces the `.zkey`.
   - Exports `verification_key.json`.

5. Witness and proof generation:
   - Writes `input.json`.
   - Generates `witness.wtns`.
   - Generates `proof.json`.
   - Generates `public.json`.

6. Local verification:
   - Runs `snarkjs groth16 verify`.
   - Only persists local proof metadata after verification succeeds.

7. Persistence:
   - Stores proof hashes.
   - Stores artifact paths.
   - Sets credential status to `local_proof_generated`.

Generated proof artifacts are intentionally ignored by git:

```text
zk-artifacts
circuits/**/build
*.r1cs
*.sym
*.zkey
*.ptau
verification_key.json
```

## zkVerify Submission

The zkVerify submission service is:

```text
fluentxverse-server/src/services/proof.services/zkVerifySubmit.service.ts
```

It uses:

```text
zkverifyjs
Library.snarkjs
CurveType.bn128
Volta network
Groth16 proof type
```

The service:

1. Generates or reuses the local proof pipeline.
2. Reads:
   - `proof.json`
   - `public.json`
   - `verification_key.json`
3. Opens a zkVerify Volta session with the configured Substrate mnemonic.
4. Executes zkVerify Groth16 verification.
5. Awaits the transaction result.
6. Persists:
   - tx hash
   - block hash
   - proof type
   - domain id
   - aggregation id
   - statement
   - finalized/submitted status

If zkVerify returns `finalized`, credential status becomes:

```text
verified
```

## Automatic Submission Workflow

The workflow wrapper is:

```text
fluentxverse-server/src/services/proof.services/tutorCertificationWorkflow.service.ts
```

It is called after each relevant tutor-certification event:

```text
written_exam_passed
speaking_exam_passed
profile_approved
interview_passed
```

The workflow:

1. Refreshes the tutor certification credential.
2. Checks whether requirements are complete.
3. Checks whether the credential is already `submitted` or `verified`.
4. Checks whether zkVerify submission is configured.
5. Generates local proof.
6. Submits to zkVerify.
7. Persists success or failure.

This is intentionally idempotent. Repeated calls should not duplicate submissions for an already submitted or verified credential.

## Admin Retry Flow

Admins can retry proof submission from the tutor management table.

Backend route:

```text
POST /admin/tutors/:tutorId/proof/retry
```

Frontend method:

```text
adminApi.retryTutorProofSubmission(tutorId)
```

This exists because proof submission depends on external infrastructure:

```text
zkVerify RPC availability
server proving toolchain
wallet funding
network finality
domain configuration
```

If the automatic submission fails, the admin sees `failed` and can retry without manually touching the database.

## Public And Private APIs

### Public Credential Lookup

```text
GET /proof/tutor-certification/public/:credentialCommitment
```

This returns non-secret credential metadata:

```text
tutor display info
credential status
credential commitment
schema version
circuit version
proof system
issuer
public signals
local proof hashes
zkVerify tx hash
zkVerify aggregation id
zkVerify transaction status
zkVerify domain id
```

The route does not expose private witness inputs.

### Tutor Proof Status

```text
GET /proof/tutor-certification/me
POST /proof/tutor-certification/maybe-issue
POST /proof/tutor-certification/generate-local
POST /proof/tutor-certification/submit-zkverify
```

These routes are authenticated with the tutor cookie.

### Admin Proof Retry

```text
POST /admin/tutors/:tutorId/proof/retry
```

This route is protected by the admin guard.

## UI Integration

### Tutor Dashboard

The tutor dashboard shows ZK certification progress and proof status.

It can distinguish:

```text
requirements incomplete
ready for proving
local proof generated
submitted
verified
failed
```

### Student Browse Tutors

The student browse page shows proof badges:

```text
ZK Proof Ready
zkVerify Pending
ZK Verified
```

`ZK Verified` is only shown when the credential status is `verified`.

This avoids overclaiming. A locally generated proof is useful, but it is not represented as on-chain verified until zkVerify finalizes it.

### Student Tutor Profile

The tutor profile page shows the same ZK proof states and links to the public proof lookup when a credential commitment exists.

### Admin Tutor Management

The admin tutor table now includes a `ZK Proof` column.

Admins can see:

```text
Incomplete
Ready
Local Proof
Submitted
Verified
Failed
Tx hash
Aggregation id
Last error
```

Admins can retry proof submission for certified tutors that are not already submitted or verified.

## Environment Variables

Required for real zkVerify submission:

```text
ZKVERIFY_SEED_PHRASE
ZKVERIFY_DOMAIN_ID
ZKVERIFY_ENABLED
```

Required for credential issuing:

```text
TUTOR_CERT_ISSUER_ID
TUTOR_CERT_ISSUER_SECRET
TUTOR_CERT_COMMITMENT_SALT
```

Docker Compose passes these to the server container.

Important security note:

Do not commit `.env` or any real seed phrase. Use a testnet/disposable wallet for development and a properly managed operational wallet for production.

## Deployment Toolchain

The server Docker image includes:

```text
circom v2.1.9
nodejs
npm
snarkjs@0.7.6
bun runtime
```

This matters because proof generation requires native tooling. The Dockerfile makes the backend container self-sufficient for local proving and zkVerify submission.

## Practicality Explanation

This implementation is practical because it fits the existing app instead of requiring a separate ZK application.

### It Uses Existing Tutor Milestones

The proof uses milestones FluentXVerse already needs:

```text
written exam
speaking exam
profile review
interview
```

No artificial user behavior is required just to create proof volume.

### It Has A Natural Buyer/User Benefit

Students care whether tutors are qualified. Tutors care that their certification is portable and credible. Admins care that certification state is auditable.

The proof makes that claim more credible than an internal badge.

### It Protects Tutor Privacy

The proof avoids publicly disclosing raw assessment scores and internal AI/interview details. Public users can verify that certification rules were satisfied without seeing the private witness.

### It Creates Repeatable Verification Volume

Every new certified tutor can generate a proof and submit it to zkVerify. Future renewals or upgraded credentials can also generate proof activity.

### It Is Operationally Manageable

The admin retry flow makes external-chain failure recoverable. The status lifecycle makes it clear where a tutor is stuck.

## Justification For zkVerify

zkVerify is a good fit because the application needs proof verification at scale, but FluentXVerse should not need to deploy and maintain custom verifier contracts for every credential use case at the start.

zkVerify provides:

```text
Groth16 proof verification
proof transaction finalization
aggregation metadata
public verification receipt
Web3-native proof infrastructure
```

## Use Case Alignment

### Authenticity Verification

The proof verifies that a tutor's certification was issued by FluentXVerse and satisfies the credential rules.

### Activity Tracking

The system tracks certification and proof state from onboarding through zkVerify finalization.

### Fairness Validation

The same proof thresholds are applied to every tutor:

```text
writtenScore >= 90
speakingScore >= 85
profileApproved == 1
interviewPassed == 1
```

### Machine Learning Verification

The written and speaking assessment flows are AI-assisted. The ZK proof ties the final AI-assisted qualification result into a verifiable credential path.

### Confidentiality Protection

The proof publicly verifies certification without exposing raw assessment details.

## Trust Model

The current trust model is:

1. FluentXVerse is the issuer of tutor credentials.
2. FluentXVerse verifies tutor onboarding data from the app database.
3. FluentXVerse signs the credential facts with an issuer key.
4. The circuit verifies the issuer signature.
5. zkVerify verifies the resulting Groth16 proof.

This means the proof proves:

```text
FluentXVerse issued a credential whose private facts satisfy the circuit.
```

It does not prove that Google, a school, or a government directly certified the tutor. External authority proofs can be added later.

## What Is Private

Private or non-public:

```text
raw written score witness
raw speaking score witness
profileApproved witness
interviewPassed witness
subject hash preimage
credential nonce
issuer signature values
internal assessment artifacts
interview rubric details
AI prompt/output artifacts
wallet seed phrase
issuer secret
commitment salt
```

Some of these values exist in server-side records or generated artifacts, but they are not public proof outputs.

## What Is Public

Public proof metadata:

```text
credentialCommitment
credentialTypeHash
schemaVersionHash
issuerHash
issuer public key fields
assessmentRoot
zkVerify tx hash
zkVerify block hash
zkVerify statement
zkVerify aggregation id
proof status
circuit version
schema version
proof system
```

## Limitations

### Local Setup Is Development Grade

The current Groth16 setup is generated locally. For production credibility, a proper trusted setup process or a documented ceremony should be considered.

### Issuer Trust Still Matters

The proof depends on FluentXVerse as issuer. It proves the platform issued a credential according to the circuit, not that an external third party independently certified the tutor.

### AI Model Provenance Is Not Fully ZK-Proven

The proof currently proves certification facts derived from AI-assisted assessment workflows. It does not prove the exact AI model execution, prompt, or transcript inside the circuit.

### zkVerify Wallet Funding Is Required

Automatic submission uses the configured zkVerify wallet. If the wallet lacks testnet funds, submission will fail and admin retry will be needed after funding.

### Artifact Storage Needs Production Hardening

Proof artifacts are written to local server paths. For production scale, this should move to durable object storage or be regenerated deterministically as needed.

## Security Considerations

1. Keep `ZKVERIFY_SEED_PHRASE` out of source control.
2. Keep `TUTOR_CERT_ISSUER_SECRET` out of source control.
3. Rotate any test wallet whose secret was exposed during development.
4. Use a dedicated relayer wallet for proof submission.
5. Monitor failed proof submissions.
6. Avoid exposing witness inputs through public APIs.
7. Keep generated proof artifacts out of git.
8. Consider rate limits for proof generation and retry endpoints.

## Operational Runbook

### Verify Local Toolchain

Inside the server environment:

```bash
circom --version
snarkjs --version
node --version
```

### Generate Local Proof

Authenticated tutor route:

```text
POST /proof/tutor-certification/generate-local
```

Service:

```text
generateLocalTutorCertificationProof(tutorId)
```

Expected result:

```text
status: local_proof_generated
localProofVerified: true
proofHash present
publicHash present
verificationKeyHash present
```

### Submit To zkVerify

Authenticated tutor route:

```text
POST /proof/tutor-certification/submit-zkverify
```

Admin retry route:

```text
POST /admin/tutors/:tutorId/proof/retry
```

Service:

```text
submitTutorCertificationProofToZkVerify(tutorId)
```

Expected successful result:

```text
status: finalized
credential status: verified
zkVerifyTxHash present
zkVerifyAggregationId present
```

### Check Public Proof

```text
GET /proof/tutor-certification/public/:credentialCommitment
```

Expected result:

```text
success: true
credential.status: verified
credential.zkVerifyTxHash: present
credential.zkVerifyAggregationId: present
```

## Testing Completed

The following were tested during implementation:

1. Server TypeScript typecheck:

```text
bun run typecheck
```

2. Student app build:

```text
npm run build
```

3. Dashboard app build:

```text
npm run build
```

4. Local Groth16 proof generation and local verification:

```text
snarkjs groth16 verify returned OK
```

5. Docker server proof generation:

```text
POST /proof/tutor-certification/generate-local returned verified local proof metadata
```

6. Real zkVerify submission:

```text
zkVerify Volta transaction finalized
```

7. Public proof lookup:

```text
GET /proof/tutor-certification/public/:credentialCommitment returned verified proof metadata
```

8. Admin service proof monitoring:

```text
test tutor returned status certified, zkCertificationStatus verified, tx present, aggregation id present
```

## Current Verified Test Credential

The test tutor used for the first end-to-end verification:

```text
tutorId: zk-local-test-tutor
credential status: verified
proof type: groth16
zkVerify status: finalized
aggregation id: 269566
```

The related zkVerify transaction:

```text
0x7120ae27b2bb6bfba6468e291947016b1903260ed9706444298e72292d6bbdc7
```

## Future Improvements

### Public Proof Page

The public proof endpoint currently returns JSON. A polished public proof page should show:

```text
ZK Verified Tutor Certification
tutor display name
credential status
zkVerify tx hash
aggregation id
circuit version
schema version
what was proven privately
```

### Gmail Or Google Account Proof

A future circuit can add a Google OAuth verified email commitment:

```text
googleEmailVerified == 1
emailDomain == gmail.com or googlemail.com
emailCommitment == Poseidon(emailHash, nonce)
```

This would let the app prove that a tutor controls a verified Google/Gmail identity without revealing the email address publicly.

### Tutor Reputation Proof

A second ZK use case could prove:

```text
minimum completed sessions
minimum average rating
no active suspension
student review count threshold
```

without exposing individual student reviews.

### Lesson Completion Proof

Another useful proof could verify student attendance or lesson completion without exposing detailed class notes.

### Production Trusted Setup

For production-grade assurance, consider:

```text
documented trusted setup ceremony
external verifier review
versioned circuit releases
artifact checksums
CI proof tests
```

## Conclusion

The tutor certification ZK implementation is a complete working vertical slice:

```text
real app data
AI-assisted tutor assessment workflow
Circom circuit
Groth16 proof generation
local proof verification
zkVerify finalization
public proof lookup
student-facing proof badges
admin monitoring and retry
automatic proof submission on certification completion
```

It is practical because it attaches ZK verification to a real business workflow the platform already needs. It creates meaningful proof activity while demonstrating privacy-preserving credential verification in an education marketplace.
