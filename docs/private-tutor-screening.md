# Privately Verifiable Tutor Screening

October 13 source update: the default infrastructure is now bridge-only with
issuer-managed credentials and no ERC-8004 registration. See
[the new infrastructure runbook](bridge-only-trial-launch.md). The contract-based
v2 design below is retained only for explicit `legacy_contracts` mode.

## Implemented, Not Deployed

This is an isolated v2 pilot implementation. Production activation, agent registration,
contract deployment and real zkVerify/Horizen transactions have **not** occurred.
`SCREENING_ENABLED` defaults to disabled. Existing booking eligibility and v1 credentials
are not migrated or advertised as Horizen validations.

The ERC-8004 identity belongs to FluentXVerse's screening service. Tutors receive
credentials, not agent identities. A validation response of 100 means that a credential
passed validation; it is never a tutor's assessment score.

## Claim And Trust

The approved issuer signed results satisfying written >=90, speaking >=85, profile
approval and interview pass under `fluentxverse.tutor-screening.v2`.

The policy fixes score range, rubric, model configuration, aggregation method, required
human approvals and a 365-day lifetime. Policy and schema hashes are public inputs.
Changing policy or circuit requires reviewed artifacts and a new pinned validator.

This does **not** prove model execution, AI accuracy, genuine live speech, tutor identity
liveness, pronunciation quality or who personally answered the assessment. The current
speaking grader assesses Whisper transcripts. No TEE or zkML execution claim is made.

The issuer remains responsible for assessment provenance and authorized approvals.
The proof checks the signed statement, not raw assessment execution. Credentials carry
salted evidence and attempt commitments; evidence is not recomputed inside the circuit.

## Evidence And Privacy

- Written results come from completed exams owned by the tutor; scores are recomputed
  against their stored questions and answers. Completed submissions cannot be overwritten.
- Speaking submissions ignore client transcripts, transcribe submitted bytes on the
  server, bind recording/transcript hashes to the tutor, attempt and task, and reject
  malformed or out-of-range grader responses. Issuance verifies encrypted archived
  audio against the recorded hash. This authenticates the submission, not speaker liveness.
- Profile decisions are append-only snapshots with reviewer identity. Interview results
  must match the booked tutor and cannot overwrite finalized decisions. Issuance checks
  that reviewers are currently authorized operations administrators.
- Legacy approvals without reviewer snapshots and legacy audio without authenticated
  archives do not qualify. Obtain a new authorized approval or assessment; do not
  invent historical provenance or rely on cached pass flags.
- Audio archives and credential witnesses use AES-256-GCM with a dedicated 32-byte
  encryption key and context-bound authenticated data. Temporary proving inputs use
  a private directory and are deleted after success or failure.
- Mount `SCREENING_EVIDENCE_DIR` as a private durable volume. Protect and back up its
  key separately. Archives are local encrypted files, not public Seaweed objects.
  Existing exam results and interview records remain in the restricted application
  database; this change does not encrypt that entire database.
- No raw evidence download endpoint is added. Administrative mutations are audited.
  Establish archive retention, backup, key rotation and authenticated evidence-review
  procedures before expanding the pilot. Recording retention is not automated here.

Sharing is opt-in. A shared credential exposes the tutor identifier, its subject hash,
commitment, policy, issuer public key, proof and destination bindings, **not** exact
scores, answers, transcripts, audio or notes. The subject hash is
`SHA256(canonicalJson({tutorId})) mod BN254_FIELD`; partner verifiers compare it to
public signal 14 (zero-based). It is a public subject binding, not an anonymity claim.

Unsharing hides the HTTP artifact and profile badge, but cannot remove on-chain data.
Explicitly obtain tutor consent before submitting an ERC-8004 validation request.

## Verification Pipeline

1. An operations administrator issues an immutable, encrypted credential after evidence
   validation. Database uniqueness constraints protect IDs and commitments.
2. The server uses approved WASM, zkey and verification-key SHA256 pins to generate
   and locally verify Groth16 proofs. There is no automatic production trusted setup.
3. The zkVerify submission checks the native verification-key hash using SDK RPC,
   the configured domain, and exact expected statement. A finalized zkVerify
   transaction stays `awaiting_horizen_validation`, not certified.
