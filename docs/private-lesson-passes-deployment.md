# Private Lesson Pass Deployment

## Release State

October 12, 2026, Asia/Manila. This is **Horizen testnet / zkVerify Volta**, not mainnet.

- The ledger deployment is finalized: runtime bytecode and immutable configuration match the local Solc compilation at finalized block **30220789**. The issuer-enable transaction is confirmed at the latest head but has not yet reached the finalized head at the last check (13:20 UTC).
- The dedicated Engine project and application configuration are installed.
- The API and student Worker are deployed. Production asset hashes and browser checks pass.
- Student intake is **disabled**. `/lesson-passes/mode` explicitly returns `legacy_erc1155`; existing student credits and booking behavior are unchanged.
- Two real synthetic pass proofs were accepted by zkVerify and included in a finalized aggregation publication. The official Horizen bridge still lacks root 1215. Consequently no synthetic pass reservation, settlement or return has been dispatched, and end-to-end activation is **not complete**.

Synthetic proofs and issuance are release fixtures only. They have no application students, paid orders, bookings or usage metrics. Do not count them as customers or lesson activity. No mainnet funds or real student balances were used.

## Addresses And Pins

```text
Chain: Horizen testnet 2651420
Ledger: 0x26BC7E7428936A1F1127af5dA38871E818481ec9
Vault-owned issuer: 0x09bba32b80eb320f3bbc561720fce5bd21281ce4
Dedicated Engine project: ee2dd009-1cee-4ade-ae3c-13535004ee1d
Official receipt bridge: 0x3098A6974649478f0133046e44105AA84e868C21
zkVerify domain: 175
Native VK: 0x6cdfb2dc51747e922a72bad7aa81b21b67cb053774ee0ee6cbc4b173dddabb76
Contract source SHA256: e05512bd685187f026ed800e7e3343536169ecc571839960228ffdf450c446cb
WASM SHA256: 4edc07444a1d48d09014c963e315d3351b6e12838d83fcb1962071614b1c94b9
zkey SHA256: d02521afe7133a97421244374d4bc005c1ebd7d7cf7c51e88b7e99fdaf183146
VK canonical JSON SHA256: c41e4922816f0d12ece1cfe25e2d159fc1b515f3fbea0acae97a24eecc7b41dd
```

Solc 0.8.30, optimizer 200, viaIR, Shanghai. This is a local runtime-bytecode comparison with separate immutable checks, **not** independent security audit or explorer source-verification.

```text
Deployment tx: 0x0021022229c6ece34af029d22dc41a812748b87b77f3971cc369ee26a05a7007
Deployment block: 30220775
Enable tx: 0xf4931a8cf4ca8bad435cdef42fc8e28794bb12b59252f52e721133e45cdd7671
Enable block: 30220849
Synthetic issuance tx: 0x5ea5db7b63ec9eb14617a285ac2f958708eea737e8d91cd378fd40bb2c1f71ee
Synthetic batch: 0x4a9aaf835883cd983a871822cbd2643084ee51107bdec0cc57f08fcb3c155808
```

## Live Proof Evidence

The return and settle paths use different synthetic identities within one eight-member issuance batch. Both proofs use the same deployment-wide spend scope and bind their respective authorization ID, replacement commitment and deadline. They are locally verified and submitted through the dedicated Engine key, with no context or student identifiers.

```text
Return proof tx: 0x4a3802e92b749090669b8c97cfd94d0e32f090d57dfd38b585d67a5aa7c15f46
Return statement: 0x05da8e7dd9259b3bddf3bafff43e05592b2a16c61afb34e43a7f22450b71ceb8
Settle proof tx: 0x1c72578db01d1e87c5e6bc74d3138b8149e5a6f1814e8323c00c1eea3d191614
Settle statement: 0x96547d9703e57c21206a658149f957815e9768d350c16f527423976e0aa4b767
Aggregation: domain 175 / aggregation 1215
Volta finalized publication block: 7585246
Volta publication hash: 0x94160b2f74ec0e43e4e55c3eb0e7d992995f520a5814e1cefa45c014c4e287fa
Aggregation root: 0x86de141cc432f22d31aa198f1cd3a1eafadeb0e4b320a97579a42d302cf4c53d
Leaf count: 2
Return leaf index: 0
Settle leaf index: 1
```

The bridge's `proofsAggregations(175,1215)` remains zero at the latest and finalized heads during the release checks. Both exact receipt paths are saved privately for resumption. The application and smoke tooling retain finalized bridge reads. A reserve attempt correctly fails before dispatching a transaction when the official receipt is absent.

### Relay Handoff

Ask the **authorized Horizen/zkVerify relayer operator** to investigate/backfill the domain-175 aggregation-1215 publication above to the official bridge. Provide the aggregation root, Volta publication block/hash, proof transactions and bridge address. This is not a request for additional gas: zkVerify has already accepted both proofs. Do not fabricate a receipt, bypass bridge roles, use a mock bridge, reset nullifiers, or substitute `latest` for finalized acceptance.

## Runtime Release

