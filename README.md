# FluentXVerse

FluentXVerse is an online English tutoring platform connecting students with screened tutors. This monorepo contains the student and tutor experiences, administration dashboard, public website, application API, mobile workstream, and supporting privacy infrastructure.

Website: https://fluentxverse.com

## Applications

| Application | Monorepo directory | App-focused GitHub repository |
| --- | --- | --- |
| Student web app | `fluentxverse-student-solid-prototype/` | [fluentxverse-student](https://github.com/fluentxverse/fluentxverse-student) |
| Tutor web app | `fluentxverse-tutor-solid-prototype/` | [fluentxverse-tutor](https://github.com/fluentxverse/fluentxverse-tutor) |
| Administration dashboard | `fluentxverse-dashboard/` | [fluentxverse-dashboard](https://github.com/fluentxverse/fluentxverse-dashboard) |
| Public website | `fluentxverse-site/` | [fluentxverse-site](https://github.com/fluentxverse/fluentxverse-site) |
| Active Bun/Elysia API | `fluentxverse-server/` | [fluentxverse-server](https://github.com/fluentxverse/fluentxverse-server) |
| Native student mobile workstream | `fluentxverse-mobile/` | [fluentxverse-mobile](https://github.com/fluentxverse/fluentxverse-mobile) |
| Go backend migration workstream | `fluentxverse-go-server/` | [fluentxverse-go-server](https://github.com/fluentxverse/fluentxverse-go-server) |

The monorepo remains the source of truth. The app-focused repository names above are reserved publication targets; initial creation is awaiting authentication as the `fluentxverse` GitHub owner. Prepared exports have a recorded source commit and are not independent production releases. Private repository links require collaborator access. See [repository publishing](docs/app-repositories.md) for scope, validation, and refresh instructions.

The active student and tutor web clients use SolidJS. Their historical folder names are retained for compatibility. Previous Preact clients are in `archive/preact/`, outside the active deployment path. The administration dashboard uses Preact. The Go server is a migration workstream, not the active API by default.

## Architecture

| Layer | Role |
| --- | --- |
| SolidJS, TypeScript, Vite | Student, tutor, and public-site frontends |
| Preact, TypeScript, Vite | Administration dashboard |
| Cloudflare Workers | Static frontend hosting |
| Bun, Elysia, Socket.IO | Application API and realtime application events |
| Cloudflare RealtimeKit | Configurable classroom media provider |
| Memgraph | Primary business graph, including compensation and earnings |
| PostgreSQL | Logs and supporting operational/session/recording metadata |
| SeaweedFS | Media and encrypted archived recordings |
| GMR Engine and GMR Vault | Separate Web3 execution, managed wallets, signing, and verification credentials |

`shared/` contains cross-app utilities. `contracts/` and `zk/` contain supporting contract/proof source. GMR Engine and GMR Vault are separate services and are not included in this monorepo.

## Development

Use Bun, Node.js 22+, and npm. Configure each app using its environment documentation and use isolated development services for mutation tests.

```bash
bun run install:all
bun run dev:student
bun run dev:tutor
bun run dev:dashboard
bun run dev:site
```

Run the API with `bun run dev:server` only after reviewing its historical local TLS override. For a watch process without that override, run `bun --watch src/index.ts` from `fluentxverse-server/`. Never disable certificate validation in production.

```bash
bun run build:all
```

Builds do not establish successful service integration. Database, authentication, classroom, refund, recording, and privacy workflows require their own configured tests and acceptance evidence. See [frontend deployment](docs/cloudflare-workers-frontends.md), [slot contention QA](docs/qa-slot-contention-20261014.md), and [cancellation/time-zone QA](docs/qa-cancellation-timezones-20261014.md).

## Privacy Workstreams

The platform includes application workflows and supporting proof source for privately verifiable tutor screening, privacy-oriented reviews/passes, and compensation-related work. Privy handles student social login. Tutor wallets are managed through GMR Engine/GMR Vault.

Distinguish implemented code from reviewed proving artifacts, deployed contracts, enabled production modules, and completed acceptance tests. ZK statements over authorized records do not prove assessment accuracy or that teaching occurred. Ordinary public transfers do not provide shielded settlement. Production activation requires the appropriate issuer, policy, lifecycle, artifact-review, and operational gates.

Never commit student records, recordings, private assessment evidence, API tokens, seed phrases, or signing keys. Report security concerns privately to hello@fluentxverse.com.

## Licensing

No root license file is currently present. Do not infer an MIT or other license from public repository availability. Contact hello@fluentxverse.com for licensing terms; third-party components retain their own licenses.
