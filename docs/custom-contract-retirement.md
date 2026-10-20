# Custom Contract Retirement

## State

The application-contract integrations were archived on October 19, 2026. The
bridge-only API is deployed as `fluentxverse-server:bridge-only-archive-20261019`
(08:44 UTC). Cloudflare frontends were not replaced. This is a simplification of
application acceptance, not a new mainnet deployment, security audit, or proof pilot.

| Component | Current treatment |
| --- | --- |
| AnonymousReviewRegistry | Archived; eligibility, frozen membership, nullifier uniqueness, acceptance windows and immutable acceptance receipts are enforced in Memgraph |
| IdentityRegistry / ValidationRegistry | ERC-8004 source/bootstrap archived in Engine; no active registration dependency |
| TutorScreeningValidator | Custom adapter archived; bridge-only credential source retained behind disabled activation and approved-artifact gates |
| LessonPassLedger | Archived; private-pass mutations permanently disabled in the active adapter; records remain readable |
| PayoutAuthorization | Engine development prototype archived; confidential or shielded settlement is not live |
| ZK circuits and zkVerify | Retained; proof submissions and native verification credentials remain in Engine/Vault |
| Official Horizen receipt bridge | Retained; exact proof statements are verified at canonical finalized blocks |

FluentXVerse archive: [source and manifests](../archive/custom-contracts-20261019/README.md),
50 files. Engine's separate repository contains
`_archive/fluentxverse-custom-contracts-20261019/`, 18 files. Original paths and
SHA256 digests are recorded, including the pre-change adapters. Archive scripts
must not be executed in place.

## Privacy And Trust

Private review content remains encrypted; Semaphore membership/key-possession
proofs and receipt verification remain. New cohorts have a separate bridge-only
namespace and scope. Historical registry-bound cohorts and credentials are not
relabeled, migrated or re-certified. A missing root, wrong network, malformed
receipt or failed RPC cannot produce successful verification.

The bridge proves inclusion of a zkVerify-verified statement. It does not enforce
FluentXVerse eligibility, duplicate prevention, acceptance, revocation, expiry or
record completeness. Those decisions depend on the database, issuer and platform
operators. An independently checkable receipt does not establish that a platform
published every eligible submission. Tally evidence labels its acceptance source
as the platform; unreviewed/testnet-only artifacts cannot be promoted to mainnet.

Screening still proves signed authorized results meeting a policy, not correct AI
execution or grading accuracy. ERC-8004 identity/validation records are no longer
required. Reviewed artifacts, trustworthy evidence and lifecycle checks remain
prerequisites before enabling a credential pilot.

Encrypted recording archives, consent, administrator-only playback/access logs,
selectively disclosed signed lesson-dispute evidence, Privy student login and
Engine/Vault-managed tutor wallets are unaffected. Compensation and salary records
stay in Memgraph. No confidential payout or shielded-settlement claim is added.

## Production Safeguards

The read-only preflight found no persisted review cohorts/enrollments/submissions/
tallies, screening credentials or private-pass records to migrate, and no active
classroom connection. Existing deployed contracts, ownership, proof journals,
entitlements, evidence, recordings and compensation records were not removed.
No funds or blockchain transactions were sent by this migration.

Runtime settings are explicitly pinned:

```text
PRIVACY_INFRA_MODE=bridge_only
LESSON_BOOKING_MODE=paid
SCREENING_ENABLED=false
LESSON_PASSES_ENABLED=false
ANONYMOUS_REVIEW_TALLY_ENABLED=false
```

The API still reports the existing `legacy_erc1155` booking mode. This retirement
does not launch the separate trial-booking source work or change credit charging.
Do not recreate production from a development compose file whose booking default
is `trial` without reviewing its environment and preserving the current policy.

The release overlaid 28 scoped source files on the previous image, without
dependency updates or unrelated worktree changes. Recording keys, the public
lesson-evidence issuer and storage mounts were checked unchanged. Private rollback
configuration lives outside Git under the operator's protected local state.
The initial checker hit a stale connection after restart and automatically rolled
back; a fresh-connection/retry fix was applied and the subsequent release passed.

Engine is shared with other applications and its running binary was not rebuilt.
Its FluentXVerse project already has screening and registration disabled. Source
handlers now return an archived configuration or HTTP 410 and its contract
provisioning binary is removed from future builds. Generic Engine proof/receipt,
wallet and Vault APIs are retained.

`PRIVACY_INFRA_MODE=legacy_contracts` now fails closed. Restoring the old workflows
requires a separately reviewed source/image/configuration rollback, not a flag.

## Verification

Checks completed:

- 76 server tests across 14 files: actual Semaphore proof plus altered-input
  rejection, bridge/network/finality bindings, review lifecycle, HTTP guards,
  screening evidence, lesson privacy, encrypted recordings and compensation rules.
- TypeScript check: `bunx tsc --noEmit`.
- Disposable Memgraph integration: 17 assertions and 12 concurrent retries for
  enrollments, immutable review submission, acceptance and historical isolation.
  Chain receipts were explicitly mocked; no on-chain certification is claimed.
- Engine: `go test ./internal/... ./cmd/...` and two retired-script tests.
  Unrestricted `go test ./...` encounters a permission-restricted Hatid deployment
  directory; its permissions were not changed.
- Archive manifests: all 68 file hashes verified with
  `node scripts/archive-custom-contracts.mjs --verify`.
- Candidate startup bundle and live official testnet bridge/code/VK preflight.
- Public HTTPS health, screening metadata, booking mode and evidence-issuer reads
  return HTTP 200 with `Cache-Control: no-store`.

The retained official bridge is on Horizen testnet, chain 2651420, domain 175:
`0x3098A6974649478f0133046e44105AA84e868C21`. Mainnet tuple validation exists but
this release does not switch networks or send a new proof. A real new-cohort
proof/relay acceptance pilot is still required before expanding usage.

Repeat unit checks from `fluentxverse-server/`:

```sh
bun test tests/bridgeOnlyPrivacy.test.ts tests/anonymousReviews.test.ts tests/anonymousReviews.http.test.ts tests/reviewTally.test.ts tests/horizenMainnet.test.ts tests/lessonPasses.http.test.ts tests/screening.http.test.ts tests/screening.test.ts tests/trialLaunch.test.ts tests/gmrProofReceipt.test.ts tests/lessonPrivacy.test.ts tests/qaRecording.test.ts tests/tutorCompensation.test.ts tests/tutorEarnings.test.ts
bunx tsc --noEmit
```

`tests/bridgeOnlyArchive.integration.ts` refuses any database other than an empty,
disposable Memgraph at `127.0.0.1:7714`. Never point persistence tests at production.
