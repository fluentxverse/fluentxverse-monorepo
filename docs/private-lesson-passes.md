# Private Lesson Passes

October 19, 2026: this contract-backed workflow and its deployment tools are
[archived](../archive/custom-contracts-20261019/README.md). Mutations are disabled
even if `LESSON_PASSES_ENABLED=true`; existing records remain readable and are not
converted. The production booking policy is preserved, not switched to trials by
the retirement. The protocol below is historical. See
[retirement scope](custom-contract-retirement.md).

October 13 source update: ticketing and paid passes are parked for the free-trial
launch. Existing contracts/credits remain preserved; see
[the new infrastructure runbook](bridge-only-trial-launch.md). This protocol is
not silently converted into bridge-only paid spending.

## Status

Deployed on October 12, 2026: the API and student frontend include the pass path, and the ledger is on Horizen testnet. Student intake remains behind `LESSON_PASSES_ENABLED=false`. Two genuine synthetic proofs were accepted and published on zkVerify; official bridge relay and finalized settlement/return checks are still pending. See [deployment evidence](private-lesson-passes-deployment.md).

No existing ERC-1155 holdings, balances, bookings or refunds are converted. The student `/tickets` page and new bookings switch only when the API explicitly selects `private_passes`; configuration errors never silently select legacy spending.

This is an issuer-operated **testnet pilot**, not a custodial payment processor, transferable token, shielded cash pool or production privacy audit. Finance processing is manual. Premium/trial packages and automatic payment-provider settlement are outside this pilot.

## Protocol

1. The browser generates a separate Semaphore identity for each single-lesson pass. Only its commitment is sent to the application.
2. The recovery vault encrypts keys and retry references locally using AES-256-GCM, PBKDF2-SHA256 (600,000 iterations), random salt/nonce, and account-bound authenticated data. The server stores only ciphertext, using optimistic version checks. Backups are encrypted; importing a backup merges keys rather than discarding newer ones. A lost passphrase cannot be reset by support.
3. A student requests a catalog order. An authenticated finance administrator confirms the exact settled USD cents and a globally unique external payment reference. No payment-success toggle or simulated charge grants credits. Paid commitments are frozen into an issuance batch.
4. `LessonPassLedger.registerBatch` approves the immutable root on Horizen testnet. A pass becomes available only after the finalized contract root matches.
5. Before selecting a tutor slot, the browser generates a real depth-8 Semaphore Groth16 proof of membership and key possession. Its message binds the opaque authorization ID, issuance root, replacement-pass commitment and 48-hour deadline.
6. The dedicated Engine submits the proof to zkVerify Volta/domain 175. The native statement leaf binds all four public inputs and the approved verification key. The official Horizen receipt bridge must verify the aggregation at `finalized` before the issuer calls `reservePass`.
7. The deployment-wide spend scope does not change with booking IDs or roots. A nullifier is permanently consumed on reserve. One finalized reservation can fund exactly one authenticated booking, in the same database transaction as the slot claim and Booking creation.
8. Completed, ended, mutually attended lessons settle. Student cancellation at least one hour before the recorded lesson start returns a new pass to the precommitted replacement key. Later cancellation settles without a replacement. Other attendance outcomes and non-student cancellations require an audited support refund approval, followed by finance finalization. Settlement and return are mutually exclusive.
9. Returned passes enter a new issuance batch. Original nullifiers are never reset. Unbooked ready reservations can request a return. An interrupted authorization is recoverable as unused only after its deadline has passed in a finalized block, its ledger reservation is absent and its known nullifier is unspent.

## Privacy And Trust

- Public-chain observers see batch roots/counts, proofs/public inputs, nullifiers, opaque reservations, replacement commitments and issuer transactions. They do not get student wallets, balances, lesson IDs, tutor IDs, payment references or schedules in ledger calls.
- The application, authenticated finance staff, database administrators and relevant tutors still know their normal business records. The issuer can correlate its private reservations to students. This is not anonymity from FluentXVerse, its infrastructure or a colluding issuer.
- Semaphore proves possession of **an issued group member**, not payment settlement, attendance, AI grading correctness, a particular student's legal identity, or the selected commitment's identity. Account ownership, allocation and lesson outcomes remain application/issuer assertions.
- Small batches, immediate refunds, timing, IP addresses, logs, backups and compromised browsers can reduce privacy. Group members are available to authenticated students for proving. Do not claim an anonymity-set guarantee for a one-member batch; use mixed-customer batching for a reviewed pilot.
- Secret/account sharing cannot be cryptographically prevented. There is no application transfer endpoint. This is not a trustless peer-to-peer credit marketplace.
- The ledger holds no funds. Existing tutor payouts remain a separate system; this feature does not prove payout conservation or reserve solvency.

## Operator API

All `/lesson-passes/admin/*` endpoints require a valid **finance** administrator session and approved dashboard Origin. They are excluded from the student test API allowlist. Student mutations require the student session and approved Origin. Bodies are bounded, unexpected witness/secret fields are rejected and these routes suppress ordinary request/error-body logging.

