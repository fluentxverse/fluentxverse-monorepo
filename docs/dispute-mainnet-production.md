# Arbitrum One dispute activation — November 3, 2026

The production API now captures new student-origin dispute cases in its transactional
outbox. Engine consumes the production HTTPS feed with a separate feed key, a new
`production-20261103-v1` epoch and an explicitly pinned mainnet binding. Staging's
observer journal remains historical; its events are not replayed on mainnet.

## Deployment

- Chain: Arbitrum One, 42161.
- Contract: `0x90153ced2a37eeba68c68f945653c7959ba0f627`.
- Operator/administrator: `0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1`.
- Separate Vault reconciliation wallet: `0xd7e41ce20d69914164856e9e37b79e6bcd2773e3`.
  It is operated by FluentXVerse, not an independent external auditor. Its separate
  signing role does not make source attendance data independently trustworthy.
- Policy: `0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144`.
- API: `fluentxverse-cloud/api:dispute-mainnet-20261103-feed` (the follow-up only
  adds a safe section-link fallback for activity records without a lesson identifier).
- Engine: `fluentxverse-cloud/gmr-engine:dispute-mainnet-20261103`.
- The contract is unpaused, the policy approved, and non-response handling enabled.
  Six configuration/funding transactions were confirmed canonical and finalized.

Only the pinned project, contract, policy, production HTTPS feed, chain and epoch
are permitted in the new production mode. Existing Sepolia pilot and observer modes
remain separate. The signing transport repeats the binding checks. No contract was
redeployed. A private persistent activation journal retains signed bytes and hashes;
ambiguous sends retry those exact bytes. Do not export the journal or Vault references.

## Application behavior

The tutor and student inboxes now include private lesson cases; dashboard Inbox
includes support review. Authenticated support capability is required for the new
admin dispute routes. Existing participants can only access their own permitted case
content. The feed requires a dedicated key and returns salted commitments, policy,
event kind and event times, rather than messages, IDs, images or evidence salts.

The release preserves the production student's report form and existing timing:
three-minute missing-tutor gate, 60-second continuous disconnect gate and 48 hours
after scheduled lesson end. New cases use the tested 24-hour explanation workflow.
Inappropriate-behavior reports require initial staff review. Legacy SQL cases and
tutor-origin follow-ups keep their previous behavior; they are not retroactively
represented as synchronized cases. No-report TA-301 refunds use a persisted
activation time and cannot authorize historical penalties automatically.

Unresolved disputes hold lesson finalization and payable tutor earnings. Staff
outcomes and penalties remain application decisions. Refund delivery remains in the
existing exactly-once backend ledger. On-chain refund receipts are attestations of
that delivery, not transfers performed by this dispute contract.

The dedicated Engine role can attest non-response only after the authoritative
outbox checkpoint, the recorded deadline, and all preceding case events. It is not
a ZK proof of absence. Non-response conclusions still rely on the application and
the separate self-operated reconciliation signer.

## Verification

- Engine Go package tests and TypeScript signing-transport checks passed.
- Scoped API build and 24 focused tests passed; full backend typecheck passed.
- All three scoped frontends built; six desktop/mobile inbox cases passed.
- Production encrypted Seaweed image roundtrip and cleanup passed.
- Candidate production image against isolated staging passed image integrity and
  access checks, private feed authentication, and exactly-once trial refund export
  (five events, exactly one refund event after repeated processing).
- One explicitly marked synthetic production case opened and was closed by staff
  as `no_penalty`, without refund or penalty. An unauthorized participant decision
  was rejected. Its two events are `open` and `staff`; private text was absent from
  both. No real learner, tutor or lesson was used.
- Mainnet simulations rejected duplicate case creation, unauthorized sender,
  unapproved policy and refund without approval, using decoded contract errors.
  RPC failures are not counted as rejection tests.

The synthetic mainnet lifecycle completed with both successful canonical finalized
receipts. Finalized block `520862368` reports `Resolved`, `NoPenalty`, no refund,
and exactly one decision. The relay's production cursor is 2, both events are
finalized, and its active nonce-lock count is zero.

- Open: `0x6864c80722cf3461ad6362a031744304d2192b40a1e6660732277de6d2592959`.
- Support resolution: `0xa012d2d18fd5c87ca7f9cbaee803eeb4079be7b6b9755d2b2c19fbbadd5bcc5a`.

Public evidence is saved in `mainnet-verification.json` under the release directory.
The test participant/lesson/slot records are then archived under synthetic labels,
removing them from normal user and lesson counts without deleting the case, outbox,
relationships or audit evidence. The smoke script refuses to recreate an archived test.

The relay waits for a successful canonical finalized receipt for each operation
before processing the next event. Application resolution can therefore precede its
on-chain mirror. The operator wallet's nonce reservation remains held while a
transaction is pending finality; other Engine writes using that wallet may wait.
Never erase a journal or release that reservation merely to accelerate processing.

Synthetic fixture and public verification output are under
`output/release/dispute-mainnet-20261103/`. Keep those records clearly marked test
data. Retain their audit/outbox links while synchronization is in progress.

This activation does not constitute an independent security audit, real two-party
classroom test, SMTP-delivery test, or proof that complaints are factually true.

## Operations

Read-only helpers in `scripts/dispute-mainnet-operations.mjs`:
`--status`, `--verify-case`, `--negative-checks`, `--journal`, `--operation=verify`.
Only public hashes/statuses are printed; raw signed bytes are excluded.

The protected VPS release directory contains the pre-activation API/Engine inspection
backup, compose overrides, production binding and activation journal. Source images
are overlaid on the previous production release so identity issuance, profile review,
metadata rate limits and other runtime configuration are preserved. Tutor inbox assets
also preserve the contemporaneous classroom-banner and report-modal changes.

For an incident, pause contract writes through the journaled administrator path,
inspect queued/signed records and preserve the outbox. Do not roll back the business
workflow or delete cases that have already been accepted without reconciling their
state, deadlines, credits and any broadcast transactions.
