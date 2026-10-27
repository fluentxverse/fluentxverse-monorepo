# Private Payout Authorization Deployment

## Live Scope

The cloud Engine owns signing, witness generation, Groth16 proving, zkVerify
mainnet submission and verification of the official Base aggregation receipt.
The admin dashboard exposes finance-only earnings approval, reservation,
proof generation, submission and receipt reconciliation. Financial records and
authorization journals remain in Memgraph, not Postgres.

This is private payout authorization, not payment execution or shielded settlement.
No tutor funds were transferred and no earning was marked paid by the pilot.

## Release

- Circuit: `tutor-payout.v2`, Groth16 BN128, 10,864 constraints, 20 public signals.
- Build SHA256: `cd11cb0edfe88f2f0e7c4913e87636c50520d87ab5ec3f9388ad2dbb9e0162b2`.
- Manifest SHA256: `245685a8176eb5c585ffc00ef39e80137b0b419c8f5e95896324d2e613cb7342`.
- Native VK hash: `0x29a21f3e4e4b527fa333571cfa633f0b8ea5b9ce34acefbbfa36c70eb0c5507b`.
- Engine module: `6360e46f-96c6-4935-8344-b5375155ae3c`, Private Payouts.
- Receipt destination: Base mainnet, chain 8453, zkVerify domain 2.
- Official bridge: `0xCb47A3C3B9Eb2E549a3F2EA4729De28CafbB2b69`.

Setup assurance is explicitly self-operated. Both fresh phase-one power-14 and
the circuit-specific phase-two contribution were generated and cryptographically
verified. The source/build, transcript, contribution history, proving/verification
key relationship and native VK hash were checked. Engine rechecked the installed
release before becoming ready. There is no independent audit or independent
contributor; entropy destruction is an operator assertion. The initial attempt to
verify a truncated public power-28 ceremony was stopped and is not this release.
Development QA keys were not deployed.

Signing and nullifier keys are separate protected 32-byte files, outside git and
browser assets. Both are pinned in the signed release, mounted read-only, and kept
durably on the local operator machine and cloud host. Rotation must preserve
historical nullifier/claim semantics; do not replace either key casually.

## Live Pilot

One synthetic earnings batch in an isolated, persistent test Memgraph was proved
through the deployed Engine. No real student/tutor earnings were consumed.

- Engine submission: `fdace2f8-e7e9-4b86-a309-120294b3d622`.
- Native transaction: `0x5bf21856ca10d63ece68ca61546c1e5947e25e0f0fe2614904d26f9006a3d2f9`.
- Statement: `0x192e06d9c5634a2b6a099c52b0dc5a4d743b29d9adc1a73a939342c7bbd889a6`.
- Native aggregation: 139481; receipt publication block: 5699547.
- Base finalized verification block: 53070494.
- Base root: `0xa1022062681da7f0284f2c1f331f49f7ed18235e09684ee3ebc1c82d750378b0`.

The checker verified native canonical finality/events, statement binding, the
aggregation Merkle path, official bridge bytecode and root, and successful bridge
verification at a canonical finalized Base snapshot. Base contains the aggregate
receipt commitment, not the raw private records or full witness.

Tests rejected a tampered production proof and all 20 changed public signals.
Finance permission, cross-project isolation, duplicate submission, expired
reservation and independent refund rejection were checked. After an operator
pause the original reservation expired; the valid historical receipt did not make
that reservation currently payable. Reconciliation never resubmitted the proof.
Earlier circuit QA also rejected 39 invalid witness mutations.

Operational release records are in `output/release/payout-activation-20261025/`.
The resumable pilot's private journal stays under the operator's protected local
state directory. The synthetic database is stopped with restart disabled, retained
for reproducibility, and is not a replica of the application's financial database.

## Settlement Still Required

An asset/conversion policy must be selected before implementing and activating
actual transfers. USD ledger amounts are not themselves onchain USD. USDC on Base
is the proposed initial rail, pending operator confirmation and funding. ETH
would require an explicit pricing/conversion and slippage policy instead.

A production settlement adapter must verify current payable records and the
accepted proof/commitment openings, durably claim each payout once, recover
uncertain outcomes by lookup, and confirm canonical final transfer evidence before
marking earnings paid. The current proof endpoints cannot do that. Ordinary
transfers disclose recipient and amount; shielded settlement remains separate.