```text
Student: https://student.fluentxverse.com/tickets
API: https://api.fluentxverse.com/lesson-passes
Student Worker version: 488d1233-7979-441c-95ad-e56fcacc84b3
Cloudflare deployment: e6144dec-b3d6-4eda-8964-24ddb882f112
API image: sha256:5b0a07ee1bc4afe1fd41569900f6b8dc9f9700fd9edd89d720cc7721801c8468
Previous API image tag: fluentxverse-server:pre-lesson-passes
Engine image retained: sha256:d141082980bfecdf2754c6cfb2d28cafb9b63feb64859e3aa429a8bee2d07ac9
Previous student Worker: 507c37ac-6529-4b34-a8e7-e44a98f45e22
```

Cloudflare returned a 504 for the deployment POST after uploading assets. Reconciliation through the deployments API confirmed the new version at 100%, and both custom-domain and workers.dev HTML reference the exact built entry chunk. The POST timeout was not treated as proof of failure, and no blind redeploy followed it.

## Isolation And Review

- Runtime key is restricted to project `ee2dd009-1cee-4ade-ae3c-13535004ee1d`, chain 2651420 and the exact pass ledger. Approved methods are only `registerBatch`, `reservePass`, `settlePass`, `returnPass`. Governance `setEnabled`, ERC-20 transfers and deployment endpoints are denied in live negative checks.
- Groth16/bn128, Volta, domain 175, the pinned VK, four canonical public inputs and empty context are enforced. A wrong-domain proof is denied before submission. Existing review/tally projects and the Engine image remain unchanged.
- Dedicated custody and deployment signing use Vault; no issuer secret reaches the browser or API runtime key. A 0.002-ETH **testnet-only** funding transfer was journaled from the existing authorized testnet funding wallet. Transaction bytes are persisted before broadcast and reconciled on retry.
- Runtime environment and private deployment/smoke journals are mode 0600 in ignored, Docker-excluded paths. The deployment directory is private. Proving artifacts are public; browser proof generation verifies their hashes.
- Pass routes suppress ordinary response/error logging and reject unexpected witness fields. Browser tests confirm that private pass keys and recovery passphrases are not transmitted to the API.
- Worker observability is explicitly disabled. Account and actual `fluentxverse.com` zone Logpush inspection return HTTP 403 with the available credentials. CDN/WAF log retention is **not independently verified**. No network anonymity or zero-retention claim is made.
- This is an internal implementation/deployment review, not an independent cryptographic, privacy or operational audit. Operator finance processing remains manual. See the [protocol trust boundaries](private-lesson-passes.md).

## Verification

- Backend regression tests, HTTP origin/authentication/body-limit checks and local EVM ledger tests pass.
- The running API container verifies a real pass proof using the approved packaged key and its Node verifier subprocess.
- API health returns 200; unauthenticated pass reads return 401; mode returns explicit legacy selection with `no-store`.
- Frontend production build/typechecking and 38 frontend unit tests pass. Full server typechecking still has unrelated existing errors in lesson content, interview code and student-lesson proof tests.
- Browser tests against **deployed assets** pass at desktop/mobile in both themes, including browser-generated real proofs, encrypted recovery, integrity failures, pending/ready states, pass booking and legacy ticket regression. Account, finance and bridge responses in these UI tests are mocked; they are not additional live transactions.
- Public WASM/zkey downloads from the deployed student host match the approved hashes.

## Resume And Activation

From `fluentxverse-server`, inspect existing journals. Never delete them or submit replacement proofs to recover an uncertain operation.

```sh
node scripts/deploy-lesson-passes.mjs inspect
node scripts/deploy-lesson-passes.mjs verify-deployment
node scripts/deploy-lesson-passes.mjs verify
node scripts/smoke-lesson-passes.mjs inspect
node scripts/smoke-lesson-passes.mjs receipt return --apply
node scripts/smoke-lesson-passes.mjs receipt settle --apply
```

Once both receipts verify at Horizen's finalized head and ledger issuance/enablement are finalized:

```sh
node scripts/smoke-lesson-passes.mjs reserve return --apply
node scripts/smoke-lesson-passes.mjs finalize return --apply
node scripts/smoke-lesson-passes.mjs reserve settle --apply
node scripts/smoke-lesson-passes.mjs finalize settle --apply
```

Wait for those transactions to finalize, then:

```sh
node scripts/smoke-lesson-passes.mjs verify --apply
```

Do not activate intake until that check succeeds and finance/privacy/migration handling is approved. The existing synthetic authorizations expire after 48 hours; if the relay is later than that, inspect finalized unused ledger state before a separately reviewed new authorization/proof. Do not silently renew or reset an old nullifier.

The deploy utility enforces the synthetic end-to-end gate before it accepts:

```sh
node scripts/deploy-lesson-passes.mjs configure --apply --enable-intake
docker compose up -d --no-deps fluentxverse-server
```

Activation switches new bookings away from ERC-1155 without converting old holdings. Confirm the treatment of outstanding legacy credits and supported packages before a general rollout. Preserve the old runtime configuration and image/version snapshots for an explicit rollback; do not run the destructive legacy `deploy.sh` or remove unrelated containers.

## Primary References

- [Horizen testnet configuration](https://docs.horizen.io/horizen-chain/network/testnet/)
- [Official zkVerify bridge addresses](https://docs.zkverify.io/architecture/contract-addresses)
- [Aggregation receipt flow](https://docs.zkverify.io/architecture/proof-aggregation/overview)
