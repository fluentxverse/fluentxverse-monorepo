# Project-Selectable Destinations

The Engine ZKVerify destination dropdown saves the owner's selection immediately.
Base, ApeChain, Arbitrum One, OP Mainnet and Robinhood Chain are supported; Horizen
is not offered. The native proof-verification network remains zkVerify mainnet.

## Authority And Pins

Engine stores one destination and revision per root project in Memgraph. All
child modules inherit it. Saves require ownership, same-origin administration
and the current revision; stale saves do not overwrite another operator's choice.
Project API keys can only read the inherited selection.

FluentXVerse's five module policies and two prover configurations explicitly
allow project routing. Effective domain, chain and bridge bindings are derived
from Engine's approved coordinates. Verification keys, issuer keys, custody
records, setup manifests, screening rules, financial policy and nullifier keys
are not changed. A destination selection cannot activate a disabled workflow.

The application uses `PROOF_DESTINATION_MODE=project`. New screening/payout
releases come from the dedicated authenticated Engine connection; new review
cohorts resolve the project destination through `GET /v1/zkverify/destination`.
Missing or invalid configuration fails closed, without a stale environment fallback.

## Existing Work

Previously submitted proofs retain their native network and domain. Historical
screening credentials, payout authorizations and review cohorts keep their original
chain and are checked against that chain's official bridge. No old proof is
relabelled or resubmitted automatically.

An unsubmitted chain-bound credential needs fresh issuance for a new destination,
or the original destination selected before submission. Old payout authorizations
cannot be submitted under a new chain/domain. Review enrollment remains unique per
student, tutor and month across destination changes, including concurrent attempts.

The destination does not bridge ETH/VFY, move ticket assets, or enable payout
transfers. Wallet balance reads follow the chosen chain without expanding the
wallet's signing permissions. The legacy testnet-only RISC Zero tally program
still requires its own compatible artifact release before mainnet activation.

## Release And Tests

- `scripts/deploy-project-destinations.mjs` builds scoped images/frontend assets
  from verified deployment baselines. Private rollback files stay on the VPS.
- `scripts/verify-project-destinations.mjs` checks authenticated saves across all
  five choices, all six projects, effective policy pins, application coordinates,
  original-selection restoration and historical-proof immutability.
- `--ready` additionally checks screening/payout readiness on every selection;
  `--ready --proof` generates one synthetic ApeChain-bound payout proof locally,
  without publishing it or creating real earnings.
- Application tests cover all offered coordinates, wrong network/domain/key
  rejection, historical bindings and enrollment persistence. An isolated Memgraph
  test exercises ten simultaneous cross-destination enrollment races.
- Browser tests cover automatic save, persisted selection, project isolation,
  stale-save errors, proof-confirmation locking and layout at 1440px and 375px.

Routing/readiness checks and locally verified synthetic proofs do not establish
that a new paid proof/relayer receipt completed on every destination.

The October 29 live sweep passed all five choices across all six projects,
including screening/payout readiness, and restored Arbitrum One afterward.
A synthetic ApeChain-bound payout proof verified locally in about eight seconds.
All 11 historical proof records were unchanged. No on-chain transaction or
fund transfer was made. The release image passed 50 application tests with one
native-Rust-only check skipped; all 51 passed locally. Engine HTTP/config tests
also passed with Go's race detector enabled.
