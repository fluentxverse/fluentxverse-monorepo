# Local server capacity probe

Measured on 2026-10-23. This is a bounded local service-layer experiment, not a production capacity guarantee or a completed video-call load test.

## Result

The proposed 2-core, 3 GB plan is **not sufficient for the complete stack with local anonymous-review proving**. Even the smallest valid five-review RISC Zero tally exhausted a 3 GB container memory limit, before allowing memory for the API, databases, Engine, Vault, SeaweedFS, and operating system.

Classroom persistence plus serialized screening Groth16 proving was much lighter:

| Synthetic rooms | Participants represented | Sampled combined memory peak | Note-save p95 | Screening proof times | Operation failures |
| --- | --- | --- | --- | --- | --- |
| 0 | 0 | 467.0 MiB | N/A | 2.41-2.48 s | 0 |
| 10 | 20 | 495.3 MiB | 15.3 ms | 2.50-2.62 s | 0 |
| 25 | 50 | 494.0 MiB | 7.2 ms | 2.49-2.59 s | 0 |
| 50 | 100 | 511.2 MiB | 44.8 ms | 2.41-2.58 s | 0 |

All four phases completed three actual proofs and local verification using the installed production screening proving artifacts. They used a synthetic issuer that is not trusted in production. No credential was issued to a real applicant, no proof was submitted to zkVerify, and no wallet was charged.

The review proof failed with an OOM kill at both limits tested:

| Reviews | Container limit | Cgroup memory peak | Outcome |
| --- | --- | --- | --- |
| 5 | 1536 MiB | 1536 MiB | OOM kill after about 6.7 s |
| 5 | 3072 MiB | 3072 MiB | OOM kill after about 36.8 s |

These failures establish that the review job needs more memory than tested. They do not establish its eventual successful peak, or a safe limit for larger tallies. Its normal 12 GiB container limit is a ceiling, not a measured requirement.

## Method

`node scripts/simulate-server-capacity.mjs`

- Uses the exact image ID of the running FluentXVerse API, without its production environment or credentials.
- Creates a private, internal Docker network and fresh disposable PostgreSQL and Memgraph volumes. Publishes no ports. Does not join any production network.
- Limits the service/proof container to 1.5 CPU and 1536 MiB, Memgraph to 0.35 CPU and 512 MiB, and PostgreSQL to 0.15 CPU and 256 MiB. Swap is disabled for these containers. CPU quotas total two cores; memory limits total 2304 MiB, leaving part of a hypothetical 3 GB host for other processes.
- Calls the image's real session/presence, classroom activity, notes, and exercise-mark service implementations. Seeds synthetic bookings and material records, not real bookings or ticket transfers.
- Runs each phase for approximately 30 seconds after setup. Reads participants and notes every five seconds per room, writes notes and marks every ten seconds, batches presence every five seconds, reconnects each student once, and deactivates participants on closure.
- Generates three sequential Groth16 screening proofs during each phase. Engine scripts, dependencies, and the existing self-operated release are mounted read-only. The release location is deliberately pinned in the runner.
- Samples Docker container memory, CPU, and block I/O approximately every 250 ms. Memory totals include the tested application/proof process and its two databases, not the entire production stack. CPU samples may briefly exceed quota sums because quotas allow bursts and individual samples cover slightly different windows.
- Confirms all participants are inactive after closure and reports exceptions and container OOM state. Fails if a classroom phase exits unsuccessfully.
- Removes test containers, network, and disposable volumes on normal completion or caught failure. Retains JSON/log evidence under ignored `output/capacity/`.

`node scripts/simulate-review-proof.mjs`

`CAPACITY_REVIEW_MEMORY_MIB=3072 node scripts/simulate-review-proof.mjs`

- Builds a five-review synthetic fixture without network access, then starts an isolated copy of the deployed tally-prover image with no production environment, a read-only filesystem, and no network.
- Invokes the actual RISC Zero prover with development receipts disabled and two Rayon threads. It does not use the running production prover or submit anything onchain.
- Limits CPU to 1.5 cores, disables swap, bounds runtime to three minutes, and records cgroup memory peak/OOM counters as well as sampled usage.
- Accepts only explicit memory limits of 1536, 2048, 3072, 4096, or 6144 MiB. A larger run is optional and must leave adequate host memory available.
- Reports sizing failures as evidence; an OOM result is not a successful proof. Review proving was tested separately, not simultaneously with the classroom phases.

## Important limits

This harness calls service methods directly, not production HTTP routes, authentication, rate limiting, Socket.IO connections, or the RealtimeKit SDK. Participant counts represent database activity, not connected video clients. Activity logging uses a minimal fresh presence schema rather than all production migrations and foreign keys. The database is small, and the load generator shares the tested application process.

It excludes media forwarding/encoding, recording ingestion, SeaweedFS uploads, recording playback, AI APIs, proof aggregation/bridge receipt polling, review submission proofs, and concurrent review and screening proving. Media handled by Cloudflare is not simulated. It also excludes the runtime memory of Engine, Vault, their databases, Redis, and SeaweedFS, plus the operating system.

Sampling can miss short peaks. The host processor and SSD, page cache, and background workloads differ from a shared-core VPS. Thirty-second phases do not establish sustained capacity, long-term growth, join-storm performance, or a safe advertised number of concurrent lessons.

Before these tests, Docker reported 7.005 GB of images and 2.478 GB of local volumes across the workstation, including unrelated projects and retained images. This is not a clean production disk inventory. The screening release directory used about 30 MiB. The 50-room test's Memgraph directory occupied about 385 MiB and PostgreSQL reported about 7.7 MiB of logical database size. Block-I/O counters include database startup writes and are not net storage growth or an SSD throughput benchmark. No recordings were generated; these measurements do not validate a 30 GB production disk.

## Next sizing step

Keep heavy review proving on a separately sized private worker, or measure its successful peak on a larger isolated worker before buying a single-host plan. Preserve the same authenticated private prover interface and evidence validation; do not outsource witnesses to an untrusted prover.

Repeat the service probe on the candidate VPS, then run authenticated socket/browser clients and real RealtimeKit lessons on separate networks. Include recording downloads/uploads, actual production-size data, and at least a full lesson duration. Measure a successful larger review tally before selecting worker RAM. Leave operating-system, deployment, backup, and storage-growth headroom; do not treat the 511 MiB synthetic result as the total server requirement.

## Evidence

- Successful service/screening run: `output/capacity/2026-10-23T10-03-40.465Z/report.json` and its per-phase samples/logs.
- 1536 MiB review run: `output/capacity/review-2026-10-23T10-06-56.121Z/report.json`.
- 3072 MiB review run: `output/capacity/review-2026-10-23T10-07-34.358Z/report.json`.
- Earlier directories retain harness-startup failures (file permissions and PostgreSQL's temporary initialization server); they are not the successful benchmark.

No production containers, environment settings, balances, or user records were changed by these simulations.
