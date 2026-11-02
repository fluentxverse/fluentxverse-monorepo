# Persistent Rust Payout Pilot

FluentXVerse's payout module uses a persistent Rust Groth16 worker in GMR Engine
as of October 29, 2026. Screening remains on snarkjs. Existing circuits,
verification keys, issuer keys, custody pins, setup policy and destination
settings were not replaced. This is not an independent audit or a new setup.

## Measured API Results

Three sequential synthetic two-lesson payout requests were measured through the
actual Engine API before and after activation, without concurrent benchmark QA.

| Backend | Request 1 | Request 2 | Request 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| Previous snarkjs worker | 9.133 s | 9.493 s | 9.281 s | 9.281 s |
| Persistent Rust pilot | 4.568 s | 4.548 s | 4.783 s | 4.568 s |

This small sample showed approximately a 51% reduction in API proof-generation
latency. It includes evidence preparation, release inspection and independent
snarkjs verification, but excludes one-time setup verification and worker warmup.
It is not a throughput, worst-case latency or zkVerify-finality guarantee.

All six API results locally verified, matched the approved release/destination
bindings and rejected a changed chain signal in application validation.
No application earnings records were created and no on-chain transaction was
submitted. Synthetic evidence was processed using the existing Engine-only
issuer custody path; issuer keys were not exported.

## Implementation

- `gmr-engine/prover`: pinned Rust executable with Arkworks Groth16 and the
  existing Circom WASM witness program. Only public key/code objects are cached.
- `internal/httpapi/payout_native.go`: private-pipe supervisor, executable digest
  pin, bounded frames, exact request IDs, one-job gate, timeouts and recycling.
- `scripts/payout-private-prover.ts`: existing approved release validation,
  private preparation and signing; adds an internal prepare action.
- `scripts/payout-private-worker.mjs`: snarkjs reference verification of every
  native proof before the HTTP response is accepted.

There is no new HTTP service or externally reachable prover port. The existing
global Engine proving slot still serializes expensive work. Native runtime
errors do not silently fall back or retry an irreversible transaction.

Worker recycling occurs on tenant/configuration changes, after 32 completed jobs,
or before the next request if its age exceeds ten minutes. Each job gets a fresh
WASM instance. Witness memory, field-vector witness, frame bytes and input strings
are cleared on the implemented paths; this is best-effort hygiene, not a claim
of complete forensic erasure across runtime/allocator/Go/JavaScript copies.
The Rust process disables core dumps and does not receive wallet/issuer keys.

## Validation

- Full Go suite passed; HTTP/config tests also passed with the race detector.
- Rust canonical-scalar, field-bound and protocol-shape unit tests passed.
- Real isolated proofs alternated Arbitrum and ApeChain statements six times in
  the same worker. Every proof passed independent snarkjs verification and
  rejected changed chain signals. Measured worker RSS stayed at about 132 MiB.
- Missing inputs, mismatched artifact hashes, incorrect amounts and wrong public
  signals were rejected; a restarted process successfully proved valid evidence.
- Supervisor tests cover reuse, tenant/release changes, job/age limits, binary
  pins, crashes, oversized output, stale IDs, changed signals, cancellation,
  concurrent work and shutdown during an active request.
- Two simultaneous live API requests returned one verified proof (HTTP 200) and
  one busy response (HTTP 429). This checks resource serialization, not financial
  duplicate-claim handling; no application records or transfers were created.
- Post-rollout authenticated checks returned HTTP 200 for destination saving,
  wallet balance and zkVerify account lookup. Screening and payout artifacts
  were both ready, and the API/Engine containers were healthy without restarts.

The pilot verifies backend compatibility locally, not a new paid zkVerify
submission and relayed receipt. All existing submission and transfer gates remain.

## Operations

Activation requires both `GMR_ENGINE_PAYOUT_NATIVE_ENABLED=true` and
`proverBackend: "rust"` in the approved payout module configuration.
The binary path and exact digest must be supplied through
`GMR_ENGINE_PAYOUT_NATIVE_BIN` and `GMR_ENGINE_PAYOUT_NATIVE_SHA256`.
Unknown backends or invalid native configuration fail closed.

To return to snarkjs, restore the module backend to `snarkjs` or remove that
property; disable the native flag and restart Engine during an idle window.
Do not change the release's cryptographic pins or reissue payment transactions.
The deployment keeps a private rollback snapshot on the VPS; never commit it.

The scoped deployed image is
`fluentxverse-cloud/gmr-engine:rust-payout-worker-20261029`.
Source belongs to GMR Engine; deployment/verification scripts are
`scripts/deploy-rust-payout-worker.mjs` and
`scripts/verify-rust-payout-pilot.mjs` in the FluentXVerse monorepo.
Raw test/pilot summaries are under `output/release/rust-payout-worker-20261029`.
