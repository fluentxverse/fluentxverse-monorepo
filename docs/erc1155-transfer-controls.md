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