4. The agent owner requests ERC-8004 validation using the hash of the exact public
   ABI payload served at `/screening/request/:commitment`.
5. The validator checks pinned issuer/policy/schema/VK, chain/agent/adapter bindings,
   lifetime, matching agent request, canonical fields, aggregation path and receipt
   through the pinned destination bridge. It records binary success only afterward.
6. Public verification reads the registry response **and** adapter validity. Revoked,
   expired, disabled, incomplete or unreachable verification never gets a v2 badge.

Public signals, in exact circuit order:

```text
valid, credentialCommitment, policyHash, schemaHash, issuerHash,
issuerAx, issuerAy, evidenceRoot, attemptHash, issuedAt, expiresAt,
chainId, agentId, adapterAddress, subjectHash
```

The request payload is ABI encoding of `(chainId, validationRegistry, adapterAddress,
agentId, zkVerifyVkHash, uint256[15] publicSignals)`, hashed with keccak256. It is
**not** the hash of a JSON serialization. Groth16 scalar bytes in the zkVerify leaf
are 32-byte little-endian values. The on-chain response hash is the verified leaf.
The native zkVerify VK hash is different from the JSON-file SHA256 artifact pin.

On-chain governance can revoke immediately and later call `syncRevocation` to update
the ERC-8004 response. `isCertified` rejects revocation even before synchronization.
The API marks revocation locally before queuing the governance transaction, but a
partner reading the chain sees revocation only after that transaction confirms.
An API-side revocation alone is insufficient; monitor and retry its on-chain outcome.

## Pilot Setup

### Engine Ownership

Screening chain orchestration now runs in GMR Engine, not FluentXVerse:
`/v1/screening/{check,payload,status,register,submit,request-validation,certify,revoke}`.
FluentXVerse uses the dedicated `GMR_SCREENING_ENGINE_API_BASE` and
`GMR_SCREENING_ENGINE_API_KEY`; the existing Base Sepolia ticket project's key
is not replaced. Assessment evidence, issuer signing and local proving stay in
the application; EVM reads/writes and zkVerify account/submission stay in Engine.
There is no zkVerify seed required in FluentXVerse screening configuration.
Legacy v1 tutor proofs and student lesson proofs also submit through Engine's
generic `/v1/zkverify/proofs` API using the existing application project. They
require Volta before broadcasting and remain legacy proofs, not v2 Horizen
certifications. No backend proof service directly opens a zkVerify account.

Engine loads project-scoped trust configuration from
`GMR_ENGINE_SCREENING_CONFIG_PATH`. The operator file is
`gmr-engine/config/screening-projects.json` in the separate Budol workspace,
mounted read-only into Engine. Signers are resolved from the authenticated
project's default Engine wallet; callers cannot choose another project's signer
or arbitrary destinations. The pilot uses the same wallet for governance.
Registration and certification have separate activation switches. Registration
can precede a completed credential deployment. Queued EVM operations use durable
project-scoped deduplication and remain attached after failure for reconciliation.
Proof submissions still require explicit reconciliation after uncertain outcomes;
do not directly repeat a timed-out Engine submission.

On 2026-10-11 the funded project was confirmed to allow Horizen testnet, its
default wallet held 0.018 ETH, and its existing Engine-managed Volta account was
funded. Official zkVerify documentation lists testnet domain 175 and bridge
`0x3098A6974649478f0133046e44105AA84e868C21`; Engine RPC confirmed deployed
code there. This is not yet an end-to-end receipt test. The canonical ERC-8004
testnet identity address `0x8004A818BFB912233c491871b3d84c89A494BD9e`
had no code on Horizen testnet. No approved Horizen identity/validation registry
has been installed, so registration and certification remain disabled.

The supplied project key is stored only in ignored server configuration. Rotate
it after setup because it was shared in chat. No seed phrase was imported.

Use `fluentxverse-server/config/screening.env.example` as the configuration checklist.
Keep dedicated issuer/encryption/submission secrets server-side. Do not reuse JWT
secrets, browser keys or any deterministic keys from tests.

