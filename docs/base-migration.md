# Base Migration

FluentXVerse's active EVM destination is Base mainnet (`8453`). GMR Engine
owns transaction routing and Vault-backed signing. zkVerify remains the native
proof-verification network; its official receipt is checked on Base.

## Destination Pins

| Setting | Mainnet | Testnet |
| --- | --- | --- |
| EVM chain | Base, 8453 | Base Sepolia, 84532 |
| Native verifier | zkVerify | Volta |
| Aggregation domain | 2 | 2 |
| Official bridge | `0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69` | `0x0807C544D38aE7729f8798388d89Be6502A1e8A8` |

The chain, native network, domain, bridge, statement and finalized destination
root must agree. Legacy Horizen evidence keeps its original coordinates and
must not be relabeled as Base evidence. Existing tutor credentials remain
bound to their original chain; fresh issuance uses the new destination.

## Scope And Gates

- The five FluentXVerse Engine projects allow Base mainnet. Historical
  transactions, wallet identities and prover artifact pins are preserved.
- Engine defaults and BaseScan links use Base. Source configuration templates
  default to Base, with activation disabled until configured and verified.
- Archived registry and lesson-pass contracts are not Base deployments.
- Review-tally execution remains disabled; its legacy chain-bound program
  needs a separate reviewed release before activation.
- Confidential payout settlement remains disabled. Changing a chain setting
  does not provide an audited settlement contract.
- Groth16 setup assurance remains self-operated, not independently audited.

## ETH Withdrawal

`gmr-base-migration` is a server-side operator command, not a public signer.
Its read-only default inventories the five project wallets. Withdrawal phases
are `--withdrawal quote`, `--withdrawal initiate --apply`, and
`--withdrawal status`.

The command is restricted to the FluentXVerse root project and its reviewed
wallet, withdrawing native ETH through the canonical Horizen standard bridge
to the same address on Base. It verifies both RPC chain identities and bridge
counterparts, rejects pending nonces and excessive fees, and uses GMR Vault.
The exact signed intent is journaled privately before broadcast. Retries reuse
that intent instead of creating another withdrawal. Never publish the private
journal, RPC credentials or Compose configuration.

A successful initiation is not completed Base settlement. Standard OP-stack
withdrawals require proof/finalization after the applicable delay. Track the
source transaction and withdrawal hash through completion; do not report a
Base deposit based only on a source-chain event. ZEN and VFY are not moved by
this operation.

The October 24, 2026 withdrawal initiated `0.00138 ETH` from the root wallet
`0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1` to that same address on Base.
Its source transaction is
`0xa44d49cdf48ce954ee55bcf043f3502cfdc68ff6ac92a8666213945ad66624ea`
and its withdrawal hash is
`0x65e081227dc7d6c50134e60df0bb713f41e153a6910389bf4cd5393d90d1849b`.
At initiation it was pending Base settlement, not completed. The current
operator command verifies source initiation only; it does not submit the
later Base proof or finalization transaction. Complete those stages through
the official bridge once available, with Engine/Vault signing rather than
exporting a wallet secret. Do not initiate a replacement withdrawal.

## Deployment And Checks

The scoped release scripts rebuild from a verified live baseline, preserve
unrelated work, fence API/Engine writers during the atomic Memgraph allowlist
migration, and retain private rollback configuration. They reject active
classroom connections and unresolved Engine transactions before switching.

Checks cover RPC chain separation, Base versus legacy receipt rejection,
screening statement bindings, distinct review cohorts, and request-defense
regressions. Deployment health checks do not substitute for a newly finalized
paid proof on Base or a real authenticated lesson.

Official references: [Horizen migration notice](https://blog.horizen.io/changes-for-horizen),
[bridge guide](https://docs.horizen.io/horizen-chain/bridging/bridge-assets/),
[zkVerify contract addresses](https://docs.zkverify.io/architecture/contract-addresses),
[zkVerify domain management](https://docs.zkverify.io/architecture/proof-aggregation/domain-management).
