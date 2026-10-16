# Anonymous Reviews Deployment

## Scope

Release date: October 12, 2026 (Asia/Manila). This is a Horizen testnet/zkVerify Volta
pilot on the existing live student host, not a mainnet deployment. No Vela or TEE is used.

Enrollment/intake is enabled in the running API. Its finalized registry trust check
passes. The live smoke proof is verified and aggregated on Volta, but its receipt
has not yet been posted by the authorized Horizen bridge relayer. Consequently no
smoke certification has been submitted, and it is not reported as chain-accepted.

- Student entry: https://student.fluentxverse.com/reviews
- API: https://api.fluentxverse.com/anonymous-reviews
- Chain ID: `2651420`
- Registry: `0x71611f8971a31B78a281FD2a32Ed6c09bFA1Aa6B`
- Bridge: `0x3098A6974649478f0133046e44105AA84e868C21`
- zkVerify domain: `175`
- Dedicated Engine project: `b89ee4cb-625d-41af-b56e-ac7744fce805`
- Vault-owned governor: `0x98b97332cea277f9a331cc8919a2a97d956b8c09`

Registry deployment transaction:
`0xe1bea42b33fa3e1dd2a4b1cff0538cda076686f83fe2bf65e0ae6de849f7903b`.
Enable transaction:
`0xdcc7abcbcd9f6d2daffd5fc646b49f13b7a80ea941673d13ab94cf56cbd84e2b`.
Runtime bytecode is compared locally to Solc 0.8.30 output (optimizer 200, viaIR,
Shanghai), and immutable values are independently checked against live chain reads.
This is not an explorer source-verification or independent audit claim.

## Trust Pins

Semaphore 4.14.3, depth 8, official 4.13.0 proving assets:

```text
WASM SHA256: 4edc07444a1d48d09014c963e315d3351b6e12838d83fcb1962071614b1c94b9
zkey SHA256: d02521afe7133a97421244374d4bc005c1ebd7d7cf7c51e88b7e99fdaf183146
VK JSON SHA256: c41e4922816f0d12ece1cfe25e2d159fc1b515f3fbea0acae97a24eecc7b41dd
zkVerify native VK: 0x6cdfb2dc51747e922a72bad7aa81b21b67cb053774ee0ee6cbc4b173dddabb76
```

The zkey's exported verification key matches the packaged depth-8 verifier. The
native key hash is obtained through the Volta SDK. Downloaded live-host WASM/zkey
hashes match these pins. The browser verifies hashes before using either artifact.

## Isolation And Privacy Review

The separate Engine project is restricted to chain `2651420` and this registry. Its
policy accepts only `registerCohort`/`acceptReview`, Groth16/bn128, Volta, domain 175,
the pinned native VK, four canonical public inputs and empty context. Deployment
and unrelated transaction endpoints are denied to its runtime key. Governor actions
use Vault custody through the deployment utility, never the browser or runtime key.
Other Engine projects keep their existing settings.

Private runtime configuration and the dedicated random AES key are in the ignored
`fluentxverse-server/config/anonymous-reviews.env`; deployment journals are under
the ignored `.deployment/anonymous-reviews/` directory. Files are mode 0600 and
excluded from future Docker build contexts. Preserve the encryption key when
changing configuration; encrypted feedback cannot be recovered without it. Treat
external encrypted backup, key rotation and retention as operator responsibilities.

App response/error logging skips review routes. The frontend has no discovered
analytics integration and Worker observability is explicitly disabled. The tunnel
has no explicit verbose request-logging flags. Engine requests originate from the
backend and do not forward student cookies, identifiers, IP headers or referrers.
Docker logs are not a hidden review database, but remain subject to host access controls.

Cloudflare processes client IPs. Account-level Logpush inspection returned HTTP 403
with the available token; CDN/WAF retention has not been independently established.
No zero-retention or network-anonymity claim is made. Enrollment still links accounts
to commitments, and the operator can decrypt feedback. This is cohort unlinkability
under the documented trust model, not confidentiality from the platform itself.

## Verification

Release checks include API health and existing student authentication, existing
screening-project authentication after the Engine rollout, container-local real
Semaphore verification, scoped-key negative tests, and live-host artifact hashes.
Frontend production build/typechecking passes. Browser tests run against the deployed
assets at desktop/mobile sizes in both themes, using mocked account/API responses:
real proof generation, lost-key recovery, hash failure, exact retry, privacy headers,
pending/verified/closed states, and no horizontal overflow or uncaught page errors.
Server review/legacy-survey tests and contract tests pass; their bridges are mocked.