1. Obtain approved ERC-8004 identity and validation registries and a functioning
   zkVerify aggregation receipt bridge on the selected Horizen network. Verify the
   validation registry's identity registry. No bridge or registry address is guessed
   or inferred from a Base deployment.
2. Add Horizen's chain and RPC to the GMR Engine project allowlist. Current Horizen
   testnet is chain **2651420**; mainnet is **26514**. Base Sepolia **84532** is not
   Horizen. Use a funded Engine/Vault signer for the agent and separate governance
   if appropriate. This implementation does not change the existing Engine allowlist.
3. Complete an independently reviewed Groth16 setup, pin all three artifacts, derive
   the approved issuer public-key hash, and obtain the native zkVerify VK hash.
   The `test-only` zkey uses development entropy and **must not** be deployed.
4. Register the agent, confirm the identity registry Transfer event and configure the
   actual agent ID. Deploy the reviewed validator with immutable trust roots.
   ERC-8004 is a draft; confirm the chosen deployed ABI and registry behavior.
5. Mount and protect durable encrypted evidence storage, enable the flag, collect
   a fresh test tutor's evidence and explicit sharing consent, then use the API below.
6. Confirm successful real zkVerify submission, aggregation path, bridge receipt,
   Engine transaction confirmations and independent partner verification. Test
   expiry, revocation, wrong tutor/policy/issuer, network failure and replay before
   wider rollout. Submit receipt details explicitly for the pilot; an automated
   aggregation watcher and transaction reconciliation worker are not implemented.

## API

All responses are `no-store`. Tutor reads use a tutor-role cookie. Administrative
mutations require an operations administrator, approved dashboard Origin and rate
limits. Sharing requires the owning tutor and approved tutor Origin.

```text
GET  /screening/policy
GET  /screening/agent.json
GET  /screening/me
POST /screening/:commitment/share                 {shared: boolean}
GET  /screening/public/:commitment
GET  /screening/tutor/:tutorId
GET  /screening/request/:commitment               exact ABI bytes

POST /screening/admin/register-agent
POST /screening/admin/issue/:tutorId
POST /screening/admin/:commitment/prove
POST /screening/admin/:commitment/submit
POST /screening/admin/:commitment/request-validation
POST /screening/admin/:commitment/certify          {aggregationId, merklePath, leafCount, index}
POST /screening/admin/:commitment/revoke
```

Receipt integers are decimal strings and path members are bytes32 hex strings.
Queued Engine transactions never return certified=true. Record their transaction
IDs and confirm receipts. An interrupted zkVerify submission remains claimed as
`submitting_zkverify`; reconcile its chain evidence rather than blindly resubmitting.
Use one pilot prover process; distributed proving job coordination and automatic
reconciliation remain rollout work. Do not expose unaudited operator endpoints broadly.

Tutor profiles show private progress and sharing consent. Student tutor profiles show
a v2 badge only after successful current verification, with the exact claim and
limitations. V1 badges are labeled separately. Batch discovery badges, a richer
independent verification page and an administrator operator console are follow-up
work; the current public JSON artifact is available for partner integrations.

## Verification Run

```bash
cd fluentxverse-server
bun test tests/screening.test.ts tests/screening.http.test.ts
bun run tests/screening.circuit.ts

cd ../contracts/screening
npm ci --workspaces=false --ignore-scripts
npm test
node browser.cjs
```

The circuit test needs locally compiled WASM, a development-only contributed
`build/test-only.zkey`, and its `build/test-only-vk.json`. Compile with circom and
circomlib; do not let this test prepare or approve production keys. Contract tests
use mock registry/receipt contracts in a local EVM; they are not a live bridge test.
Browser tests use existing student/tutor development servers on 5176/5177 with
isolated fixtures. `tests/screening.persistence.ts` requires a fresh disposable
Memgraph container at `127.0.0.1:7699`, never the production database.

## References

- [ERC-8004 specification](https://eips.ethereum.org/EIPS/eip-8004)
- [zkVerify receipt verification and leaf encoding](https://docs.zkverify.io/overview/getting-started/smart-contract)
- [Horizen testnet configuration](https://docs.horizen.io/horizen-chain/network/testnet/)
- [Horizen mainnet configuration](https://docs.horizen.io/horizen-chain/network/mainnet/)
