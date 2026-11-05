# Production Tutor Identity Issuance

Activated November 3, 2026 (Asia/Manila), following the owner's mainnet activation request.
API image: `fluentxverse-cloud/api:identity-mainnet-20261103`.
Tutor UI version: `ab978015-cd3b-450b-9810-7e85a7b400fe` (preserves live homepage version
`9177f159-e1ab-41fa-82d0-9ca1c613a8b9`). Production mode and automatic issuance are enabled.

Collection: `0x25cbb57f2dccc478889a232a64fcee210fffd972` on Arbitrum One. Owner, permanent
transfer lock and metadata URI were checked live. URI configuration transaction:
`0x722950600855a273f219925d69cb0620052e11517c625e5f20b1aa80ba3a1671` (confirmed).
Pinned manifest SHA-256: `ee30f24247550bfe92280a94699180b8dfc881c9c3f31169aa21a6b5fb875135`.

The proving release was rebuilt from the identity circuit with the hash-pinned public
Hermez phase-one transcript and a fresh self-operated phase-two contribution and issuer
key. Setup verification and a local proof passed. The pilot key was not promoted.
Remote image tests: 21 passed, 123 assertions. Scoped and published tutor browser tests
passed at 1440, 390 and 320 pixels. Mainnet bridge preflight, public API health and
zkVerify HTTP/WebSocket connectivity passed. Native account lookup succeeded on retry
after an initial timeout, showing available mainnet verification currency.

No mainnet identity proof or credential mint was sent as part of activation. The live
queue had one request awaiting configuration, one revoked request, and zero production
consents. The first real issuance remains dependent on the tutor's explicit mainnet
consent and current eligibility; synthetic tests are not end-to-end mainnet evidence.
Operational records are in `output/release/identity-mainnet-20261103`. Private release
files and API keys are excluded from Git and must not be published.

## Issuance

Set the explicit production mode only alongside a hash-pinned production release:
Arbitrum One 42161, zkVerify mainnet, system domain 10, the exact collection/operator,
issuer public key, and contributed Groth16 artifacts for the ten-signal identity circuit.
The dedicated Engine policy must allow this exact chain/collection and proof submission.
The default remains pilot. The example configuration starts with issuance disabled.

ID matching and interview approval remain separate gates. A current, approved tutor
with a bound managed wallet must agree to the production disclosure. TEST consent is
not migrated. A verified applicant can confirm through the authenticated wallet-consent
endpoint without uploading their ID again. Once issuance starts, changing consent or
wallet bindings requires support reconciliation, rather than overwriting a job.

The worker submits the proof on zkVerify mainnet, waits for native finalization and
the Arbitrum receipt, then independently checks membership against the official bridge
at a canonical finalized Arbitrum block. Pending relay/root availability cannot mint.
It saves the statement, aggregation ID, Merkle path, leaf count/index and block snapshot.
Minting retains the durable Engine idempotency key and final receipt/event/balance checks.
Ambiguous side effects still stop for reconciliation; there is no blind resubmission.

Production profile submission requires current wallet-publication confirmation bound
to the tutor's verified identity and managed wallet. The API checks this under the
applicant write lock; a missing, historical TEST, replaced-wallet or mismatched consent
cannot submit a profile for review. Draft editing remains available. Confirmation,
rather than waiting for chain finality, is the prerequisite for profile submission.
The tutor disclosure separates public wallet/status/proof references from personal
names, document images/numbers and birth dates, which are excluded from proof inputs
and credential metadata. The public wallet may still be linked to a name elsewhere.

## NFT URI

Dashboard staff can open Tutors → tutor details → Profile → ID credential NFT
to inspect current and historical credential requests. Issued production credentials
include a public metadata link, wallet, collection, token ID and transaction references.
The displayed issuer status comes from the same live validity check as public metadata;
an invalidated token remains viewable as historical evidence. Pending requests have
no metadata link until finalized issuance. This is a read-only admin view and does
not expose private proving material or ID documents.

Production and test metadata GET/HEAD requests share an origin admission policy:
60 reads per trusted client IP per minute, 600 total reads per minute, and at most
four concurrent metadata requests per API process. Quotas use the existing atomic
Redis rate store. Changing cookies or forwarded headers does not create a new quota.
Excess requests receive HTTP 429 with Retry-After and no-store; unavailable rate
protection fails closed with HTTP 503. Reads remain public. These application limits
supplement upstream protections and do not guarantee protection against every DoS attack.

Before paying for verification and again before minting, the collection must be owned
by the configured operator, permanently transfer-locked, and return this exact URI
(the ERC-1155 `{id}` substitution is the lowercase 64-digit hexadecimal token ID):

```text
https://api.fluentxverse.com/proof/tutor-identity/metadata/<lowercase-collection>/{id}.json
```

The API publishes metadata only after a finalized mint. The metadata includes the
proof/public signals, verification-key hash, zkVerify transaction, mint transaction,
and independently checked Arbitrum inclusion evidence. Its external link opens the
official Arbitrum bridge contract on Arbiscan; the evidence identifies the specific
statement and aggregation. It is not presented as a per-proof bridge transaction URL.

The bridge stores aggregation commitments, not NFT JSON or full private records.
Consequently, the token's on-chain URI points to API metadata referencing Arbitrum
evidence. JSON availability still depends on FluentXVerse. The minting contract does
not independently enforce this application's proof policy; the issuer/operator is trusted.

## Revocation And Wallet Recovery

Metadata reports live `issuerStatus` as `active` or `invalidated` using current approval,
revocation, account and wallet bindings. Staff revocation invalidates the credential;
wallet changes also invalidate it. Clients must refresh issuer status instead of treating
ownership or a historical ZK proof as perpetual current approval. Blockchain receipts
and old cached metadata remain historical evidence and cannot be erased.

Recovery is manual: authenticate the tutor through support, revoke the old identity,
resolve any in-flight proof/mint before reissuing, bind the recovered managed wallet
through the existing wallet administration, and require new identity review, interview
approval and wallet consent. This creates a new credential, not a transfer of the locked
token. There is no on-chain burn/revocation registry or automatic wallet recovery here.

## Verified Mainnet Issuance — 2026-11-03

The production flow completed for submission `a6800348-f9a6-4dbd-9c29-2e13128d1e0d`.
The worker waited for aggregation 11 in domain 10 to become available at a finalized
Arbitrum block, then minted directly to the bound tutor wallet. Read-only operational
checks confirmed:

- Mint transaction `0x14de62d4356b790ef28749efef78e77ca0bf2621a10ed04a925daf534b55f981`
  succeeded in block `520793338` and is finalized.
- Recipient `0x179c8b203baf3b692264c702e3519379f69995bf` holds quantity `1` at both
  latest and finalized heads for token
  `14682971183928800501120949970240974880967431450564332312165360612223316594260`.
- The credential is `issued`; its public metadata returns HTTP 200 with active issuer status.

Pending receipt statuses distinguish zkVerify finality, aggregation and Arbitrum
finality in the tutor UI. No repeated proof submission or manual mint was needed.
These checks confirm issuance and ownership, rather than an independent security audit.

## Future Release And First-Issuance Checks

For future releases, provision the production release/issuer key and dedicated Engine
connection, configure the collection URI, and deploy API plus tutor UI together. Confirm receipt
verification, URI, permanent lock, actual recipient ownership and finalized mint with
an eligible, consenting tutor. Do not relabel existing TEST jobs as production or erase
their issuance history. A TEST-issued identity needs support-led migration/re-verification.

Reference: zkVerify system domain mapping:
https://docs.zkverify.io/architecture/proof-aggregation/domain-management