The separate live smoke has five generated identities and one real proof. Its cohort
is not in the application database, has no student identities or bookings, and must
never be counted as user activity or included in tutor aggregates.

```text
Synthetic group: 0x54656dda51c6a5f8487ae7146c8e78d1efba34eccdf63fde0b588c5b4ace39dd
Volta proof tx: 0xa3e3409c169afae06b0f2bac30bf62574c1482fb5266f9db3ab33866755fac1d
Aggregation: domain 175 / aggregation 1213
Publication block: 7577377
Publication hash: 0xc892801989922c6b6b8e0223eefbe4ed4dcdb46bad5bf7417a57ab8e9651ee99
Statement: 0x4ee9d13f79e39dcc549b0b380692544ce39fdd0e7b323dddb7fa596c1cb9724c
```

Registry deployment/enablement and immutable configuration were verified at the
finalized head. The running API's own `AnonymousReviewChain.check()` passes, and
its runtime feature flag is true. Live HTTP checks return 200 with `enabled: true`
for published-batch reads, 401 for unauthenticated enrollment reads, 400 for
cookie/bearer-bearing anonymous POSTs, and 413 for oversized bodies. Responses are
`no-store`. API health and existing student authentication remain working.

The smoke's Volta publication is finalized, but bridge storage
`proofsAggregations(175,1213)` was still zero during the release check. The application's
finalized acceptance check correctly returns false. This is an outstanding external
relay dependency, not a completed live end-to-end certification test. No receipt
was fabricated, no bridge roles were bypassed, and no failed proof was labeled verified.
Operator certification must wait for the authorized relay, then for Horizen finality.
The registry and application keep finalized reads; never substitute `latest` to make
a pending acceptance appear verified.

Student Worker release: `41e4f061-fad1-4b5a-88e3-f18f00d23e36`.
API image: `sha256:a1709b3d0959c45bae76e6213e33c85c90bd0aee32c510c4156b4344e635d3d8`.
Engine image: `sha256:12809682b37f224ce66569423737f78d239952d5b1ab43bfbcb4174bd8042f31`.

## Operations And Rollback

Deployment utilities run from `fluentxverse-server` on the authorized deployment host:

```bash
node scripts/deploy-anonymous-reviews.mjs verify
# Enables the existing generated configuration without changing its AES key.
node scripts/deploy-anonymous-reviews.mjs configure --apply --enable-intake
docker compose up -d --no-deps fluentxverse-server
```

Resume only the existing synthetic smoke after the external relay arrives:

```bash
node scripts/smoke-anonymous-reviews.mjs receipt
node scripts/smoke-anonymous-reviews.mjs certify --apply
# This fails until the actual acceptance is finalized, then succeeds.
node scripts/smoke-anonymous-reviews.mjs verify
```

The receipt resolver backfills finalized publication events from the submitted proof's
block and persists the exact receipt block. Re-running it does not submit another proof
or alter student data. Do not replace a pending receipt with a mock bridge response.

For a fresh deployment, inspect first, then explicitly run `project`, `fund`, `deploy`
and `enable-contract` phases with `--apply`. Signed transaction bytes and hashes are
journaled before broadcast; reruns reconcile the same transaction rather than choosing
a new nonce. Do not delete journals to retry an uncertain operation. The utility uses
the neighboring Budol Engine workspace by default; `GMR_ENGINE_WORKSPACE` overrides it.

Emergency intake disablement retains keys, ciphertext and existing chain records:

```bash
node scripts/deploy-anonymous-reviews.mjs configure --apply
docker compose up -d --no-deps fluentxverse-server
```

The previous API image is locally tagged `fluentxverse-server:pre-anonymous-reviews`.
Use a reviewed Compose image override to roll back it if necessary. Do not run the
legacy destructive deploy script or reset the worktree.

Operator processing remains manual: activate a sealed cohort, submit each queued
proof, resolve its exact publication block/path, certify, wait for finalized acceptance,
and publish only after the window closes with at least five accepted reviews. Uncertain
Engine outcomes require reconciliation, not blind retries. There is no automated watcher
or new administrator console. Real student monthly cohorts have not been fabricated
to bypass enrollment, attendance, thresholds or deadlines. October enrollment closes
November 1, 2026 at 00:00 UTC; its review window then lasts seven days.

## References

- [Horizen testnet](https://docs.horizen.io/horizen-chain/network/testnet/)
- [zkVerify bridge addresses](https://docs.zkverify.io/architecture/contract-addresses)
- [System domains](https://docs.zkverify.io/architecture/proof-aggregation/domain-management)
- [Receipt publication and exact-block paths](https://docs.zkverify.io/architecture/proof-aggregation/overview)
