# Identity Credential Pilot

Historical pilot record. Production issuance was separately activated November 3, 2026; see
[production issuance and activation requirements](tutor-identity-production.md).
The separate activation preserves the pilot's TEST designation. The pilot-specific
deployment facts below remain historical and must not be treated as mainnet evidence.

This is a TEST-only identity credential implementation. Production identity issuance
is explicitly disabled in the worker, even if a production manifest is supplied.
Do not represent this pilot as production KYC or an independent government ID check.

## Statement And Privacy

The new `circuits/tutor-identity-v1/tutor_identity.circom` circuit verifies a dedicated
issuer's EdDSA-Poseidon signature over a claim that staff confirmed adulthood, matched
the same ID live, and passed the interview. It binds the credential commitment to the
recipient wallet, collection, chain, policy, issuance time and TEST flag. It does not
inspect an ID image or independently establish that a government issued a document.

Private inputs contain random secrets, three approval flags and the issuer signature.
They contain no names, email addresses, document numbers, dates of birth, document
images, unsalted document hashes or internal applicant identifiers. The recipient and
verification claim are public. A separate, unchecked-by-default wallet-publication
consent is stored against the current submission and exact managed-wallet address.
The previous ID-review consent is not silently treated as blockchain-publication consent.

## Automatic Flow

1. Live ID matching only verifies identity; it does not create a credential request.
2. Interview pass commits the request with the result under the applicant lock.
3. An independently scheduled, single-flight worker claims jobs with durable leases.
   Slow proving or external-chain requests do not block ID retention or review mail.
4. The worker rechecks current identity, interview, ban state, wallet binding and consent.
5. It signs the attestation, generates a Groth16 proof, locally verifies it, and checks
   all public signals against the pinned manifest. Temporary witness files are removed.
6. Before paying for verification, it checks the chain, collection owner and permanent
   transfer lock. It submits through the separate identity Engine connection.
7. Pilot mode waits for native zkVerify Volta finalization. It does not claim an Arbitrum
   bridge receipt. Production would require an independently checked Arbitrum One receipt.
8. It queues a single ERC-1155 mint through Engine's persistent transaction idempotency
   API, using the credential commitment as the token ID and quantity one.
9. It checks the transaction binding, mint event, canonical finalized block and exact
   token balance before reporting `issued` and atomically publishing TEST metadata.

Ambiguous proof/mint responses and interrupted side effects require reconciliation.
They are not retried as fresh submissions. A changed eligibility decision cancels an
unissued job, or records `revocation_required` if a mint was already queued.

## Testnet Deployment

- Collection: `0xb02d87fb8bfeab0b2a223901488ae03bdd6734c5` on Arbitrum Sepolia (421614).
- Name: FluentXVerse TEST Identity; symbol: FXVIDTEST; initial supply: zero.
- Deployment: `0x9a49f72d7487e6fb3dd70528e12ba70424866fcced1ab43d9c544c3e2d05441f`.
- Proof submission: `7f2764db-752f-4e8a-ad9a-1ec803560f81`.
- Native Volta proof: `0xd6fd88631fcd25480b90149f1988d4dd2cf46f00725a7387a4f94f382442b362` (finalized).
- TEST mint: `0xa623f4382e256ad1689dd3b1002b4d29f20becca826dc392c43d2ef1c8d33601` (canonical finalized receipt, matching mint event and balance one verified).
- TEST token: `13922355309168586684827684955958184022286529046622958262920628008887491081710`.

The pilot uses a separate Memgraph container and synthetic approval records. No real
applicant identity decisions are fabricated. TEST credentials go to the Engine wallet
for this synthetic run. Real application pilot jobs use their bound managed wallet.
Only test ETH and Volta verification currency are used. The existing Arbitrum One
collection and its transfer policy are not changed.

The live pilot passed and was captured in `output/release/identity-pilot-20261103/pilot-result.json`.
API image `fluentxverse-cloud/api:identity-pilot-20261103` is deployed and healthy, with
automatic TEST issuance enabled. Live configuration confirms chain 421614, Volta and
unchanged Seaweed ID storage. Public TEST metadata responds HTTP 200 and references both
finalized transactions. The isolated QA database is stopped after testing to release RAM;
start `fxv-identity-pilot-graph` before isolated inspection or pilot resumption.

Tutor frontend version: `7bd8a184-c6f3-4ff1-9a43-ccd9c6293bc7`. The consent-only release
preserves the newer homepage deployment `102d4615-d6b0-41a7-ae88-e8a35a894027`.
Local and published browser checks passed at 1440, 390 and 320 pixels using mocked APIs
and synthetic uploads. Server/tutor typechecking passed; the API image passed 16 focused
tests (97 assertions), and the separate lifecycle regression passed with 104 assertions.

The setup is self-operated development setup, with fresh phase-one and phase-two
contributions and successful cryptographic setup verification. It is not independently
audited or approved for production. The key is not the retired certification key.

## Configuration

Issuance is off unless `TUTOR_IDENTITY_ISSUANCE_ENABLED=true`. Pilot configuration needs:

```text
TUTOR_IDENTITY_RELEASE_PATH=/run/tutor-identity-prover/release.json
TUTOR_IDENTITY_RELEASE_SHA256=<exact manifest SHA-256>
TUTOR_IDENTITY_ENGINE_API_BASE=<internal Engine URL>
TUTOR_IDENTITY_ENGINE_API_KEY=<dedicated server-side key>
```

Mount the private prover directory read-only. The issuer key must be a dedicated 32-byte
file with mode 0600. All proving artifact SHA-256 hashes and the issuer public key are
pinned in the manifest. Never commit keys, private environment files or generated witness
artifacts. `output/release/identity-pilot-20261103/prover` is private generated output.

## Verification

```sh
bun test tests/identityCredential.test.ts tests/identityIssuance.test.ts
IDENTITY_TEST_URI=bolt://127.0.0.1:17741 bun test ./tests/tutorIdentity.persistence.ts
bun scripts/test-identity-circuit.ts --verify-existing
node scripts/identity-pilot-operations.mjs --proof-status
node scripts/identity-pilot-operations.mjs --mint-status
node scripts/identity-pilot-operations.mjs --capture-result
```

The real local proof tests reject altered public bindings and invalid approval/signature
witnesses. Lifecycle tests preserve assessments and exercise 84-hour retention, booking,
resubmission, live matching, interview corrections and duplicate prevention. Browser
checks cover consent and replacement uploads at 1440, 390 and 320 pixels.

## Before Production

Production remains blocked until credential revocation and wallet recovery are implemented
and tested, the production proving release and dedicated Engine policy are provisioned,
and the complete mainnet receipt and issuance flow passes its own checks. A generic locked
ERC-1155 does not by itself enforce proof verification, one credential per applicant,
revocation or recovery. Deployment of that collection was not completion of this pipeline.
The v1 wallet-publication wording covers TEST issuance. Production needs its own disclosure
and consent version, not silent reuse of the testnet consent.

Single-account resets are separately staged in `scripts/reset-applicant-to-id.mjs`.
They require a confirmed exact email, preserve both assessment passes, and refuse to reset
an account that already has a queued or issued on-chain credential without reconciliation.
