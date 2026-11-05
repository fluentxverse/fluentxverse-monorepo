# Lesson Disputes Engine Deployment

**Production update, November 3:** see [Arbitrum One activation](dispute-mainnet-production.md)
for the now-active production binding. The text below is the original template/pilot release record.

Published November 2, 2026. This release makes the Lesson disputes contract
template available in Engine. It does not deploy a smart contract or connect live
lesson cases, refunds, or penalties to it.

This describes the template release. A subsequent staging integration and Sepolia
pilot are documented in [Engine integration](lesson-disputes-chain-integration.md).
The current Engine observer imports staging events but cannot send mainnet writes;
the public application has not been promoted to the new dispute workflow.

## Access

Open https://engine.fluentxverse.com and select the project, then Contracts,
Add contract, Lesson disputes. The form supports Arbitrum Sepolia and Arbitrum One
subject to project policy. Administrator and Engine operator addresses must be
nonzero but may be the same wallet. Both fields default to the project wallet,
which pays deployment gas through GMR Vault. A shared wallet holds both sets of
permissions. The reconciler must remain separate.

New instances start paused, without approved policies or a reconciler, and with
non-response automation disabled. Do not enable automation until the authoritative
Memgraph/outbox adapter and recovery handling have been implemented and tested.
The custom contract has no independent audit and does not transfer tokens.

## Release

- Engine image: `fluentxverse-cloud/gmr-engine:lesson-disputes-shared-roles-20261102`
- Previous image: `fluentxverse-cloud/gmr-engine:lesson-disputes-engine-20261102`
- Cloudflare Worker version: `d9c5d161-0632-4c00-bacb-0db719e9609d`
- Previous Worker version: `3ebd3dc8-51a5-4fcb-bc38-4b8d18b521d1`
- Preparation: `scripts/prepare-lesson-disputes-engine.mjs`
- Deployment: `scripts/deploy-lesson-disputes-engine.mjs`
- Local verification records: `output/release/lesson-disputes-shared-roles-20261102`

The API rollout changed only the Engine image. Existing proving artifacts,
policies, wallets, receipt destination settings, and other services were preserved.
The deployment check found no unsettled Engine operations. The prior image and
private VPS rollback record remain available.

## Checks

- Engine Go source package tests, dashboard typechecking, unit tests and build passed.
- Solidity tests passed 86 checks, including split/shared-role invariants with
  16,384 total randomized handler calls and zero unexpected reverts, seed 0x03.
  Two-step transfers can merge or separate administrator/operator roles later.
- The packaged artifact deployed successfully through Engine's script on a local
  Anvil chain with both shared and separate roles; constructor roles, safe defaults
  and runtime bytecode matched.
- The queue lifecycle passed against an isolated disposable Memgraph database.
- Live authenticated project details and the template list endpoint returned the
  expected data. The verification session was logged out afterward.
- Unauthenticated access to the new endpoint returned HTTP 401.
- Public dashboard JavaScript and CSS hashes matched the release files.
- Browser checks on the published site passed at 1440px and 375px. API requests
  were intercepted with fixtures, including every simulated deployment request.
- No public-network contract deployment, transfer, or penalty activation was sent.

Previously deployed non-upgradeable contracts are not modified by this template
update. The running API binary and public assets were checked against the prepared
release hashes. Existing proof artifacts and receipt settings were not changed.
