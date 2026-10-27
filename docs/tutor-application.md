# Tutor Application Workflow

## Progression

1. Register a tutor account. Wallet provisioning remains delegated to GMR Engine.
2. Pass the written exam: 30 questions, 10 each for grammar, vocabulary and reading comprehension; 90% required. The server starts the 25-minute clock. After expiry, only previously saved answers count.
3. Complete ten recorded oral tasks. Each task is uploaded separately and saved before advancing. Reloading resumes at the first unsaved task; the overall deadline continues running.
4. Pass provisional transcript-content screening at 85%. The versioned `transcript-content.v2` rubric scores vocabulary, grammar, coherence and task completion equally. Integer overall scores round down, so a sub-threshold average cannot become a pass. Pronunciation and acoustic fluency are explicitly unassessed (`null`). An incomplete, expired recording attempt cannot pass.
5. Book a future interview in Asia/Manila time. Both assessment passes are required server-side. A tutor can have only one pending interview, and an interview time can have only one booking.
6. An authorized human reviewer evaluates pronunciation, delivery and readiness in the interview. Teaching eligibility requires written pass, oral screening pass, interview pass and approved profile. Eligibility is checked before checkout reservation and again inside the final booking transaction. Existing explicitly designated QA-account waivers are not assessment evidence.

There are two failed attempts per assessment in a rolling 30-day window. Provider outages and grading failures do not consume failed attempts. Generation retries have a 30-second cooldown and an exclusive three-minute reservation. Malformed legacy active exams, including attempts with missing picture files, are invalidated without counting as failures.

Written generation, oral generation and content grading use schema-bound model outputs, followed by server validation of question counts, task distributions, references and score ranges. Assessment generation allows at most three model calls for invalid output, sharing one 90-second deadline; provider/authentication and database failures are not retried by this mechanism. Invalid output never becomes a published assessment or passing grade. Written-generation diagnostics report only error categories and schema paths, never answer keys or provider response bodies.

## Durable Oral Grading

`SpeakingRecording` nodes in Memgraph hold authenticated AES-256-GCM ciphertext for audio, transcript checkpoints and task grades. Encryption context binds tutor, attempt and task. Recordings cannot be overwritten after saving; identical retries are idempotent. No client transcript is trusted. Audio data URLs are size-limited and never fetched remotely.

Final submission returns HTTP 202 immediately. The server worker starts after database initialization, polls every five seconds, and grades one attempt at a time per process. It uses two-minute, owner-fenced leases and checkpoints after each transcription and grade. Provider calls are limited to 60 seconds. Expired leases can be reclaimed after restart; late workers cannot publish results. Results and applicant pass flags commit in the same transaction.

Three automatic runs are allowed, followed by an explicit `grading_failed` state. One applicant-requested retry cycle is available when durable recordings exist. Further failures require operator review. Legacy synchronous jobs with no persisted audio are marked for support review, not silently failed or retried indefinitely. Do not reset their pass flags or fabricate evidence to recover them.

The worker never logs audio, transcripts or raw provider bodies. Applicant results remain authenticated, owner-bound and non-cacheable. Transcripts in final results remain private application records, not public ZK inputs.

## Configuration And Release

- The API service needs its normal OpenAI credentials and a dedicated `SCREENING_EVIDENCE_KEY_HEX` containing exactly 64 hexadecimal characters. Put this in the server secret store, never a frontend `VITE_` variable or Git. Back it up securely; changing or losing it makes existing ciphertext unreadable. Audio acceptance and oral generation fail closed when the key is absent.
- Persist and back up Memgraph, including `SpeakingRecording` nodes. This is not a Postgres queue or temporary browser storage. Size the database for recordings and define an operator-approved retention policy before a large rollout. Evidence deletion also affects later screening-credential issuance.
- Database startup must permit uniqueness constraints for `Exam.id`, `SpeakingRecording.id` and `InterviewCalendar.id`. Duplicate legacy identifiers require investigation, not automatic deletion.
- Deploy API and tutor frontend together: the frontend now uses `/exam/active`, `/exam/result/:examId`, `/exam/speaking/active` and `/exam/speaking/result/:examId`. Oral uploads use `/exam/speaking/recording`; final submit contains only `examId`. The former standalone transcription endpoint returns 410.
- The rubric change changes the screening policy hash. Screening proof activation remains disabled pending reviewed artifacts and approved trust configuration. Do not reuse an old policy approval to activate this rubric.

