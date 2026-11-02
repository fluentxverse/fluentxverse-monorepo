# Rust Prover Benchmark

The follow-up [Persistent Rust Payout Pilot](persistent-rust-payout-pilot.md)
records the scoped implementation and measured live API results. The original
isolated benchmark below remains unchanged in scope.

Measured on the FluentXVerse VPS on October 29, 2026. Production proving was
not changed, no production signing keys were used, and no proofs or transactions
were submitted to a chain.

## Results

| Measurement | snarkjs 0.7.6 | Rust / Arkworks |
| --- | ---: | ---: |
| Fresh worker: proof and verification, median | 4.23 s | 6.43 s |
| Fresh worker range, five trials | 4.13-4.32 s | 6.37-6.74 s |
| Fresh container wall time, median | 4.86 s | 6.92 s |
| Persistent worker: witness and proving, warm median | 3.78 s | 0.99 s |
| Maximum process RSS across measured trials | 239.7 MiB | 135.2 MiB |
| Maximum cgroup memory across measured trials | 192.6 MiB | 126.0 MiB |

The persistent Rust worker was approximately 3.8 times faster for witness/proof
calculation and used about 44% less peak process RAM across this sample.
Fresh Rust processes were slower than fresh snarkjs processes.

Rust's first request paid roughly 1.3-1.6 seconds to read the proving key and
4.0-4.4 seconds to compile the witness WASM. Reusing those objects removes most
of that overhead. Its native proof computation alone took roughly 0.77-0.93
seconds. Separate evidence preparation/signing took 2.02 seconds on first use
and approximately 0.05 seconds on subsequent uses in the existing JavaScript
implementation.

## What Was Compared

- Same deployed private-payout circuit, contributed proving key and verification
  key, with hashes checked against the installed release manifest.
- Synthetic two-lesson USD earnings fixture and temporary random issuer/nullifier
  keys. The same prepared input and 20 public signals were used by both backends.
- AMD EPYC-Milan VPS, one CPU quota, 2 GiB memory limit, no swap, no network,
  read-only container root, dropped capabilities and lower CPU shares.
- Five fresh-process runs per backend in alternating order, then one process per
  backend generating five sequential proofs. The warm median uses the last four
  proofs. OS disk/page caches were not flushed.
- Node v24.21.0 with snarkjs 0.7.6, single-thread proving as in the existing
  worker. Rust 1.88.0, ark-circom/ark-groth16 0.5.0, Wasmer 4.4.0 and one Rayon
  thread. Dependencies are pinned in Cargo.lock.

All generated proofs verified locally, their changed public-chain signals were
rejected, and the final proof from each measured process cross-verified in the
other implementation against the same verification key.

Six additional negative checks rejected tampered payout amounts, signatures and
public chain bindings in both backends, with controlled errors rather than crashes.

Process timing includes key/WASM initialization where performed, but not module
imports occurring before the timer. Container wall timing includes Docker launch
and cleanup. Process RSS can exceed cgroup memory because shared pages can be
charged elsewhere; these are different metrics, not interchangeable measurements.
This is a small sample under the VPS's normal background services, not a capacity
or latency guarantee.

## Important Limits

This tests a Rust proving executable, not a complete all-Rust application:
Circom still defines the constraints and supplies the compiled WASM witness
program. Rust runs that program in Wasmer and creates/verifies the Groth16 proof.
Existing evidence preparation and signing remain JavaScript. Neither constraints
nor setup keys were regenerated.

The persistent comparison changes caching as well as language. Rust holds the
key and compiled WASM; the existing snarkjs `fullProve` path does not expose the
same reuse strategy. It does not establish a universal Rust-versus-JavaScript
speed ratio.

The earlier approximately eight-second result measured the live Engine request,
including preparation, release inspection and worker overhead. The table measures
isolated worker stages. It does not demonstrate a one-second production API or
zkVerify finality time, nor does it measure a Rust circuit rewrite or zkVM.

## Recommendation

Do not replace production with a fresh Rust subprocess: that measured slower.
The useful next candidate is an optional persistent Rust worker inside GMR
Engine, preloading only the pinned public artifacts and serializing jobs under
the existing resource limit. Test manifest/key rotation, memory cleanup,
timeouts, cancellation, stale input isolation, concurrency, and a zkVerify
compatibility pilot before activation. Retain snarkjs as the reference prover.

The adapter required Rust 1.88 and explicit Wasmer/WASIX features to run; Rust
1.90 did not link its stack-probe dependency. That toolchain/runtime maintenance
cost is real and should be weighed against the measured gains.

The prototype belongs to GMR Engine's `benchmarks/groth16-rust` directory.
The cloud runner is `scripts/benchmark-rust-prover.mjs`. Raw timing data and
validation results are under `output/benchmarks/rust-prover-20261029`.
