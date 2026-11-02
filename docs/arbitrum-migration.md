# Arbitrum Receipt Migration

On October 29, 2026, FluentXVerse's root Engine project and its five modules
were migrated to Arbitrum One for future proof receipts. zkVerify mainnet
remains the proof-verification network. This is not a migration of ticket
assets, wallet funds, or existing on-chain proofs.

Later that day, project-selectable destinations replaced the need for a manual
cutover on each dropdown change. Arbitrum remains the saved selection following
the verification sweep. See [Project-Selectable Destinations](project-proof-destinations.md).

## Coordinates

| Setting | Value |
| --- | --- |
| Receipt destination | Arbitrum One, `42161` |
| Native verification network | zkVerify mainnet |
| Aggregation domain | `10` |
| Official receipt bridge | `0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69` |

The bridge address alone does not identify the destination. Chain ID, domain,
native network, statement, and finalized receipt must all match. Official
coordinates are listed in zkVerify's [contract addresses](https://docs.zkverify.io/architecture/contract-addresses)
and [domain management](https://docs.zkverify.io/architecture/proof-aggregation/domain-management).

## Coordinated Changes

- Updated all six project allowlists and project destination settings, five
  module proof policies, screening/payout runtime configurations, and the
  application's receipt configuration together while API/Engine were stopped.
- Preserved issuer keys, setup/custody pins, nullifier keys and all 11 historical
  proof records. Their original networks and destinations were not rewritten.
- Kept the policy-conflict guard. A destination change cannot silently invalidate
  a module's approved policy or previously issued credentials.
- Added destination-specific RPC defaults in Engine. Explicit configured RPCs
  still take precedence; unsupported chain IDs still fail.
- Removed the tally submission's hardcoded Volta network. Submission responses
  must match the configured native network and domain.
- Updated the shared receipt adapter to recognize destination-specific finality
  fields, including Arbitrum, without accepting Base evidence as Arbitrum evidence.

Disabled workflows remain disabled, including confidential payout transfers and
the review-tally pilot. This migration does not approve new proving artifacts or
claim independent setup/audit assurance.

## Verified Results

Authenticated live dashboard requests verified:

- All six destinations report chain `42161`, domain `10`.
- Saving the destination returns HTTP 200 without a pinned-policy conflict.
- Project wallet balance returns HTTP 200 on Arbitrum, with balance `0 ETH`.
- Native zkVerify account lookup returns HTTP 200.
- Screening and payout artifact checks report ready, and the official bridge
  has bytecode at an Arbitrum finalized block.

A synthetic payout authorization was generated through the live Engine on the
VPS and locally verified. Its 20 public signals bind to chain `42161`; the
application rejected a copy with that chain signal changed to Base. No real
earnings were created, no proof was submitted on-chain, and no funds moved.
This check is not a new end-to-end zkVerify/Arbitrum receipt publication pilot.

Focused tests passed: 21 locally, including the native Rust tally policy check;
20 in the release image with that native-only test skipped. Engine config/HTTP
and prover/receipt regression suites also passed before cutover.

## Operations

- `scripts/deploy-arbitrum-migration.mjs`: guarded initial build and coordinated
  cutover with private rollback snapshots.
- `scripts/deploy-arbitrum-tally.mjs`: scoped API follow-ups; `--receipts` applies
  the receipt compatibility update after the tally update.
- `scripts/verify-arbitrum-migration.mjs`: temporary authenticated dashboard
  session, cleaned in `finally`, plus artifact and bridge readiness checks.
- `scripts/verify-arbitrum-proof.mjs`: synthetic local proof generation only.
- `scripts/arbitrum-migration-audit.mjs`: read-only project/policy inventory.

Deployment and verification summaries are under
`output/release/arbitrum-migration-20261029`, with API follow-ups under
`arbitrum-tally-20261029` and `arbitrum-receipts-20261029`.
Private rollback snapshots stay on the VPS and must never be committed.

These migration scripts intentionally require their original live baseline;
do not rerun activation against an already migrated deployment. Subsequent
migrations need a new baseline, credential inventory and compatible module policies.