## Verification

Policy/rubric tests:

```sh
cd fluentxverse-server
bun test tests/applicationPolicy.test.ts tests/screening.test.ts tests/screening.http.test.ts ../shared/tests/interviewCall.test.ts
```

Persistence, fault-injection, HTTP and race tests require a disposable **empty** Memgraph instance exposed only on `127.0.0.1:17706`. The test refuses another URI and refuses a populated database:

```sh
APPLICATION_TEST_URI=bolt://127.0.0.1:17706 bun test ./tests/application.persistence.ts
```

Browser tests use mocked API responses and Chrome's fake microphone, never production accounts:

```sh
cd fluentxverse-tutor-solid-prototype
TUTOR_TEST_URL=http://127.0.0.1:5188 node tests/browser/applicationFlow.cjs
bun run build
```

Automated checks cover saved-task resume, upload failure/retry, refresh during grading, result rendering with unassessed acoustic dimensions, desktop/mobile layouts, expired answers, atomic completion rollback, restart recovery, stale-worker fencing, bounded provider retries, ownership, prerequisite enforcement and booking races. They do not establish AI grading accuracy, applicant liveness, production provider availability or real microphone quality. Complete a real applicant/interviewer pilot before declaring production readiness.

### Scoped Production Release

The release tooling overlays the tutor application changes onto the deployed API image and deployed tutor source snapshot. It deliberately excludes unrelated changes in a shared working tree. Review the pinned baselines before reusing these date-specific scripts for another release.

```sh
node scripts/prepare-tutor-application-release.mjs
node scripts/verify-tutor-application-release.mjs
node scripts/deploy-tutor-application-release.mjs --deploy
```

Verification uses disposable Memgraph/Postgres containers and synthetic speech with the configured real provider, without wallets or chain transactions. It checks the full HTTP server, automatic grading worker and built frontend. The deployment gate requires its recorded image and frontend hashes, preserves runtime secrets, backs up a Memgraph snapshot, and refuses to interrupt active classrooms or recent assessments. Protected key backups and rollback configuration live outside Git under `~/.local/state/fluentxverse/`; restrict and back up that directory separately.

### Production Deployment: 2026-10-22

- Tutor application: `https://tutor.fluentxverse.com/`, Cloudflare version `a4d5d374-30b4-451c-a31d-41df29b4a2ef`.
- API image: `fluentxverse-server:tutor-application-20261022`, digest `sha256:acc3d062dec255001eca1961cfb731b4dc88b1ee1479ad893aafcf1496f42218`.
- Pre-deployment verification: 58 server tests, 118 frontend tests, frontend typecheck/build, desktop/mobile browser checks, and a real-provider synthetic pilot covering 30 written questions and ten persisted, transcribed and automatically graded recordings. Pilot data stayed in disposable databases.
- Public-site checks: real anonymous login-screen/API/CORS checks at 1440px and 375px; mocked-account assessment UI, retry and refresh checks against deployed assets at 1440px, 375px and 320px. Public assessment images matched the built files. A 400 KB unauthenticated recording request reached the authentication guard rather than an unrelated payload limit. These checks did not create production accounts or attempts.
- Production dependencies were healthy, runtime configuration and existing mail settings were preserved, and the recording encryption key and pre-deployment graph snapshot were backed up outside the repository. No classrooms or recent assessments were active at deployment. No chain transactions were initiated.
- Remaining validation: a real applicant/interviewer pilot, real microphone/device quality and AI grading calibration. Whole-server TypeScript checking still reports pre-existing errors in `mailCompose.ts` and its tests; this release did not change that subsystem. Screening proof activation remains disabled pending reviewed artifacts and trust configuration.

The release manifest, verification results and deployment record are under `output/release/tutor-application-20261022/`. Keep the private runtime/rollback files and encryption key backups out of Git.
