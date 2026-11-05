# Engine ERC-1155 Transfer Controls

Engine's generated ERC-1155 edition is a custom implementation, not the permissioned thirdweb
contract shown in the [thirdweb soulbound guide](https://portal.thirdweb.com/knowledge-base/how-to/creating-soulbound-nfts).
It previously had no transfer-disable function or `TRANSFER_ROLE` API.

The updated template adds:

- `transfersEnabled()` (defaults to true for compatibility with ordinary collections).
- Owner-only `setTransfersEnabled(bool)` for reversible restrictions.
- Owner-only `lockTransfersPermanently()` for irreversible non-transferability.
- `transfersPermanentlyLocked()` and `TransferPolicyUpdated` events for policy inspection.

Both single and batch transfers enforce this restriction. Approved operators and the owner
cannot bypass a disabled transfer policy. Ownership transfer cannot undo a permanent lock.
Minting and holder/approved-operator burning retain their existing behavior. Owner-controlled
revocation, wallet recovery, proof verification and duplicate-safe credential issuance are
separate work, not provided merely by disabling transfers.

For identity credentials, deploy with **zero initial supply**, permanently lock transfers,
verify both policy getters on-chain, and only then permit issuance. A reversible restriction
can be lifted by the administrator and should not be advertised as permanent soulbinding.
The generic creation form still uses the backward-compatible constructor; creating an edition
alone does not automatically lock it or establish a verified identity.

This change affects new deployments only. Existing non-upgradeable contracts cannot gain these
functions. It is not an independent audit, nor a claim of thirdweb audit coverage or full
thirdweb role-API compatibility.

The actual Go-generated Solidity is compiled and executed in Foundry by
`internal/contracts/erc1155_transfers_test.go` in the Engine repository. Eight runtime tests
cover owner authorization, single/batch transfers, operators, re-enabling, permanent locking
across ownership changes, mint/burn behavior and 256 fuzz cases with unchanged balances.

## Engine Release

Deployed on 2026-11-02 as `fluentxverse-cloud/gmr-engine:erc1155-transfer-controls-20261102`.
The release overlays only the generated-contract template and binary on the previous Engine
release. Contract, deployer and HTTP API tests passed; the transaction queue was clear and all
36 pilot transactions were complete before restart. Engine health passed afterward. No new
on-chain collection, credential, mint, transfer or ZK proof was created by this deployment.

## ABI Metadata Correction

The generated Solidity included transfer controls, but `erc1155EditionABI` in Engine's store
still described the old contract. The generic console displays that saved ABI; no console
function whitelist needed changing. The ABI template now includes both getters, both policy
writes and the non-indexed `TransferPolicyUpdated(bool,bool)` event. Regression tests cover
their signatures/mutability, uniqueness, source consistency and existing ERC-1155 functions.

Release: `fluentxverse-cloud/gmr-engine:erc1155-abi-20261102`. The binary was built from the
previous deployed source with only the ABI constant replaced, avoiding unrelated local Engine
changes. Store, contract runtime, deployer and HTTP API tests passed. Queue preflight found no
unsettled operations, all 36 pilot transactions were complete, and Engine health passed.

FXVID on Arbitrum One (`0x25cbb57f2dccc478889a232a64fcee210fffd972`) was confirmed to expose
both getters on-chain and both policy functions in its saved source. Its single saved ABI
record was repaired with compare-and-set protection and a private VPS rollback copy. No ABI
was added to unverified legacy deployments. Future editions receive the corrected template.
No chain transaction, mint, transfer or policy change was performed. Getters remain
`transfersEnabled=true` and `transfersPermanentlyLocked=false`.

The published console passed desktop/mobile tests with synthetic API metadata and no writes.
Refresh the project/reopen its console to load the repaired ABI. Under Write,
`setTransfersEnabled(false)` is reversible unless permanently locked;
`lockTransfersPermanently()` is irreversible. Both still require the owner's existing
password-confirmed transaction workflow. Deployment tooling: `scripts/deploy-erc1155-abi.mjs`.