Use `bun scripts/lesson-pass-operator.ts <action> [id]`, with `LESSON_PASS_OPERATOR_COOKIE_FILE` pointing to a mode-0600 file containing the dashboard cookie header. Never pass cookies, payment references, proof keys or passwords in shell arguments. Structured request input is read from a separate mode-0600 file named by `LESSON_PASS_OPERATOR_INPUT_FILE`.

| Action | Endpoint | Input |
| --- | --- | --- |
| queue | GET `/admin/queue` | none |
| approve | POST `/admin/orders/:id/approve` | `paymentReference`, `paidCents` |
| seal | POST `/admin/batches/:id/seal` | `passIds` |
| register | POST `/admin/batches/:id/register` | none |
| submit | POST `/admin/reservations/:id/submit` | none |
| certify | POST `/admin/reservations/:id/certify` | `aggregationId`, `merklePath`, `leafCount`, `index` |
| reconcile | POST `/admin/reservations/:id/reconcile` | none |
| finalize | POST `/admin/reservations/:id/finalize` | none |

`queue` shows at most 512 pending records per category. Monitor capacity; this pilot is not an unbounded operations console. Invoke `register` again after its recorded operation finalizes to activate an issuance batch. Invoke `reconcile` after reservation/finalization transactions reach Horizen finality. Unknown Engine outcomes are held for investigation, not automatically retried. There is no background submission worker.

If a transaction/proof submission response is lost, inspect the dedicated Engine project and ledger with the recorded immutable inputs. If no operation was submitted, a reviewed, explicit repair of the durable dispatch record is required. Do not reset a dispatch status on a timeout alone. Official bridge roots cannot be backfilled by an unauthorized application wallet; request the authorized relayer's assistance.

## Activation Requirements

1. Review/audit `contracts/lesson-passes/LessonPassLedger.sol`, backend transitions, frontend key recovery, backups and infrastructure privacy. Review the finance issuer's key controls and payment reconciliation.
2. Deploy the ledger to Horizen **testnet 2651420**, using the official receipt bridge `0x3098A6974649478f0133046e44105AA84e868C21`, domain `175`, approved native vk hash `0x6cdfb2dc51747e922a72bad7aa81b21b67cb053774ee0ee6cbc4b173dddabb76`, and a dedicated controlled issuer. Enable the contract only after review.
3. Provision a dedicated restricted Engine project/key: exact ledger contract, issuer/network, domain 175, approved Groth16/bn128 key, four public inputs, and only `registerBatch`, `reservePass`, `settlePass`, `returnPass`. Do not reuse screening, review, payout or unrestricted deployment keys. Governance's `setEnabled` remains outside this application key.
4. Copy `fluentxverse-server/config/lesson-passes.env.example` to a mode-0600, ignored `lesson-passes.env`. Set approved deployment addresses, dedicated Engine credentials and artifact hashes. WASM: `4edc07444a1d48d09014c963e315d3351b6e12838d83fcb1962071614b1c94b9`; zkey: `d02521afe7133a97421244374d4bc005c1ebd7d7cf7c51e88b7e99fdaf183146`; verification-key canonical JSON: `c41e4922816f0d12ece1cfe25e2d159fc1b515f3fbea0acae97a24eecc7b41dd`.
5. Ensure pinned public proving files are available. Deploy the API and frontend together. Validate a closed synthetic pilot against genuine zkVerify receipts and finalized official bridge roots, including cancellation and recovery, before exposing real orders. Tests using a local mock bridge do not satisfy this requirement.
6. Set `LESSON_PASSES_ENABLED=true` only after those checks. The current adapter deliberately rejects mainnet/other chain IDs. A separately reviewed mainnet configuration and payment integration are required for production use.

## Tests

From the workspace root:

```sh
node --test contracts/lesson-passes/ledger.test.mjs
cd fluentxverse-server
bun test tests/lessonPasses.http.test.ts
bun tests/lessonPasses.persistence.ts
```

The persistence test requires an **empty disposable Memgraph on localhost:7710**, not the live DB. Start an isolated `memgraph/memgraph` container mapped to that port and remove it after testing. Actual Semaphore proofs are generated/verified; Engine and finalized chain actions are explicitly mocked in persistence tests. The contract test runs Ganache with an explicitly mock receipt bridge.

From `fluentxverse-student-solid-prototype`:

```sh
bun test tests/lessonPassVault.test.ts tests/unit.test.ts tests/productionEndpoints.test.ts
npm run build
node tests/lesson-passes.cjs
node tests/student/ticketsDesign.cjs
node tests/student/browseTutors.cjs
```

Browser tests use the local Vite server on `http://127.0.0.1:5176`, mocked API finality/payment responses, **real browser-worker proofs**, and desktop/mobile light/dark screenshots. They do not submit anything to live chains or payment services.

## Grant Substance

Describe this as private, single-use lesson entitlements verified through zkVerify and redeemed through a Horizen ledger. The business reason is to avoid publicly attributable student credit balances and spending histories while preserving replay-resistant booking and auditable return/settlement. Be explicit about issuer/business-record trust and pending deployment. Do not claim zkML, VELA, TEE, private payment rails, mainnet readiness or grant eligibility this implementation does not establish.
