# Bridge-Only Privacy And Trial Launch

## Release State

The original bridge-only/trial source work was implemented locally on October 13,
2026. On October 19 the custom application-contract integrations were retired and
archived. See [retirement scope](custom-contract-retirement.md) for the separately
validated API rollout. This is not a trial-booking or frontend release: the live
booking policy is preserved explicitly. Existing deployed contracts and journals
have not been deleted, converted, migrated or re-certified.

The source defaults are now:

```text
PRIVACY_INFRA_MODE=bridge_only
LESSON_BOOKING_MODE=trial
TRIAL_LESSON_LIMIT=1
VITE_ENABLE_TICKETING=false
```

The first three are server settings; the last is a student/dashboard build setting.
Unknown server modes and invalid limits fail closed. An older API reporting paid
mode cannot silently make the trial frontend spend tickets.

## Horizen Integration

Proofs are generated off-chain and submitted to zkVerify through dedicated Engine
projects. The backend verifies their exact statements through the existing official
Horizen testnet bridge, domain 175, chain 2651420:
`0x3098A6974649478f0133046e44105AA84e868C21`.

No application-specific contract writes occur in bridge-only mode. The reader pins
chain/domain/address, checks deployed code, validates receipt fields, reads at one
fixed finalized block and checks that the block remains canonical. A missing root,
wrong network or RPC failure never yields a verified result. Reading the existing
bridge does not bypass relaying: an absent aggregation root remains a blocker.
This is testnet support, not a mainnet launch or a security-audit claim.

### Anonymous Reviews And Tallies

New bridge-only cohorts have a separate group-ID namespace from legacy registry
cohorts. The stored `contract` field binds the bridge address for compatibility;
it is not a deployed application registry. Membership is frozen and application
eligibility, acceptance windows, duplicate nullifiers and immutable receipt records
are enforced in the database. Every accepted proof is rechecked against the bridge.

Tallies reconstruct all platform-recorded accepted reviews for the closed cohort
and verify each receipt at the finalized snapshot. The unchanged tally program
proves commitment consistency and arithmetic over that manifest. Its legacy
`registry` journal field now holds the bridge address for bridge-only cohorts.
It does not prove an independent on-chain acceptance census or absence of operator
censorship. Public evidence identifies `acceptanceSource: platform` and explicitly
discloses the platform completeness assumption. No existing tally is relabeled.

### Tutor Screening

Bridge-only credentials bind chain 2651420, the existing bridge address and reserved
agent ID zero. That zero means no ERC-8004 registration, not a registered agent.
The existing circuit can prove these bindings, but legacy validator-bound
credentials do not become bridge-only credentials. Fresh issuance is required.

The app locally proves and verifies against explicitly approved, SHA256-pinned
WASM/zkey/VK files, then submits via the dedicated generic Engine proof endpoint.
`SCREENING_ARTIFACTS_APPROVED=true` is required; test-only setups are rejected.
Credentials expose receipt evidence only with tutor sharing consent. Expiry and
revocation remain issuer/application responsibilities, not on-chain revocation.
Agent registration and custom screening contract writes are blocked.

Proofs establish approved signed screening results, not AI inference execution,
grading accuracy, speaker liveness or legal identity. The shared subject binding
is not anonymous from the platform or partners receiving the credential.

## Trial Booking

Ticket navigation, balances, purchasing, pricing, purchase-history routes and
administrator ticket controls are hidden by default. Existing holdings and
historical finance records are retained. Paid pass issuance is parked, and ticket
mint/purchase/consume mutations are blocked during trial mode. Signup does not
transfer trial ERC-1155 tokens.

Authenticated students can reserve and book with no wallet, ticket transfer or
private pass. The server writes `paymentMethod: trial`. The allowance is checked
inside the same serialized transaction as the slot claim and booking creation.
Retries reuse the exact reservation and return the existing booking. Uncertain
responses are reconciled with an authenticated, account-scoped reservation read.
Tutor eligibility, tutor blocks, scheduling conflicts and booking cutoffs remain.

Confirmed/completed/no-show trials consume the allowance. A student cancellation
at least one hour before the recorded start restores it; a later cancellation does
not. Support cancellations restore it without issuing tokens. Missing cancellation
provenance fails closed. One allowance is per student account, not proof of one
human; multi-account abuse remains an operational risk. Trials do not create a
paid credit refund or automatically change tutor compensation.

## Deployment Checklist

1. Back up the database and preserve all old journals, encrypted records and keys.
   Review any existing held/spent credits; do not convert or discard them.
2. Deploy the API first with explicit trial/bridge-only settings. Check
   `/lesson-passes/mode` returns `trial` with `Cache-Control: no-store` before
   deploying the trial student/dashboard builds.
3. Keep screening and tally publication disabled until approved artifacts and
   actual finalized bridge receipts are available. Mount approved screening
   artifacts on the API host and configure its dedicated RPC and trust pins.
4. Restrict review/screening/tally Engine projects to approved proof systems, keys,
   input counts and domain 175, with no contract-write methods. Do not reuse broad
   ticket or deployment keys. Engine policy changes are not made by this refactor.
5. Exercise real consent, issuance, proof verification and negative lifecycle paths
   with fresh pilot records before expanding privacy features. Database and UI
   tests with mocked receipts are not live bridge certification.
6. Deploy the frontends with ticketing disabled; verify authenticated, anonymous,
   desktop/mobile, cancellation and interrupted-booking flows.

The source now rejects `PRIVACY_INFRA_MODE=legacy_contracts`. Reverting the
infrastructure requires an explicit historical image/source rollback, reviewed
configuration and a new migration plan; changing a flag cannot reactivate it.
Trial/paid rollout remains a separate coordinated API/frontend decision. Paid
mode requires `LESSON_BOOKING_MODE=paid` and `VITE_ENABLE_TICKETING=true`. Do not
reopen paid intake just to clear a pending receipt.

## Verification

```sh
cd fluentxverse-server
bun test tests/bridgeOnlyPrivacy.test.ts tests/trialLaunch.test.ts tests/lessonPasses.http.test.ts
# Uses a fresh disposable Memgraph on localhost:7712, never the live database.
bun tests/trialLaunch.integration.ts
cd ../fluentxverse-student-solid-prototype
npm run test
npm run build
STUDENT_TEST_URL=http://127.0.0.1:5188 node tests/trial-launch.cjs
```

References: [Horizen privacy tools](https://docs.horizen.io/horizen-chain/privacy-tools/),
[official receipt bridges](https://docs.zkverify.io/architecture/contract-addresses),
[zkVerify consumption modes](https://docs.zkverify.io/handbook/introduction/two-modes).
